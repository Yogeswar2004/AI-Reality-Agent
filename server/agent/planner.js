import { ObjectId } from "mongodb";
import {
  getAgentRunById,
  updateAgentRunCurrentDecision,
  updateAgentRunState,
} from "./agentRun.js";
import { getAgentStepsByRunId } from "./agentStep.js";
import { getAgentEvidenceByRunId } from "./agentEvidence.js";
import { AGENT_STATES } from "./agentState.js";
import registry from "./toolRegistry.js";
import { TOOL_IDS } from "./toolConstants.js";
import { techIdeaAnalysisDefinition } from "./tools/techIdeaAnalysisAdapter.js";
import { generateLLMPlan, LLMPlannerError } from "./llmPlanner.js";
import { generateLLMDecision, LLMDecisionError } from "./llmDecision.js";
import { classifyProviderError } from "./providerErrors.js";

class PlannerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "PlannerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const LOCAL_KEYWORDS = [
  "food court",
  "food stall",
  "food truck",
  "fast food",
  "coffee shop",
  "coffee",
  "restaurant",
  "canteen",
  "eatery",
  "diner",
  "bistro",
  "bakery",
  "cafe",
  "pizzeria",
  "pizza",
  "brewery",
  "bar",
  "pub",
  "food",
  "gym",
  "fitness",
  "salon",
  "spa",
  "barber",
  "barbershop",
  "boutique",
  "bookstore",
  "grocery store",
  "supermarket",
  "clinic",
  "dentist",
  "dental",
  "doctor",
  "pharmacy",
  "florist",
  "dry cleaner",
  "laundry",
  "car wash",
  "auto repair",
  "mechanic",
  "repair shop",
  "plumber",
  "plumbing",
  "electrician",
  "storefront",
  "brick and mortar",
  "brick-and-mortar",
];

const MODIFIER_KEYWORDS = new Set([
  "boutique",
  "brick and mortar",
  "brick-and-mortar",
  "storefront",
]);

const TECH_KEYWORDS = [
  "platform",
  "software",
  "saas",
  "app",
  "application",
  "api",
  "automated",
  "automation",
  "algorithm",
  "ai",
  "ml",
  "machine learning",
  "cloud",
  "database",
  "portal",
  "extension",
  "plugin",
  "sdk",
  "dashboard",
  "micro-fulfillment",
  "network",
];

const DEFAULT_COORDINATES = Object.freeze({
  latitude: 39.7392,
  longitude: -104.9903,
});

const KNOWN_COORDINATES = Object.freeze({
  denver: { latitude: 39.7392, longitude: -104.9903 },
  seattle: { latitude: 47.6062, longitude: -122.3321 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  "new york": { latitude: 40.7128, longitude: -74.006 },
  nyc: { latitude: 40.7128, longitude: -74.006 },
  "san francisco": { latitude: 37.7749, longitude: -122.4194 },
  sf: { latitude: 37.7749, longitude: -122.4194 },
  chicago: { latitude: 41.8781, longitude: -87.6298 },
  boston: { latitude: 42.3601, longitude: -71.0589 },
  "los angeles": { latitude: 34.0522, longitude: -118.2437 },
  london: { latitude: 51.5074, longitude: -0.1278 },
  vijayawada: { latitude: 16.5062, longitude: 80.648 },
});

const resolveCoordinates = (location) => {
  if (!location) return { ...DEFAULT_COORDINATES };

  if (typeof location === "object") {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
    return { ...DEFAULT_COORDINATES };
  }

  if (typeof location === "string") {
    const trimmed = location.trim();
    if (!trimmed) return { ...DEFAULT_COORDINATES };

    // Support parenthesized coordinates, e.g. "Austin, TX (30.267200, -97.743100)"
    const parenMatch = trimmed.match(/\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/);
    if (parenMatch) {
      const lat = parseFloat(parenMatch[1]);
      const lng = parseFloat(parenMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    // Support pure coordinate string, e.g. "30.267200, -97.743100"
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    const lower = trimmed.toLowerCase();
    for (const [city, coords] of Object.entries(KNOWN_COORDINATES)) {
      if (lower.includes(city)) {
        return { ...coords };
      }
    }

    return { ...DEFAULT_COORDINATES };
  }

  return { ...DEFAULT_COORDINATES };
};

const isLocalBusinessGoal = ({ goal, location }) => {
  if (!location) {
    return false;
  }

  const cleanGoal = goal.toLowerCase();
  const hasLocalKeyword = LOCAL_KEYWORDS.some((kw) => cleanGoal.includes(kw));
  const hasTechKeyword = TECH_KEYWORDS.some((kw) => cleanGoal.includes(kw));

  const hasExplicitCoordinates =
    (typeof location === "object" && location !== null && Number.isFinite(Number(location.latitude))) ||
    (typeof location === "string" &&
      (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(location.trim()) ||
        /\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/.test(location.trim())));

  if (hasExplicitCoordinates) {
    return !hasTechKeyword || hasLocalKeyword;
  }

  return hasLocalKeyword && !hasTechKeyword;
};

const hasWordMatch = (text, word) => {
  const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i").test(text);
};

function extractBusinessType(goal) {
  if (typeof goal !== "string" || !goal.trim()) {
    return "local business";
  }

  const cleanGoal = goal.toLowerCase().replace(/\s+/g, " ").trim();
  const sortedKeywords = [...LOCAL_KEYWORDS].sort((a, b) => b.length - a.length);

  const matchedKeywords = [];
  for (const kw of sortedKeywords) {
    if (hasWordMatch(cleanGoal, kw)) {
      matchedKeywords.push(kw);
    }
  }

  if (matchedKeywords.length === 0) {
    return "local business";
  }

  // Priority 1: Primary establishment category (non-modifier), picking the longest/most specific match
  const primaryMatch = matchedKeywords.find((kw) => !MODIFIER_KEYWORDS.has(kw));
  if (primaryMatch) {
    return primaryMatch;
  }

  // Priority 2: If only modifier/storefront keywords matched
  const firstMatch = matchedKeywords[0];
  if (firstMatch === "brick and mortar" || firstMatch === "brick-and-mortar" || firstMatch === "storefront") {
    return "local store";
  }

  return firstMatch;
}

/**
 * Generate a deterministic plan object for a given goal and location.
 * Purely advisory and side-effect-free (does NOT mutate run state or persist steps).
 *
 * @param {Object} params
 * @param {string} params.goal - Goal description.
 * @param {string|null} [params.location=null] - Optional location string.
 * @returns {Object} Structured plan object.
 */
const generatePlan = ({ goal, location = null }) => {
  if (typeof goal !== "string" || !goal.trim()) {
    throw new PlannerError("Goal is required to generate a plan", "INVALID_GOAL", 400);
  }

  const cleanGoal = goal.trim();
  const cleanLocation = typeof location === "string" ? location.trim() || null : null;

  const availableTools = registry.listTools();
  const availableToolIds = new Set(availableTools.map((t) => t.id));

  const isLocal = isLocalBusinessGoal({ goal: cleanGoal, location: cleanLocation || location });

  const steps = [];

  if (isLocal && availableToolIds.has(TOOL_IDS.NEARBY_BUSINESS_SEARCH)) {
    const coords = resolveCoordinates(cleanLocation || location);
    const businessType = extractBusinessType(cleanGoal);

    // Step 1: Discover nearby competitors and density
    steps.push({
      stepIndex: 1,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      toolName: "Nearby Business Search",
      description: `Discover competitors and analyze local density for ${businessType} in ${cleanLocation || "target area"}`,
      params: {
        businessType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: 3000,
        limit: 5,
      },
      status: "pending",
    });

    // Step 2: Fetch reviews for identified primary competitor (evidence-derived placeId)
    if (availableToolIds.has(TOOL_IDS.BUSINESS_REVIEWS_SEARCH)) {
      steps.push({
        stepIndex: 2,
        toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
        toolName: "Business Reviews Search",
        description: "Fetch customer reviews for identified primary local competitor",
        params: {
          businessId: null,
          limit: 5,
        },
        dependsOnStep: 1,
        status: "pending",
      });
    }

    // Step 3: Analyze sentiment, customer complaints, and market gaps from reviews
    if (availableToolIds.has(TOOL_IDS.REVIEW_SENTIMENT_ANALYZER)) {
      steps.push({
        stepIndex: 3,
        toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
        toolName: "Review Sentiment Analyzer",
        description: "Analyze customer sentiment, recurring complaints, and competitor gaps from reviews",
        params: {
          businessName: null,
          businessType,
          reviews: null,
        },
        dependsOnStep: 2,
        status: "pending",
      });
    }

    const planSummary =
      cleanGoal.length > 80
        ? `Analyze local market viability and competitor sentiment for: "${cleanGoal.slice(0, 80)}..."`
        : `Analyze local market viability and competitor sentiment for: "${cleanGoal}"`;

    return {
      summary: planSummary,
      category: "local",
      targetSteps: steps.length,
      steps,
      requiresApproval: true,
      createdAt: new Date(),
    };
  }

  // Default: Tech / Digital idea plan
  if (availableToolIds.has(TOOL_IDS.TECH_IDEA_ANALYSIS) || availableToolIds.has(techIdeaAnalysisDefinition.id)) {
    const techToolId = availableToolIds.has(TOOL_IDS.TECH_IDEA_ANALYSIS)
      ? TOOL_IDS.TECH_IDEA_ANALYSIS
      : techIdeaAnalysisDefinition.id;

    steps.push({
      stepIndex: 1,
      toolId: techToolId,
      toolName: techIdeaAnalysisDefinition.name,
      description:
        "Analyze technical feasibility, suggested tech stack, and market fit",
      params: {
        goal: cleanGoal,
        location: cleanLocation,
      },
      status: "pending",
    });
  }

  const planSummary =
    cleanGoal.length > 80
      ? `Investigate technology idea viability for: "${cleanGoal.slice(0, 80)}..."`
      : `Investigate technology idea viability for: "${cleanGoal}"`;

  return {
    summary: planSummary,
    category: "tech",
    targetSteps: steps.length,
    steps,
    requiresApproval: true,
    createdAt: new Date(),
  };
};

/**
 * Evaluate the next step decision for an agent run (advisory only).
 * This function NEVER executes tools, calls toolExecutor, or mutates run state.
 *
 * @param {Object} params
 * @param {string} params.runId - Agent run ID.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<Object>} Structured decision recommendation.
 */
/**
 * Deterministic step evaluation logic (advisory only).
 * Evaluates progress against planned steps and evidence without LLM calls.
 *
 * @param {Object} params
 * @param {Object} params.run - Agent run document.
 * @param {Array<Object>} params.steps - Recorded agent steps.
 * @param {Array<Object>} params.evidenceList - Grounded evidence list.
 * @returns {Object} Structured decision recommendation.
 */
const evaluateDeterministicNextStep = ({ run, steps, evidenceList }) => {
  const maxSteps = run.budget?.maxSteps || 8;
  if ((run.stepCount || 0) >= maxSteps) {
    return {
      action: "QUOTA_EXHAUSTED",
      message: "Budget limit reached for this run",
    };
  }

  const toolSteps = steps.filter((s) => s.type === "tool_execution");
  const failedSteps = toolSteps.filter((s) => s.status === "failed");
  const completedSteps = toolSteps.filter((s) => s.status === "completed");

  if (failedSteps.length > 0) {
    return {
      action: "FAIL",
      reason: "Previous tool step failed",
      failedStep: failedSteps[failedSteps.length - 1],
    };
  }

  const executedToolIds = new Set([
    ...completedSteps.map((s) => s.input?.toolId),
    ...evidenceList.map((e) => e.toolId),
  ]);
  const nextPlannedStep = run.plan.steps.find(
    (s) => !executedToolIds.has(s.toolId)
  );

  if (!nextPlannedStep) {
    return {
      action: "TRANSITION_SYNTHESIZING",
      message: "All planned steps have completed successfully",
    };
  }

  // Apply external-call quota guard only when about to recommend an external tool execution
  const nextToolDef = registry.getTool(nextPlannedStep.toolId);
  const isExternalTool = Boolean(nextToolDef?.external);
  if (isExternalTool) {
    const maxExternalCalls = run.budget?.maxExternalCalls || 5;
    if ((run.externalCallCount || 0) >= maxExternalCalls) {
      return {
        action: "QUOTA_EXHAUSTED",
        message: "External call budget limit reached for this run",
      };
    }
  }

  // Evidence-derived parameter extraction for next step
  if (nextPlannedStep.toolId === TOOL_IDS.TECH_IDEA_ANALYSIS) {
    return {
      action: "EXECUTE_TOOL",
      toolId: nextPlannedStep.toolId,
      input: nextPlannedStep.params,
      reasoning: nextPlannedStep.description,
      stepIndex: nextPlannedStep.stepIndex,
    };
  }

  if (nextPlannedStep.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH) {
    const existingParams =
      nextPlannedStep.params && typeof nextPlannedStep.params === "object"
        ? nextPlannedStep.params
        : {};
    const coords = resolveCoordinates(run.location);
    const isGeneric = (val) =>
      typeof val === "string" &&
      (val.trim().toLowerCase() === "local business" ||
        val.trim().toLowerCase() === "business");
    const hasSpecificType =
      typeof existingParams.businessType === "string" &&
      existingParams.businessType.trim() &&
      !isGeneric(existingParams.businessType);

    const businessType = hasSpecificType
      ? existingParams.businessType.trim()
      : extractBusinessType(run.goal);

    const latitude =
      typeof existingParams.latitude === "number" &&
      Number.isFinite(existingParams.latitude)
        ? existingParams.latitude
        : coords.latitude;

    const longitude =
      typeof existingParams.longitude === "number" &&
      Number.isFinite(existingParams.longitude)
        ? existingParams.longitude
        : coords.longitude;

    const input = {
      businessType,
      latitude,
      longitude,
      radius:
        typeof existingParams.radius === "number" &&
        Number.isFinite(existingParams.radius)
          ? existingParams.radius
          : 3000,
      limit:
        typeof existingParams.limit === "number" &&
        Number.isInteger(existingParams.limit)
          ? existingParams.limit
          : 5,
    };

    return {
      action: "EXECUTE_TOOL",
      toolId: nextPlannedStep.toolId,
      input,
      reasoning: nextPlannedStep.description || "Discover competitors and analyze local density",
      stepIndex: nextPlannedStep.stepIndex,
    };
  }

  if (nextPlannedStep.toolId === TOOL_IDS.BUSINESS_REVIEWS_SEARCH) {
    const competitorEvidenceList = evidenceList.filter(
      (e) =>
        (e.evidenceType === "competitor_discovery" ||
          e.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH) &&
        e.status !== "contradicted" &&
        e.status !== "stale"
    );
    const searchSteps = completedSteps.filter(
      (s) => s.input?.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH
    );

    if (competitorEvidenceList.length === 0 && searchSteps.length === 0) {
      return {
        action: "FAIL",
        reason:
          "Cannot execute business_reviews_search: Prerequisite nearby_business_search output is missing",
      };
    }

    const allDiscoveredBusinesses = [];
    for (const e of competitorEvidenceList) {
      if (Array.isArray(e.data?.businesses)) {
        allDiscoveredBusinesses.push(...e.data.businesses);
      }
    }
    for (const s of searchSteps) {
      if (Array.isArray(s.output?.businesses)) {
        allDiscoveredBusinesses.push(...s.output.businesses);
      }
    }

    // Deduplicate by verified placeId
    const seenPlaceIds = new Set();
    const businesses = [];
    for (const b of allDiscoveredBusinesses) {
      const pId = typeof b?.placeId === "string" ? b.placeId.trim() : null;
      if (pId && !seenPlaceIds.has(pId)) {
        seenPlaceIds.add(pId);
        businesses.push(b);
      }
    }

    if (businesses.length === 0) {
      return {
        action: "TRANSITION_SYNTHESIZING",
        message:
          "Nearby business search returned zero competitors; skipping review search to avoid fabricating entities and transitioning to synthesis with partial evidence.",
      };
    }

    const primaryCompetitor = businesses[0];
    const businessId =
      typeof primaryCompetitor?.placeId === "string"
        ? primaryCompetitor.placeId.trim()
        : "";

    if (!businessId) {
      return {
        action: "FAIL",
        reason: "Discovered competitor has missing or invalid placeId",
      };
    }

    const businessName =
      typeof primaryCompetitor?.name === "string" &&
      primaryCompetitor.name.trim()
        ? primaryCompetitor.name.trim()
        : undefined;

    const limit =
      typeof nextPlannedStep.params?.limit === "number"
        ? nextPlannedStep.params.limit
        : 5;

    const input = {
      businessId,
      limit,
    };
    if (businessName) {
      input.businessName = businessName;
    }

    return {
      action: "EXECUTE_TOOL",
      toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
      input,
      reasoning: businessName
        ? `Fetch customer reviews for competitor '${businessName}' (${businessId}) discovered from nearby search`
        : `Fetch customer reviews for competitor (${businessId}) discovered from nearby search`,
      stepIndex: nextPlannedStep.stepIndex,
    };
  }

  if (nextPlannedStep.toolId === TOOL_IDS.REVIEW_SENTIMENT_ANALYZER) {
    const allReviewsEvidence = evidenceList.filter(
      (e) =>
        (e.evidenceType === "customer_reviews" ||
          e.toolId === TOOL_IDS.BUSINESS_REVIEWS_SEARCH) &&
        e.status !== "contradicted" &&
        e.status !== "stale"
    );
    const allReviewsSteps = completedSteps.filter(
      (s) => s.input?.toolId === TOOL_IDS.BUSINESS_REVIEWS_SEARCH
    );

    const reviewsEvidence = allReviewsEvidence.length > 0
      ? allReviewsEvidence[allReviewsEvidence.length - 1]
      : null;
    const reviewsStep = allReviewsSteps.length > 0
      ? allReviewsSteps[allReviewsSteps.length - 1]
      : null;

    if (!reviewsEvidence && (!reviewsStep || !reviewsStep.output)) {
      return {
        action: "FAIL",
        reason:
          "Cannot execute review_sentiment_analyzer: Prerequisite business_reviews_search output is missing",
      };
    }

    let businessName = null;
    if (
      typeof reviewsEvidence?.data?.businessName === "string" &&
      reviewsEvidence.data.businessName.trim()
    ) {
      businessName = reviewsEvidence.data.businessName.trim();
    } else if (
      typeof reviewsStep?.output?.businessName === "string" &&
      reviewsStep.output.businessName.trim()
    ) {
      businessName = reviewsStep.output.businessName.trim();
    } else if (
      typeof reviewsStep?.input?.businessName === "string" &&
      reviewsStep.input.businessName.trim()
    ) {
      businessName = reviewsStep.input.businessName.trim();
    }

    if (!businessName) {
      return {
        action: "FAIL",
        reason:
          "Cannot execute review_sentiment_analyzer: Required business name evidence is missing from previous steps",
      };
    }

    const reviews = Array.isArray(reviewsEvidence?.data?.reviews)
      ? reviewsEvidence.data.reviews
      : Array.isArray(reviewsStep?.output?.reviews)
        ? reviewsStep.output.reviews
        : [];

    const allCompetitorEvidence = evidenceList.filter(
      (e) =>
        e.evidenceType === "competitor_discovery" ||
        e.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH
    );
    const competitorEvidence = allCompetitorEvidence.length > 0
      ? allCompetitorEvidence[allCompetitorEvidence.length - 1]
      : null;
    const searchStep = completedSteps.find(
      (s) => s.input?.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH
    );

    const businessType =
      (typeof competitorEvidence?.metadata?.params?.businessType === "string" &&
        competitorEvidence.metadata.params.businessType.trim()) ||
      (typeof searchStep?.input?.businessType === "string" &&
        searchStep.input.businessType.trim()) ||
      (typeof nextPlannedStep.params?.businessType === "string"
        ? nextPlannedStep.params.businessType.trim()
        : "business");

    return {
      action: "EXECUTE_TOOL",
      toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
      input: {
        businessName,
        businessType,
        reviews,
      },
      reasoning: `Analyze sentiment, complaints, and unmet needs from ${reviews.length} reviews for '${businessName}'`,
      stepIndex: nextPlannedStep.stepIndex,
    };
  }

  return {
    action: "EXECUTE_TOOL",
    toolId: nextPlannedStep.toolId,
    input: nextPlannedStep.params || {},
    reasoning: nextPlannedStep.description || "Execute planned tool step",
    stepIndex: nextPlannedStep.stepIndex,
  };
};

/**
 * Evaluate the next step decision for an agent run (advisory only).
 * Uses LLM adaptive decision with automatic deterministic fallback.
 * This function NEVER executes tools, calls toolExecutor, or mutates run state.
 *
 * @param {Object} params
 * @param {string} params.runId - Agent run ID.
 * @param {string} params.userId - Authenticated user ID.
 * @param {Object|null} [params.providerClient=null] - Optional Gemini client override.
 * @param {string|null} [params.model=null] - Optional Gemini model override.
 * @returns {Promise<Object>} Structured decision recommendation.
 */
const evaluateNextStep = async ({
  runId,
  userId,
  providerClient = null,
  model = null,
}) => {
  if (!ObjectId.isValid(runId)) {
    throw new PlannerError("Invalid run ID", "INVALID_RUN_ID", 400);
  }

  const run = await getAgentRunById({ id: runId, userId });
  if (!run) {
    throw new PlannerError(
      "Agent run not found or access denied",
      "RUN_NOT_FOUND",
      404
    );
  }

  // 1. Check terminal states first
  const terminalStates = new Set([
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);
  if (terminalStates.has(run.state)) {
    return {
      action: "TERMINAL",
      state: run.state,
      message: `Run is in terminal state '${run.state}'`,
    };
  }

  // 2. Check approval gate
  if (run.state === AGENT_STATES.AWAITING_APPROVAL) {
    return {
      action: "AWAIT_APPROVAL",
      message: "Plan requires user approval before execution can proceed",
      plan: run.plan,
    };
  }

  if (!run.plan) {
    throw new PlannerError(
      "No plan generated for this run yet",
      "PLAN_NOT_FOUND",
      400
    );
  }

  // 3. In EXECUTING state: evaluate progress with LLM adaptive decision and deterministic fallback
  if (run.state === AGENT_STATES.EXECUTING) {
    const steps = await getAgentStepsByRunId({ runId, userId });
    const evidenceList = await getAgentEvidenceByRunId({ runId, userId });

    try {
      const decision = await generateLLMDecision({
        run,
        steps,
        evidence: evidenceList,
        providerClient,
        model,
      });
      return decision;
    } catch (err) {
      const classification = classifyProviderError(err);

      // Quota Exhausted: transition to QUOTA_LIMITED, persist sanitized error, clear currentDecision
      if (classification.isQuota) {
        console.warn(
          `[LLM Decision] Gemini quota exhausted (${err.code || err.name}: ${err.message}). Transitioning run to QUOTA_LIMITED.`
        );
        try {
          await updateAgentRunState({
            runId,
            userId,
            nextState: AGENT_STATES.QUOTA_LIMITED,
            error: classification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          // If already in terminal state or transition error, ignore conflict
        }

        return {
          action: "TERMINAL",
          state: AGENT_STATES.QUOTA_LIMITED,
          reason: classification.sanitizedMessage,
          message: `Run halted: Gemini quota exhausted (${classification.sanitizedMessage})`,
          source: "provider_quota_exhausted",
        };
      }

      // Model Unavailable (404 / NOT_FOUND): transition to FAILED, persist sanitized error
      if (classification.isModelUnavailable) {
        console.warn(
          `[LLM Decision] Gemini model unavailable (${err.code || err.name}: ${err.message}). Transitioning run to FAILED.`
        );
        try {
          await updateAgentRunState({
            runId,
            userId,
            nextState: AGENT_STATES.FAILED,
            error: classification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          // If already in terminal state, ignore conflict
        }

        return {
          action: "TERMINAL",
          state: AGENT_STATES.FAILED,
          reason: classification.sanitizedMessage,
          message: `Run failed: Gemini model unavailable (${classification.sanitizedMessage})`,
          source: "provider_model_unavailable",
        };
      }

      // Temporary failure (timeout, 5xx, parse error, etc.): PRESERVE deterministic fallback!
      console.warn(
        `[LLM Decision] Failed to generate adaptive decision via LLM (${err.code || err.name}: ${err.message}). Falling back to deterministic decision.`
      );
      const fallbackDecision = evaluateDeterministicNextStep({
        run,
        steps,
        evidenceList,
      });
      return {
        ...fallbackDecision,
        source: "deterministic_fallback",
        fallbackReason: classification.sanitizedMessage || err.message || "LLM decision unavailable",
      };
    }
  }

  // 4. In SYNTHESIZING state: advisory recommendation to synthesize
  if (run.state === AGENT_STATES.SYNTHESIZING) {
    return {
      action: "SYNTHESIZE",
      message:
        "Run is in synthesizing state, ready for final recommendation generation",
    };
  }

  return {
    action: run.state.toUpperCase(),
    state: run.state,
    message: `Run is in state '${run.state}'`,
  };
};

/**
 * Generate an investigation plan using the LLM planner with automatic fallback
 * to the deterministic planner if LLM planning fails or is unavailable.
 *
 * @param {Object} params
 * @param {string} params.goal - Venture goal description.
 * @param {string|null} [params.location=null] - Optional location string.
 * @param {Object|null} [params.budget=null] - Optional budget object { maxSteps, ... }.
 * @param {Array<Object>|null} [params.availableTools=null] - Optional tool list.
 * @param {Object|null} [params.providerClient=null] - Optional Gemini client.
 * @param {string|null} [params.model=null] - Optional model identifier.
 * @returns {Promise<Object>} Structured plan object.
 */
const generatePlanWithFallback = async ({
  goal,
  location = null,
  budget = null,
  availableTools = null,
  providerClient = null,
  model = null,
  runId = null,
  userId = null,
}) => {
  try {
    const plan = await generateLLMPlan({
      goal,
      location,
      budget,
      availableTools,
      providerClient,
      model,
    });
    return plan;
  } catch (err) {
    const classification = classifyProviderError(err);

    // If quota exhausted: transition run to QUOTA_LIMITED and throw PlannerError
    if (classification.isQuota) {
      console.warn(
        `[LLM Planner] Gemini quota exhausted (${err.code || err.name}: ${err.message}).`
      );
      if (runId && userId) {
        try {
          await updateAgentRunState({
            runId,
            userId,
            nextState: AGENT_STATES.QUOTA_LIMITED,
            error: classification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          // If transition not possible, continue
        }
      }
      throw new PlannerError(
        `Gemini quota exhausted: ${classification.sanitizedMessage}`,
        "QUOTA_EXHAUSTED",
        429
      );
    }

    // If model unavailable (404): transition run to FAILED and throw PlannerError
    if (classification.isModelUnavailable) {
      console.warn(
        `[LLM Planner] Gemini model unavailable (${err.code || err.name}: ${err.message}).`
      );
      if (runId && userId) {
        try {
          await updateAgentRunState({
            runId,
            userId,
            nextState: AGENT_STATES.FAILED,
            error: classification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          // If transition not possible, continue
        }
      }
      throw new PlannerError(
        `Gemini model unavailable: ${classification.sanitizedMessage}`,
        "MODEL_UNAVAILABLE",
        404
      );
    }

    // Temporary failure (timeout, 5xx, parse error, etc.): PRESERVE deterministic fallback!
    console.warn(
      `[LLM Planner] Failed to generate plan via LLM (${err.code || err.name}: ${err.message}). Falling back to deterministic planner.`
    );
    const deterministicPlan = generatePlan({ goal, location });
    return {
      ...deterministicPlan,
      source: "deterministic_fallback",
      fallbackReason: classification.sanitizedMessage || err.message || "LLM planner unavailable",
      goalUnderstanding: deterministicPlan.summary,
      clarificationsNeeded: [],
    };
  }
};

export {
  PlannerError,
  LLMPlannerError,
  LLMDecisionError,
  evaluateDeterministicNextStep,
  evaluateNextStep,
  extractBusinessType,
  generatePlan,
  generatePlanWithFallback,
  resolveCoordinates,
};
