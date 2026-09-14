import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { AGENT_STATES } from "./agentState.js";

const AGENT_MEMORIES_COLLECTION = "agent_memories";

const VALID_MEMORY_TYPES = Object.freeze([
  "market_insight",
  "competitor_knowledge",
  "user_preference",
]);

const VALID_MEMORY_STATUSES = Object.freeze([
  "active",
  "superseded",
  "archived",
]);

const MAX_STORED_SUMMARY_LENGTH = 500;
const MAX_PROMPT_SUMMARY_LENGTH = 300;
const MAX_RETRIEVED_MEMORIES = 3;

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
  "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
  "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
  "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
  "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
  "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
  "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
  "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
  "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "want", "need", "build", "create", "start", "launch", "open", "find", "check",
  "analyze", "investigate", "validate", "market", "business", "idea", "project",
  "plan", "reality", "help", "looking", "setup"
]);

/**
 * Extract normalized keywords from text, stripping noise and stop words.
 *
 * @param {string} text
 * @returns {Array<string>} Unique normalized keywords.
 */
const extractKeywords = (text) => {
  if (typeof text !== "string") return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
};

/**
 * Normalize location representations into a consistent lowercased string.
 *
 * @param {*} location
 * @returns {string|null}
 */
const normalizeLocation = (location) => {
  if (!location) return null;
  if (typeof location === "string") {
    const trimmed = location.trim().toLowerCase();
    return trimmed || null;
  }
  if (typeof location === "object") {
    if (location.city || location.state) {
      return [location.city, location.state].filter(Boolean).join(", ").toLowerCase();
    }
    if (location.latitude && location.longitude) {
      return `${location.latitude},${location.longitude}`;
    }
  }
  return null;
};

/**
 * Serialize a MongoDB memory document for clean consumption.
 *
 * @param {Object} doc
 * @returns {Object}
 */
const serializeAgentMemory = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc._id?.toString() || doc._id,
    userId: doc.userId?.toString() || doc.userId,
    runId: doc.runId?.toString() || doc.runId,
  };
};

/**
 * Create a new curated agent memory record.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Required user identifier.
 * @param {string|ObjectId} params.runId - Required associated run identifier.
 * @param {string} params.memoryType - "market_insight" | "competitor_knowledge" | "user_preference".
 * @param {string|null} [params.ventureType=null] - "local" | "tech" | "general" | "hybrid".
 * @param {string} params.topic - Descriptive topic label.
 * @param {Array<string>} [params.keywords=[]] - Topic/entity keywords.
 * @param {string|null} [params.location=null] - Normalized location string.
 * @param {string} params.summary - Curated compact summary (max 500 chars).
 * @param {number} [params.confidence=1.0] - Confidence score (0..1).
 * @param {string} [params.status="active"] - "active" | "superseded" | "archived".
 * @returns {Promise<Object>} Created memory document.
 */
const createAgentMemory = async ({
  userId,
  runId,
  memoryType,
  ventureType = null,
  topic,
  keywords = [],
  location = null,
  summary,
  confidence = 1.0,
  status = "active",
}) => {
  if (!userId) {
    throw new Error("userId is required to create agent memory");
  }
  if (!runId) {
    throw new Error("runId is required to create agent memory");
  }
  if (!VALID_MEMORY_TYPES.includes(memoryType)) {
    throw new Error(
      `Invalid memoryType '${memoryType}'. Must be one of: ${VALID_MEMORY_TYPES.join(", ")}`
    );
  }
  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error("summary is required and must be a non-empty string");
  }
  if (!VALID_MEMORY_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status '${status}'. Must be one of: ${VALID_MEMORY_STATUSES.join(", ")}`
    );
  }

  const cleanSummary = summary.trim().slice(0, MAX_STORED_SUMMARY_LENGTH);
  const cleanKeywords = Array.isArray(keywords) && keywords.length > 0
    ? Array.from(
        new Set(
          keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
        )
      )
    : extractKeywords(summary);

  const cleanLocation = normalizeLocation(location);
  const cleanTopic =
    typeof topic === "string" && topic.trim() ? topic.trim() : "general_insight";
  const cleanConfidence =
    typeof confidence === "number" && confidence >= 0 && confidence <= 1.0
      ? confidence
      : 1.0;

  const now = new Date();
  const doc = {
    userId,
    runId,
    memoryType,
    ventureType:
      typeof ventureType === "string" ? ventureType.trim().toLowerCase() : null,
    topic: cleanTopic,
    keywords: cleanKeywords,
    location: cleanLocation,
    summary: cleanSummary,
    confidence: cleanConfidence,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const db = getDB();
  const result = await db.collection(AGENT_MEMORIES_COLLECTION).insertOne(doc);

  return serializeAgentMemory({
    _id: result.insertedId,
    ...doc,
  });
};

/**
 * Retrieve at most 3 relevant active memories strictly scoped to a user.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Required user identifier for strict isolation.
 * @param {string} [params.goal=""] - Current venture goal.
 * @param {string|null} [params.location=null] - Current location.
 * @param {string|null} [params.ventureType=null] - Current venture domain type.
 * @param {number} [params.limit=3] - Maximum memories to return (capped at 3).
 * @returns {Promise<Array<Object>>} Filtered and ranked relevant memory documents.
 */
const retrieveRelevantMemories = async ({
  userId,
  goal = "",
  location = null,
  ventureType = null,
  limit = MAX_RETRIEVED_MEMORIES,
}) => {
  if (!userId) return [];

  const cleanLocation = normalizeLocation(location);
  const goalKeywords = extractKeywords(goal);
  const cleanVentureType =
    typeof ventureType === "string" ? ventureType.trim().toLowerCase() : null;

  const query = {
    userId,
    status: "active",
  };

  const orClauses = [];
  if (cleanLocation) {
    orClauses.push({ location: cleanLocation });
    try {
      orClauses.push({
        location: {
          $regex: cleanLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      });
    } catch {
      // ignore regex error
    }
  }
  if (goalKeywords.length > 0) {
    orClauses.push({ keywords: { $in: goalKeywords } });
  }
  if (cleanVentureType) {
    orClauses.push({ ventureType: cleanVentureType });
  }

  if (orClauses.length > 0) {
    query.$or = orClauses;
  }

  const db = getDB();
  let candidateDocs = [];
  try {
    const cursor = db
      .collection(AGENT_MEMORIES_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 });

    candidateDocs = await cursor.toArray();
  } catch (err) {
    console.warn("Error retrieving agent memories:", err?.message);
    return [];
  }

  if (!candidateDocs || candidateDocs.length === 0) {
    return [];
  }

  // Score candidate memories for relevance
  const scored = candidateDocs.map((doc) => {
    let score = 0;

    // Location match: +3 for exact, +2 for substring
    if (cleanLocation && doc.location) {
      if (doc.location === cleanLocation) {
        score += 3;
      } else if (
        cleanLocation.includes(doc.location) ||
        doc.location.includes(cleanLocation)
      ) {
        score += 2;
      }
    }

    // Keyword overlap: +2 per matching token
    if (Array.isArray(doc.keywords) && goalKeywords.length > 0) {
      const docKeywordSet = new Set(
        doc.keywords.map((k) => String(k).toLowerCase())
      );
      for (const kw of goalKeywords) {
        if (docKeywordSet.has(kw)) {
          score += 2;
        }
      }
    }

    // Venture type match: +1
    if (
      cleanVentureType &&
      doc.ventureType &&
      doc.ventureType === cleanVentureType
    ) {
      score += 1;
    }

    return { doc, score };
  });

  const hasCriteria =
    Boolean(cleanLocation) || goalKeywords.length > 0 || Boolean(cleanVentureType);
  const filtered = hasCriteria ? scored.filter((item) => item.score > 0) : scored;

  // Sort descending by score, then by recency (createdAt desc)
  filtered.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (
      new Date(b.doc.createdAt || 0).getTime() -
      new Date(a.doc.createdAt || 0).getTime()
    );
  });

  const maxLimit = Math.min(
    typeof limit === "number" && limit > 0 ? limit : MAX_RETRIEVED_MEMORIES,
    MAX_RETRIEVED_MEMORIES
  );

  return filtered
    .slice(0, maxLimit)
    .map((item) => serializeAgentMemory(item.doc));
};

/**
 * Format memories into an advisory <historical_context> block with strict grounding warnings.
 *
 * @param {Array<Object>} memories
 * @returns {string} Safe injection string, or empty string if no memories.
 */
const formatMemoriesForPrompt = (memories) => {
  if (!Array.isArray(memories) || memories.length === 0) {
    return "";
  }

  const slice = memories.slice(0, MAX_RETRIEVED_MEMORIES);
  const formattedItems = slice
    .map((m, idx) => {
      const type = m.memoryType || "market_insight";
      const topic = m.topic ? ` (${m.topic})` : "";
      let summary = typeof m.summary === "string" ? m.summary.trim() : "";
      if (summary.length > MAX_PROMPT_SUMMARY_LENGTH) {
        summary = summary.slice(0, MAX_PROMPT_SUMMARY_LENGTH).trim() + "...";
      }
      return `[Memory ${idx + 1}] [${type}]${topic}: ${summary}`;
    })
    .join("\n");

  return `
<historical_context>
WARNING: Historical memories are purely advisory background notes from previous investigations for this user.
Memories DO NOT constitute grounded evidence for the current run.
You MUST NOT cite historical memories as current-run evidence, placeIds, businesses, customer reviews, or completed steps.
Current-run evidence and steps remain the sole source of truth and grounding.
${formattedItems}
</historical_context>`;
};

/**
 * Distill curated insights from a completed run upon successful synthesis.
 * FAILED and QUOTA_LIMITED runs are strictly excluded.
 *
 * @param {Object} params
 * @param {Object} params.run - Completed agent run document.
 * @param {Object} params.finalOutput - Validated synthesis final output.
 * @param {Array<Object>} [params.steps=[]] - Run execution steps.
 * @param {Array<Object>} [params.evidence=[]] - Run grounded evidence.
 * @returns {Promise<Array<Object>>} Distilled and saved memory documents.
 */
const distillMemoriesFromCompletedRun = async ({
  run,
  finalOutput,
  steps = [],
  evidence = [],
}) => {
  if (!run || run.state !== AGENT_STATES.COMPLETED) {
    return [];
  }
  if (
    run.state === AGENT_STATES.FAILED ||
    run.state === AGENT_STATES.QUOTA_LIMITED
  ) {
    return [];
  }
  if (!finalOutput || typeof finalOutput !== "object") {
    return [];
  }

  const created = [];
  const userId = run.userId;
  const runId = run._id?.toString() || run._id;
  const location = run.location || null;
  const ventureType = run.plan?.ventureType || run.plan?.category || null;

  // 1. Market Insight from final recommendation verdict or summary
  const marketSummaryText =
    (typeof finalOutput.marketSummary === "string" &&
      finalOutput.marketSummary.trim()) ||
    (typeof finalOutput.verdict?.summary === "string" &&
      finalOutput.verdict.summary.trim()) ||
    (typeof finalOutput.executiveSummary === "string" &&
      finalOutput.executiveSummary.trim()) ||
    "";

  if (marketSummaryText) {
    const memory = await createAgentMemory({
      userId,
      runId,
      memoryType: "market_insight",
      ventureType,
      topic: "market_feasibility",
      keywords: extractKeywords(
        `${run.goal} ${location || ""} ${marketSummaryText}`
      ),
      location,
      summary: marketSummaryText.slice(0, MAX_STORED_SUMMARY_LENGTH),
      confidence:
        typeof finalOutput.confidenceScore === "number"
          ? finalOutput.confidenceScore
          : 1.0,
    });
    created.push(memory);
  }

  // 2. Competitor Knowledge from synthesis analysis or grounded evidence
  const competitorAnalysisText =
    (typeof finalOutput.competitorAnalysis?.summary === "string" &&
      finalOutput.competitorAnalysis.summary.trim()) ||
    (typeof finalOutput.competitorLandscape === "string" &&
      finalOutput.competitorLandscape.trim()) ||
    "";

  if (competitorAnalysisText) {
    const memory = await createAgentMemory({
      userId,
      runId,
      memoryType: "competitor_knowledge",
      ventureType,
      topic: "competitor_landscape",
      keywords: extractKeywords(
        `${run.goal} ${location || ""} ${competitorAnalysisText}`
      ),
      location,
      summary: competitorAnalysisText.slice(0, MAX_STORED_SUMMARY_LENGTH),
      confidence: 1.0,
    });
    created.push(memory);
  } else {
    // If no direct competitor text in finalOutput, derive from competitor discovery evidence
    const compEvidence = evidence.find(
      (e) => e.evidenceType === "competitor_discovery"
    );
    if (
      compEvidence &&
      Array.isArray(compEvidence.data?.businesses) &&
      compEvidence.data.businesses.length > 0
    ) {
      const topNames = compEvidence.data.businesses
        .slice(0, 3)
        .map((b) => b.name)
        .filter(Boolean)
        .join(", ");
      const total =
        compEvidence.data.totalFound || compEvidence.data.businesses.length;
      const compSummary = `Found ${total} competitors in ${
        location || "target area"
      }. Key competitors include: ${topNames}.`;

      const memory = await createAgentMemory({
        userId,
        runId,
        memoryType: "competitor_knowledge",
        ventureType,
        topic: "competitor_landscape",
        keywords: extractKeywords(`${run.goal} ${topNames} ${location || ""}`),
        location,
        summary: compSummary.slice(0, MAX_STORED_SUMMARY_LENGTH),
        confidence: 1.0,
      });
      created.push(memory);
    }
  }

  return created;
};

/**
 * Record a user preference memory when a clarification question is answered.
 *
 * @param {Object} params
 * @param {Object} params.run - Agent run document.
 * @param {string} params.question - The question that was asked.
 * @param {string} params.answer - The user's clarification answer.
 * @returns {Promise<Object|null>}
 */
const recordClarificationMemory = async ({ run, question, answer }) => {
  if (!run || !answer || typeof answer !== "string" || !answer.trim()) {
    return null;
  }
  if (
    run.state === AGENT_STATES.FAILED ||
    run.state === AGENT_STATES.QUOTA_LIMITED
  ) {
    return null;
  }

  const userId = run.userId;
  const runId = run._id?.toString() || run._id;
  const location = run.location || null;
  const ventureType = run.plan?.ventureType || run.plan?.category || null;

  const cleanAnswer = answer.trim();
  const cleanQuestion =
    typeof question === "string" && question.trim()
      ? question.trim()
      : "Clarifying question";

  const summary = `User clarified: "${cleanAnswer}" for question "${cleanQuestion}" (Goal: ${
    run.goal || "Venture"
  }).`.slice(0, MAX_STORED_SUMMARY_LENGTH);

  return await createAgentMemory({
    userId,
    runId,
    memoryType: "user_preference",
    ventureType,
    topic: "user_preference_clarification",
    keywords: extractKeywords(`${run.goal} ${cleanQuestion} ${cleanAnswer}`),
    location,
    summary,
    confidence: 1.0,
  });
};

/**
 * Record a market insight memory when an investigation is stopped cleanly.
 *
 * @param {Object} params
 * @param {Object} params.run - Agent run document.
 * @param {Object} params.decision - STOP decision object.
 * @returns {Promise<Object|null>}
 */
const recordStopMemory = async ({ run, decision }) => {
  if (!run || !decision || decision.action !== "STOP") {
    return null;
  }
  if (
    run.state === AGENT_STATES.FAILED ||
    run.state === AGENT_STATES.QUOTA_LIMITED
  ) {
    return null;
  }

  const userId = run.userId;
  const runId = run._id?.toString() || run._id;
  const location = run.location || null;
  const ventureType = run.plan?.ventureType || run.plan?.category || null;

  const reason =
    decision.summary ||
    decision.reason ||
    decision.reasoning ||
    "Investigation halted by agent";
  const summary = `Investigation stopped: ${reason}`.slice(
    0,
    MAX_STORED_SUMMARY_LENGTH
  );

  return await createAgentMemory({
    userId,
    runId,
    memoryType: "market_insight",
    ventureType,
    topic: "investigation_halted",
    keywords: extractKeywords(`${run.goal} ${location || ""} ${reason}`),
    location,
    summary,
    confidence: 1.0,
  });
};

/**
 * Ensure database indexes on the agent_memories collection.
 */
const ensureAgentMemoryIndexes = async () => {
  const db = getDB();
  const collection = db.collection(AGENT_MEMORIES_COLLECTION);
  await collection.createIndex({ userId: 1, status: 1, createdAt: -1 });
  await collection.createIndex({ userId: 1, location: 1, status: 1 });
  await collection.createIndex({ runId: 1 });
  console.log(
    "Indexes ensured on agent_memories: { userId: 1, status: 1, createdAt: -1 }, { userId: 1, location: 1, status: 1 }, { runId: 1 }"
  );
};

export {
  AGENT_MEMORIES_COLLECTION,
  VALID_MEMORY_TYPES,
  VALID_MEMORY_STATUSES,
  MAX_STORED_SUMMARY_LENGTH,
  MAX_PROMPT_SUMMARY_LENGTH,
  MAX_RETRIEVED_MEMORIES,
  extractKeywords,
  normalizeLocation,
  createAgentMemory,
  retrieveRelevantMemories,
  formatMemoriesForPrompt,
  distillMemoriesFromCompletedRun,
  recordClarificationMemory,
  recordStopMemory,
  ensureAgentMemoryIndexes,
};

