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
  maxReplans: 1,
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
  conversationId: run.conversationId?.toString() || run.conversationId || null,
});

const createAgentRun = async ({ userId, goal, location = null, conversationId = null }) => {
  const now = new Date();

  const run = {
    userId,
    goal,
    location,
    conversationId: conversationId && ObjectId.isValid(conversationId) ? new ObjectId(String(conversationId)) : null,
    state: AGENT_STATES.DRAFT,
    budget: { ...DEFAULT_BUDGET },
    stepCount: 0,
    externalCallCount: 0,
    synthesisCallCount: 0,
    replanCount: 0,
    // New Phase 2 fields
    error: null,
    cancellationReason: null,
    clarification: null,
    currentDecision: null,
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
  cancellationReason = null,
  error = null,
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

  const now = new Date();
  const updateDoc = {
    state: nextState,
    updatedAt: now,
  };

  if (cancellationReason !== null && cancellationReason !== undefined) {
    if (typeof cancellationReason === "object" && cancellationReason !== null) {
      updateDoc.cancellationReason = {
        type: cancellationReason.type || "agent_stop",
        reason:
          typeof cancellationReason.reason === "string"
            ? cancellationReason.reason.trim()
            : "",
        summary:
          typeof cancellationReason.summary === "string"
            ? cancellationReason.summary.trim()
            : "",
      };
    } else if (typeof cancellationReason === "string") {
      updateDoc.cancellationReason = cancellationReason.trim();
    }
  }

  if (error !== null && error !== undefined) {
    updateDoc.error = typeof error === "string" ? error.trim() : null;
  }

  // Set startedAt when entering EXECUTING (only if not already set)
  if (nextState === AGENT_STATES.EXECUTING && !currentRun.startedAt) {
    updateDoc.startedAt = now;
  }

  // Set completedAt when entering a terminal state (only if not already set) and clear currentDecision
  const terminalStates = new Set([
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);
  if (terminalStates.has(nextState)) {
    updateDoc.currentDecision = null;
    if (!currentRun.completedAt) {
      updateDoc.completedAt = now;
    }
  }

  // If returning to EXECUTING from a resumable terminal state, clear terminal blockers
  if (terminalStates.has(currentRun.state) && nextState === AGENT_STATES.EXECUTING) {
    updateDoc.completedAt = null;
    updateDoc.cancellationReason = null;
    updateDoc.error = null;
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

const cancelAgentRun = async ({ runId, userId, reason = "Cancelled by user" }) => {
  const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim() : "Cancelled by user";
  return updateAgentRunState({
    runId,
    userId,
    nextState: AGENT_STATES.CANCELLED,
    cancellationReason: cleanReason,
  });
};

const resumeAgentRun = async ({ runId, userId }) => {
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

  const resumableStates = new Set([
    AGENT_STATES.CANCELLED,
    AGENT_STATES.FAILED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);

  if (!resumableStates.has(currentRun.state)) {
    throw new AgentRunStateError(
      `Cannot resume run in state '${currentRun.state}' (must be cancelled, failed, or quota_limited)`,
      "INVALID_STATE"
    );
  }

  return updateAgentRunState({
    runId,
    userId,
    nextState: AGENT_STATES.EXECUTING,
  });
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

const updateAgentRunPlan = async ({ runId, userId, plan }) => {
  if (!ObjectId.isValid(runId)) {
    return null;
  }

  const collection = getDB().collection(AGENT_RUNS_COLLECTION);
  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: new ObjectId(runId),
      userId,
    },
    {
      $set: {
        plan,
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    return null;
  }

  return serializeAgentRun(updatedRun);
};

const claimAgentRunSynthesis = async ({ runId, userId }) => {
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

  const allowedStates = new Set([
    AGENT_STATES.EXECUTING,
    AGENT_STATES.SYNTHESIZING,
  ]);
  if (!allowedStates.has(currentRun.state)) {
    throw new AgentRunStateError(
      `Cannot synthesize when run is in state '${currentRun.state}' (must be '${AGENT_STATES.EXECUTING}' or '${AGENT_STATES.SYNTHESIZING}')`,
      "INVALID_STATE"
    );
  }

  const maxSynthesis =
    currentRun.budget?.maxSynthesisCalls ?? DEFAULT_BUDGET.maxSynthesisCalls;
  if ((currentRun.synthesisCallCount || 0) >= maxSynthesis) {
    throw new AgentRunStateError(
      `Budget exceeded: synthesisCallCount (${currentRun.synthesisCallCount || 0}) reached maxSynthesisCalls (${maxSynthesis})`,
      "BUDGET_EXCEEDED"
    );
  }

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: currentRun.state,
      synthesisCallCount: currentRun.synthesisCallCount,
    },
    {
      $inc: { synthesisCallCount: 1 },
      $set: {
        state: AGENT_STATES.SYNTHESIZING,
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state or synthesis count changed before synthesis could be claimed",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const saveAgentRunFinalOutput = async ({
  runId,
  userId,
  finalOutput,
  nextState = AGENT_STATES.COMPLETED,
  error = null,
}) => {
  if (!ObjectId.isValid(runId)) {
    return null;
  }

  if (!isValidAgentState(nextState)) {
    throw new AgentRunStateError("Invalid agent state", "INVALID_STATE");
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

  const now = new Date();
  const updateDoc = {
    state: nextState,
    finalOutput: finalOutput || null,
    error: error || null,
    currentDecision: null,
    updatedAt: now,
  };

  const terminalStates = new Set([
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);
  if (terminalStates.has(nextState) && !currentRun.completedAt) {
    updateDoc.completedAt = now;
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
      "Agent run state changed before final output could be saved",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const setAgentRunClarification = async ({
  runId,
  userId,
  clarification,
  nextState = AGENT_STATES.AWAITING_CLARIFICATION,
}) => {
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
      `Cannot request clarification when run is in state '${currentRun.state}' (must be '${AGENT_STATES.EXECUTING}')`,
      "INVALID_STATE"
    );
  }

  // Prevent overwriting an existing pending clarification
  if (currentRun.clarification && currentRun.clarification.answer === null) {
    return serializeAgentRun(currentRun);
  }

  const now = new Date();
  const formattedClarification = {
    question:
      typeof clarification?.question === "string"
        ? clarification.question.trim()
        : "",
    options: Array.isArray(clarification?.options)
      ? clarification.options
          .map((o) => (typeof o === "string" ? o.trim() : String(o)))
          .filter(Boolean)
      : [],
    answer: null,
    askedAt:
      clarification?.askedAt instanceof Date
        ? clarification.askedAt
        : now,
    answeredAt: null,
  };

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: AGENT_STATES.EXECUTING,
    },
    {
      $set: {
        clarification: formattedClarification,
        state: nextState,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state changed before clarification could be set",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const recordAgentRunClarificationAnswer = async ({ runId, userId, answer }) => {
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

  if (currentRun.state !== AGENT_STATES.AWAITING_CLARIFICATION) {
    throw new AgentRunStateError(
      `Cannot answer clarification when run is in state '${currentRun.state}' (must be '${AGENT_STATES.AWAITING_CLARIFICATION}')`,
      "INVALID_STATE"
    );
  }

  if (!currentRun.clarification) {
    throw new AgentRunStateError(
      "No pending clarification request found for this run",
      "NO_PENDING_CLARIFICATION"
    );
  }

  if (currentRun.clarification.answer !== null) {
    throw new AgentRunStateError(
      "Clarification has already been answered",
      "ALREADY_ANSWERED"
    );
  }

  if (typeof answer !== "string" || !answer.trim()) {
    throw new AgentRunStateError("Answer must not be empty", "BLANK_ANSWER");
  }

  const cleanAnswer = answer.trim();

  if (cleanAnswer.length > 500) {
    throw new AgentRunStateError(
      "Answer must not exceed 500 characters",
      "ANSWER_TOO_LONG"
    );
  }

  const options = Array.isArray(currentRun.clarification.options)
    ? currentRun.clarification.options
    : [];

  if (options.length > 0) {
    const matched = options.find(
      (opt) =>
        typeof opt === "string" &&
        opt.trim().toLowerCase() === cleanAnswer.toLowerCase()
    );
    if (!matched) {
      throw new AgentRunStateError(
        `Answer must be one of the provided options: ${options.join(", ")}`,
        "INVALID_OPTION"
      );
    }
  }

  const now = new Date();
  const updatedClarification = {
    ...currentRun.clarification,
    answer: cleanAnswer,
    answeredAt: now,
  };

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: AGENT_STATES.AWAITING_CLARIFICATION,
    },
    {
      $set: {
        clarification: updatedClarification,
        state: AGENT_STATES.EXECUTING,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state changed before clarification answer could be recorded",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const stopAgentRun = async ({ runId, userId, stopMetadata }) => {
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
      `Cannot stop run when in state '${currentRun.state}' (must be '${AGENT_STATES.EXECUTING}')`,
      "INVALID_STATE"
    );
  }

  const now = new Date();
  const reason =
    typeof stopMetadata?.reason === "string" && stopMetadata.reason.trim()
      ? stopMetadata.reason.trim()
      : "Investigation stopped by agent";
  const summary =
    typeof stopMetadata?.summary === "string" && stopMetadata.summary.trim()
      ? stopMetadata.summary.trim()
      : reason;

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: AGENT_STATES.EXECUTING,
    },
    {
      $set: {
        state: AGENT_STATES.CANCELLED,
        cancellationReason: {
          type: "agent_stop",
          reason,
          summary,
        },
        completedAt: currentRun.completedAt || now,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state changed before stop could be applied",
      "STATE_CONFLICT"
    );
  }

  return serializeAgentRun(updatedRun);
};

const updateAgentRunCurrentDecision = async ({ runId, userId, currentDecision }) => {
  if (!ObjectId.isValid(runId)) {
    return null;
  }

  const collection = getDB().collection(AGENT_RUNS_COLLECTION);
  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: new ObjectId(runId),
      userId,
    },
    {
      $set: {
        currentDecision: currentDecision || null,
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    return null;
  }

  return serializeAgentRun(updatedRun);
};

const recordAgentRunReplan = async ({
  runId,
  userId,
  newPlan,
  replanReason = null,
}) => {
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

  const maxReplans =
    currentRun.budget?.maxReplans ?? DEFAULT_BUDGET.maxReplans;
  if ((currentRun.replanCount || 0) >= maxReplans) {
    throw new AgentRunStateError(
      `Budget exceeded: replanCount (${currentRun.replanCount || 0}) reached maxReplans (${maxReplans})`,
      "BUDGET_EXCEEDED"
    );
  }

  const now = new Date();
  const updateDoc = {
    $inc: { replanCount: 1 },
    $set: {
      plan: newPlan,
      state: AGENT_STATES.AWAITING_APPROVAL,
      updatedAt: now,
    },
  };

  const updatedRun = await collection.findOneAndUpdate(
    {
      _id: currentRun._id,
      userId,
      state: AGENT_STATES.PLANNING,
    },
    updateDoc,
    {
      returnDocument: "after",
      includeResultMetadata: false,
    }
  );

  if (!updatedRun) {
    throw new AgentRunStateError(
      "Agent run state changed before replan could be recorded",
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
    await collection.createIndex({ conversationId: 1 });
    console.log("Indexes ensured on agent_runs: { userId: 1, createdAt: -1 }, { conversationId: 1 }");
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
  claimAgentRunSynthesis,
  createAgentRun,
  getAgentRunById,
  saveAgentRunFinalOutput,
  updateAgentRunPlan,
  updateAgentRunState,
  cancelAgentRun,
  resumeAgentRun,
  setAgentRunClarification,
  recordAgentRunClarificationAnswer,
  stopAgentRun,
  updateAgentRunCurrentDecision,
  recordAgentRunReplan,
};
