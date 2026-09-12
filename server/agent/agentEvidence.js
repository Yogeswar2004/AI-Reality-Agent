import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const AGENT_EVIDENCE_COLLECTION = "agent_evidence";

const VALID_EVIDENCE_TYPES = Object.freeze([
  "tech_assessment",
  "competitor_discovery",
  "customer_reviews",
  "sentiment_analysis",
]);

const VALID_EVIDENCE_PROVIDERS = Object.freeze([
  "rapidapi",
  "gemini",
  "internal_fixture",
]);

const VALID_EVIDENCE_STATUSES = Object.freeze([
  "valid",
  "contradicted",
  "stale",
]);

class AgentEvidenceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AgentEvidenceError";
    this.code = code;
  }
}

const serializeAgentEvidence = (evidence) => ({
  ...evidence,
  _id: evidence._id.toString(),
  runId: evidence.runId.toString(),
  stepId: evidence.stepId.toString(),
});

const createAgentEvidence = async ({
  runId,
  stepId,
  userId,
  toolId,
  evidenceType,
  data,
  provider,
  status = "valid",
  retrievedAt = new Date(),
  confidence = null,
  metadata = null,
}) => {
  if (!ObjectId.isValid(runId)) {
    throw new AgentEvidenceError("Invalid run ID", "INVALID_RUN_ID");
  }

  if (!ObjectId.isValid(stepId)) {
    throw new AgentEvidenceError("Invalid step ID", "INVALID_STEP_ID");
  }

  if (typeof userId !== "string" || !userId.trim()) {
    throw new AgentEvidenceError("userId must be a non-empty string", "INVALID_USER_ID");
  }

  if (typeof toolId !== "string" || !toolId.trim()) {
    throw new AgentEvidenceError("toolId must be a non-empty string", "INVALID_TOOL_ID");
  }

  if (!VALID_EVIDENCE_TYPES.includes(evidenceType)) {
    throw new AgentEvidenceError(
      `Invalid evidence type: ${evidenceType}`,
      "INVALID_EVIDENCE_TYPE"
    );
  }

  if (!VALID_EVIDENCE_PROVIDERS.includes(provider)) {
    throw new AgentEvidenceError(
      `Invalid provider: ${provider}`,
      "INVALID_PROVIDER"
    );
  }

  if (!VALID_EVIDENCE_STATUSES.includes(status)) {
    throw new AgentEvidenceError(
      `Invalid evidence status: ${status}`,
      "INVALID_STATUS"
    );
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new AgentEvidenceError(
      "Evidence data must be an object",
      "INVALID_DATA"
    );
  }

  if (
    confidence !== null &&
    confidence !== undefined &&
    typeof confidence !== "number" &&
    typeof confidence !== "string"
  ) {
    throw new AgentEvidenceError(
      "Confidence must be a number, string, or null",
      "INVALID_CONFIDENCE"
    );
  }

  const now = new Date();
  const parsedRetrievedAt =
    retrievedAt instanceof Date ? retrievedAt : new Date(retrievedAt);

  const evidenceDoc = {
    runId: new ObjectId(runId),
    stepId: new ObjectId(stepId),
    userId: userId.trim(),
    toolId: toolId.trim(),
    evidenceType,
    data,
    provider,
    status,
    retrievedAt: isNaN(parsedRetrievedAt.getTime()) ? now : parsedRetrievedAt,
    confidence:
      typeof confidence === "number" ||
      (typeof confidence === "string" && confidence.trim())
        ? confidence
        : null,
    metadata: typeof metadata === "object" ? metadata : null,
    createdAt: now,
    updatedAt: now,
  };

  const collection = getDB().collection(AGENT_EVIDENCE_COLLECTION);

  try {
    const result = await collection.insertOne(evidenceDoc);
    return serializeAgentEvidence({
      _id: result.insertedId,
      ...evidenceDoc,
    });
  } catch (err) {
    // Handle duplicate key error for { runId: 1, stepId: 1 } idempotently
    if (err.code === 11000) {
      const existing = await collection.findOne({
        runId: new ObjectId(runId),
        stepId: new ObjectId(stepId),
      });
      if (existing) {
        return serializeAgentEvidence(existing);
      }
    }
    throw err;
  }
};

const getAgentEvidenceByRunId = async ({
  runId,
  userId,
  evidenceType = null,
}) => {
  if (!ObjectId.isValid(runId)) {
    return [];
  }

  if (typeof userId !== "string" || !userId.trim()) {
    return [];
  }

  // Verify run ownership
  const runsCollection = getDB().collection("agent_runs");
  const run = await runsCollection.findOne({
    _id: new ObjectId(runId),
    userId: userId.trim(),
  });

  if (!run) {
    return [];
  }

  const query = {
    runId: new ObjectId(runId),
  };

  if (evidenceType && VALID_EVIDENCE_TYPES.includes(evidenceType)) {
    query.evidenceType = evidenceType;
  }

  const items = await getDB()
    .collection(AGENT_EVIDENCE_COLLECTION)
    .find(query)
    .sort({ createdAt: 1 })
    .toArray();

  return items.map(serializeAgentEvidence);
};

// Indexes for agent_evidence
const initAgentEvidenceIndexes = async () => {
  try {
    const db = getDB();
    const collection = db.collection(AGENT_EVIDENCE_COLLECTION);
    await collection.createIndex({ runId: 1, stepId: 1 }, { unique: true });
    await collection.createIndex({ userId: 1, runId: 1, createdAt: -1 });
    await collection.createIndex({ runId: 1, evidenceType: 1 });
  } catch (err) {
    // Ignore index creation errors (e.g., db not connected, index exists)
    console.warn("Failed to create index on agent_evidence:", err.message);
  }
};

// Initialize indexes
initAgentEvidenceIndexes().catch(console.error);

export {
  AGENT_EVIDENCE_COLLECTION,
  VALID_EVIDENCE_TYPES,
  VALID_EVIDENCE_PROVIDERS,
  VALID_EVIDENCE_STATUSES,
  AgentEvidenceError,
  serializeAgentEvidence,
  createAgentEvidence,
  getAgentEvidenceByRunId,
};
