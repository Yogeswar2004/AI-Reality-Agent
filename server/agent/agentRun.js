import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import {
  AGENT_STATES,
  isValidAgentState,
  isValidTransition,
} from "./agentState.js";

const AGENT_RUNS_COLLECTION = "agent_runs";

const DEFAULT_BUDGET = Object.freeze({
  maxSteps: 8,
  maxExternalCalls: 5,
  maxSynthesisCalls: 2,
});

class AgentRunStateError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AgentRunStateError";
    this.code = code;
  }
}

const serializeAgentRun = (run) => ({
  ...run,
  _id: run._id.toString(),
});

const createAgentRun = async ({ userId, goal, location = null }) => {
  const now = new Date();

  const run = {
    userId,
    goal,
    location,
    state: AGENT_STATES.DRAFT,
    budget: { ...DEFAULT_BUDGET },
    stepCount: 0,
    externalCallCount: 0,
    synthesisCallCount: 0,
    // New Phase 2 fields
    error: null,
    cancellationReason: null,
    startedAt: null,
    completedAt: null,
    plan: null,
    finalOutput: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getDB()
    .collection(AGENT_RUNS_COLLECTION)
    .insertOne(run);

  return serializeAgentRun({
    _id: result.insertedId,
    ...run,
  });
};

const getAgentRunById = async ({ id, userId }) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const run = await getDB()
    .collection(AGENT_RUNS_COLLECTION)
    .findOne({
      _id: new ObjectId(id),
      userId,
    });

  if (!run) {
    return null;
  }

  return serializeAgentRun(run);
};

const updateAgentRunState = async ({
  runId,
  userId,
  nextState,
}) => {
  if (!isValidAgentState(nextState)) {
    throw new AgentRunStateError(
      "Invalid agent state",
      "INVALID_STATE"
    );
  }

  if (!ObjectId.isValid(runId)) {
    return null;
  }

  const collection = getDB().collection(AGENT_RUNS_COLLECTION);
  const currentRun = await collection.findOne({
    _id: new ObjectId(runId),
    userId,
  });

  if (!currentRun) {
    return null;
  }

  if (!isValidTransition(currentRun.state, nextState)) {
    throw new AgentRunStateError(
      `Invalid state transition from ${currentRun.state} to ${nextState}`,
      "INVALID_TRANSITION"
    );
  }

  const updateDoc = {
    state: nextState,
    updatedAt: new Date(),
  };

  // Set startedAt when entering EXECUTING (only if not already set)
  if (nextState === AGENT_STATES.EXECUTING && !currentRun.startedAt) {
    updateDoc.startedAt = new Date();
  }

  // Set completedAt when entering a terminal state (only if not already set)
  const terminalStates = new Set([
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);
  if (terminalStates.has(nextState) && !currentRun.completedAt) {
    updateDoc.completedAt = new Date();
  }

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: currentRun.state,
    },
    { $set: updateDoc },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state changed before this update could be applied",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const claimAgentRunStep = async ({ runId, userId, isExternal = false }) => {
  if (!ObjectId.isValid(runId)) {
    return null;
  }

  const collection = getDB().collection(AGENT_RUNS_COLLECTION);
  const currentRun = await collection.findOne({
    _id: new ObjectId(runId),
    userId,
  });

  if (!currentRun) {
    return null;
  }

  if (currentRun.state !== AGENT_STATES.EXECUTING) {
    throw new AgentRunStateError(
      `Cannot execute tools when run is in state '${currentRun.state}' (must be '${AGENT_STATES.EXECUTING}')`,
      "INVALID_STATE"
    );
  }

  const maxSteps = currentRun.budget?.maxSteps ?? DEFAULT_BUDGET.maxSteps;
  if ((currentRun.stepCount || 0) >= maxSteps) {
    throw new AgentRunStateError(
      `Budget exceeded: stepCount (${currentRun.stepCount || 0}) reached maxSteps (${maxSteps})`,
      "BUDGET_EXCEEDED"
    );
  }

  if (isExternal) {
    const maxExternal = currentRun.budget?.maxExternalCalls ?? DEFAULT_BUDGET.maxExternalCalls;
    if ((currentRun.externalCallCount || 0) >= maxExternal) {
      throw new AgentRunStateError(
        `Budget exceeded: externalCallCount (${currentRun.externalCallCount || 0}) reached maxExternalCalls (${maxExternal})`,
        "BUDGET_EXCEEDED"
      );
    }
  }

  const updateDoc = {
    $inc: {
      stepCount: 1,
      ...(isExternal ? { externalCallCount: 1 } : {}),
    },
    $set: {
      updatedAt: new Date(),
    },
  };

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: AGENT_STATES.EXECUTING,
      stepCount: currentRun.stepCount,
    },
    updateDoc,
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run step count or state changed before step could be claimed",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

// Indexes for agent_runs
const initAgentRunIndexes = async () => {
  try {
    const db = getDB();
    const collection = db.collection(AGENT_RUNS_COLLECTION);
    await collection.createIndex({ userId: 1, createdAt: -1 });
    console.log("Index ensured on agent_runs: { userId: 1, createdAt: -1 }");
  } catch (err) {
    // Ignore index creation errors (e.g., db not connected, index exists)
    console.warn("Failed to create index on agent_runs:", err.message);
  }
};

// Initialize indexes
initAgentRunIndexes().catch(console.error);

export {
  AGENT_RUNS_COLLECTION,
  DEFAULT_BUDGET,
  AgentRunStateError,
  claimAgentRunStep,
  createAgentRun,
  getAgentRunById,
  updateAgentRunState,
};
