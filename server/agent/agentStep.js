import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const AGENT_STEPS_COLLECTION = "agent_steps";

const VALID_STEP_TYPES = Object.freeze([
  "planning",
  "tool_execution",
  "evidence_gathering",
  "synthesis",
]);

const VALID_STEP_STATUSES = Object.freeze([
  "pending",
  "running",
  "completed",
  "failed",
]);

class AgentStepError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AgentStepError";
    this.code = code;
  }
}

const serializeAgentStep = (step) => ({
  ...step,
  _id: step._id.toString(),
  runId: step.runId.toString(),
});

const createAgentStep = async ({ runId, stepNumber, type, input, metadata = null }) => {
  // Validate runId
  if (!ObjectId.isValid(runId)) {
    throw new AgentStepError("Invalid run ID", "INVALID_RUN_ID");
  }

  // Validate type
  if (!VALID_STEP_TYPES.includes(type)) {
    throw new AgentStepError(`Invalid step type: ${type}`, "INVALID_STEP_TYPE");
  }

  // Validate input is an object (or at least not null/undefined? We'll allow any JSON)
  if (typeof input !== "object" || input === null) {
    throw new AgentStepError("Step input must be a JSON object", "INVALID_INPUT");
  }

  // Validate stepNumber is a positive integer
  if (typeof stepNumber !== "number" || !Number.isInteger(stepNumber) || stepNumber < 1) {
    throw new AgentStepError("stepNumber must be a positive integer", "INVALID_STEP_NUMBER");
  }

  const now = new Date();

  const step = {
    runId: new ObjectId(runId),
    stepNumber,
    type,
    status: "pending", // default status
    input,
    output: null,
    error: null,
    startedAt: null,
    completedAt: null,
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getDB()
    .collection(AGENT_STEPS_COLLECTION)
    .insertOne(step);

  return serializeAgentStep({
    _id: result.insertedId,
    ...step,
  });
};

const getAgentStepsByRunId = async ({ runId, userId }) => {
  // Validate runId
  if (!ObjectId.isValid(runId)) {
    return [];
  }

  // First, verify that the run belongs to the user (ownership)
  const runsCollection = getDB().collection("agent_runs");
  const run = await runsCollection.findOne({
    _id: new ObjectId(runId),
    userId,
  });

  if (!run) {
    return []; // run not found or not owned by user
  }

  const steps = await getDB()
    .collection(AGENT_STEPS_COLLECTION)
    .find({ runId: new ObjectId(runId) })
    .sort({ stepNumber: 1 })
    .toArray();

  return steps.map(serializeAgentStep);
};

const getAgentStepById = async ({ id, runId, userId }) => {
  if (!ObjectId.isValid(id) || !ObjectId.isValid(runId)) {
    return null;
  }

  // Verify run ownership
  const runsCollection = getDB().collection("agent_runs");
  const run = await runsCollection.findOne({
    _id: new ObjectId(runId),
    userId,
  });

  if (!run) {
    return null;
  }

  const step = await getDB()
    .collection(AGENT_STEPS_COLLECTION)
    .findOne({
      _id: new ObjectId(id),
      runId: new ObjectId(runId),
    });

  if (!step) {
    return null;
  }

  return serializeAgentStep(step);
};

const updateAgentStep = async ({ stepId, runId, userId, updates }) => {
  if (!ObjectId.isValid(stepId) || !ObjectId.isValid(runId)) {
    return null;
  }

  // Verify run ownership
  const runsCollection = getDB().collection("agent_runs");
  const run = await runsCollection.findOne({
    _id: new ObjectId(runId),
    userId,
  });

  if (!run) {
    return null;
  }

  // Allowed fields to update
  const allowedUpdates = ["status", "output", "error", "startedAt", "completedAt", "metadata"];
  const updateDoc = {};
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      updateDoc[key] = updates[key];
    }
  }

  if (Object.keys(updateDoc).length === 0) {
    // Nothing to update
    return await getAgentStepById({ id: stepId, runId, userId });
  }

  updateDoc.updatedAt = new Date();

  const result = await getDB()
    .collection(AGENT_STEPS_COLLECTION)
    .findOneAndUpdate(
      {
        _id: new ObjectId(stepId),
        runId: new ObjectId(runId),
      },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

  if (!result.value) {
    return null;
  }

  return serializeAgentStep(result.value);
};

// Indexes for agent_steps
const initAgentStepIndexes = async () => {
  try {
    const db = getDB();
    const collection = db.collection(AGENT_STEPS_COLLECTION);
    await collection.createIndex({ runId: 1, stepNumber: 1 });
    console.log("Index ensured on agent_steps: { runId: 1, stepNumber: 1 }");
  } catch (err) {
    // Ignore index creation errors (e.g., db not connected, index exists)
    console.warn("Failed to create index on agent_steps:", err.message);
  }
};

// Initialize indexes
initAgentStepIndexes().catch(console.error);

export {
  AGENT_STEPS_COLLECTION,
  VALID_STEP_TYPES,
  VALID_STEP_STATUSES,
  AgentStepError,
  createAgentStep,
  getAgentStepsByRunId,
  getAgentStepById,
  updateAgentStep,
};