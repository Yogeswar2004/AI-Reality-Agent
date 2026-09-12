import { ObjectId } from "mongodb";
import {
  AgentRunStateError,
  cancelAgentRun as cancelRunHelper,
  claimAgentRunSynthesis,
  createAgentRun as createRun,
  getAgentRunById,
  saveAgentRunFinalOutput,
  updateAgentRunPlan,
  updateAgentRunState as updateRunState,
} from "./agentRun.js";
import {
  createAgentStep,
  getAgentStepsByRunId,
  updateAgentStep,
} from "./agentStep.js";
import { AGENT_STATES, getValidNextStates } from "./agentState.js";
import { ToolExecutorError, executeToolStep } from "./toolExecutor.js";
import {
  PlannerError,
  evaluateNextStep,
  generatePlan,
} from "./planner.js";
import {
  SynthesizerError,
  synthesizeFinalRecommendation,
} from "./synthesizer.js";

const createAgentRun = async (req, res) => {
  try {
    const goal = typeof req.body.goal === "string"
      ? req.body.goal.trim()
      : "";

    const location = typeof req.body.location === "string"
      ? req.body.location.trim() || null
      : null;

    if (!goal) {
      return res.status(400).json({
        success: false,
        message: "A goal is required",
      });
    }

    const run = await createRun({
      userId: req.user.userId,
      goal,
      location,
    });

    return res.status(201).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    console.error("Create agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create agent run",
    });
  }
};

const getAgentRun = async (req, res) => {
  try {
    const run = await getAgentRunById({
      id: req.params.id,
      userId: req.user.userId,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    console.error("Get agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent run",
    });
  }
};

const updateAgentRunState = async (req, res) => {
  try {
    const nextState = typeof req.body.state === "string"
      ? req.body.state.trim()
      : "";

    if (!nextState) {
      return res.status(400).json({
        success: false,
        message: "A target state is required",
      });
    }

    const run = await updateRunState({
      runId: req.params.id,
      userId: req.user.userId,
      nextState,
      cancellationReason: req.body.cancellationReason,
      error: req.body.error,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update agent run state error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update agent run state",
    });
  }
};

const executeTool = async (req, res) => {
  const runId = req.params.id;
  const userId = req.user.userId;
  try {
    const { toolId, input = {} } = req.body;

    if (!toolId || typeof toolId !== "string") {
      return res.status(400).json({
        success: false,
        message: "toolId is required",
      });
    }

    const result = await executeToolStep({
      runId,
      userId,
      toolId: toolId.trim(),
      input,
    });

    let nextDecision = null;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after tool execution:",
        evalErr?.message
      );
    }

    return res.status(200).json({
      ...result,
      nextDecision,
    });
  } catch (error) {
    if (error instanceof ToolExecutorError) {
      if (error.code === "BUDGET_EXCEEDED") {
        try {
          await updateRunState({
            runId,
            userId,
            nextState: AGENT_STATES.QUOTA_LIMITED,
          });
        } catch (stateErr) {
          // Ignore if transition not permitted or already in terminal state
        }
      }
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Execute tool error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to execute tool",
    });
  }
};

const generateRunPlan = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const allowedPlanningStates = new Set([
      AGENT_STATES.DRAFT,
      AGENT_STATES.PLANNING,
    ]);
    if (!allowedPlanningStates.has(run.state)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot generate plan for run in state '${run.state}'`,
      });
    }

    // 1. If in DRAFT, transition to PLANNING
    if (run.state === AGENT_STATES.DRAFT) {
      await updateRunState({
        runId,
        userId,
        nextState: AGENT_STATES.PLANNING,
      });
    }

    // 2. Call advisory planner to generate plan object
    const plan = generatePlan({
      goal: run.goal,
      location: run.location,
    });

    // 3. Persist plan on run document
    await updateAgentRunPlan({ runId, userId, plan });

    // 4. Record an auditable 'planning' step in agent_steps
    const existingSteps = await getAgentStepsByRunId({ runId, userId });
    const stepNumber = existingSteps.length + 1;

    const initialStep = await createAgentStep({
      runId,
      stepNumber,
      type: "planning",
      input: {
        goal: run.goal,
        location: run.location,
      },
      metadata: {
        targetSteps: plan.steps.length,
        requiresApproval: true,
      },
    });

    await updateAgentStep({
      stepId: initialStep._id,
      runId,
      userId,
      updates: {
        status: "completed",
        output: plan,
        completedAt: new Date(),
      },
    });

    // 5. Explicit approval boundary: transition to AWAITING_APPROVAL (never automatic EXECUTING)
    const updatedRun = await updateRunState({
      runId,
      userId,
      nextState: AGENT_STATES.AWAITING_APPROVAL,
    });

    return res.status(200).json({
      success: true,
      plan,
      run: updatedRun,
    });
  } catch (error) {
    if (error instanceof PlannerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Generate run plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate plan",
    });
  }
};

const getRunPlan = async (req, res) => {
  try {
    const run = await getAgentRunById({
      id: req.params.id,
      userId: req.user.userId,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      plan: run.plan,
      runId: run._id,
      state: run.state,
    });
  } catch (error) {
    console.error("Get run plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
    });
  }
};

const getNextDecision = async (req, res) => {
  try {
    const decision = await evaluateNextStep({
      runId: req.params.id,
      userId: req.user.userId,
    });

    return res.status(200).json({
      success: true,
      decision,
    });
  } catch (error) {
    if (error instanceof PlannerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Get next decision error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to evaluate next decision",
    });
  }
};

const approveRunPlan = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    if (run.state !== AGENT_STATES.AWAITING_APPROVAL) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot approve plan when run is in state '${run.state}' (must be '${AGENT_STATES.AWAITING_APPROVAL}')`,
      });
    }

    const updatedRun = await updateRunState({
      runId,
      userId,
      nextState: AGENT_STATES.EXECUTING,
    });

    let nextDecision = null;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after plan approval:",
        evalErr?.message
      );
    }

    return res.status(200).json({
      success: true,
      run: updatedRun,
      nextDecision,
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Approve plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve plan",
    });
  }
};

const synthesizeRunOutput = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const allowedStates = new Set([
      AGENT_STATES.EXECUTING,
      AGENT_STATES.SYNTHESIZING,
    ]);
    if (!allowedStates.has(run.state)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot synthesize run in state '${run.state}' (must be '${AGENT_STATES.EXECUTING}' or '${AGENT_STATES.SYNTHESIZING}')`,
      });
    }

    // 1. Claim synthesis quota & transition state to SYNTHESIZING
    const claimedRun = await claimAgentRunSynthesis({ runId, userId });

    // 2. Fetch all steps for synthesis input and compute collision-safe stepNumber
    const existingSteps = await getAgentStepsByRunId({ runId, userId });
    const maxNonSynthStep = existingSteps
      .filter((s) => s.type !== "synthesis")
      .reduce((max, s) => Math.max(max, s.stepNumber || 0), 0);
    const maxExistingStep = existingSteps.reduce(
      (max, s) => Math.max(max, s.stepNumber || 0),
      0
    );
    const stepNumber = Math.max(
      maxNonSynthStep + (claimedRun.synthesisCallCount || 1),
      maxExistingStep + 1
    );

    // 3. Record auditable 'synthesis' step
    const synthStep = await createAgentStep({
      runId,
      stepNumber,
      type: "synthesis",
      input: {
        trigger: "explicit_synthesis_request",
      },
      metadata: {
        synthesisAttempt: claimedRun.synthesisCallCount,
      },
    });

    await updateAgentStep({
      stepId: synthStep._id,
      runId,
      userId,
      updates: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // 4. Run pure, deterministic synthesizer
    let finalOutput;
    try {
      finalOutput = synthesizeFinalRecommendation({
        run: claimedRun,
        steps: existingSteps,
      });
    } catch (synthErr) {
      await updateAgentStep({
        stepId: synthStep._id,
        runId,
        userId,
        updates: {
          status: "failed",
          error: synthErr.message,
          completedAt: new Date(),
        },
      });

      await saveAgentRunFinalOutput({
        runId,
        userId,
        finalOutput: null,
        nextState: AGENT_STATES.FAILED,
        error: synthErr.message,
      });

      throw synthErr;
    }

    // 5. Finalize synthesis step as completed
    await updateAgentStep({
      stepId: synthStep._id,
      runId,
      userId,
      updates: {
        status: "completed",
        output: finalOutput,
        completedAt: new Date(),
      },
    });

    // 6. Transition run to COMPLETED and persist finalOutput
    const completedRun = await saveAgentRunFinalOutput({
      runId,
      userId,
      finalOutput,
      nextState: AGENT_STATES.COMPLETED,
    });

    return res.status(200).json({
      success: true,
      finalOutput,
      run: completedRun,
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      const statusCode = error.code === "BUDGET_EXCEEDED" ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof SynthesizerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Synthesize run output error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synthesize final recommendation",
    });
  }
};

const getRunFinalOutput = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      finalOutput: run.finalOutput,
      state: run.state,
      runId: run._id,
    });
  } catch (error) {
    console.error("Get run final output error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch final output",
    });
  }
};

const cancelAgentRun = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await cancelRunHelper({
      runId,
      userId,
      reason,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Cancel agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel agent run",
    });
  }
};

const getAgentRunStatus = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const steps = await getAgentStepsByRunId({ runId, userId });

    let nextDecision = null;
    if (run.plan) {
      try {
        nextDecision = await evaluateNextStep({ runId, userId });
      } catch (evalErr) {
        console.warn(
          "Could not evaluate next decision for run status:",
          evalErr?.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      runId: run._id,
      state: run.state,
      stepCount: run.stepCount,
      externalCallCount: run.externalCallCount,
      budget: run.budget,
      plan: run.plan,
      hasFinalOutput: Boolean(run.finalOutput),
      stepSummary: {
        total: steps.length,
        completed: steps.filter((s) => s.status === "completed").length,
        failed: steps.filter((s) => s.status === "failed").length,
        running: steps.filter((s) => s.status === "running").length,
      },
      nextDecision,
      validNextStates: getValidNextStates(run.state),
      completedAt: run.completedAt,
      cancellationReason: run.cancellationReason,
      error: run.error,
    });
  } catch (error) {
    console.error("Get agent run status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent run status",
    });
  }
};

export {
  approveRunPlan,
  cancelAgentRun,
  createAgentRun,
  executeTool,
  generateRunPlan,
  getAgentRun,
  getAgentRunStatus,
  getNextDecision,
  getRunFinalOutput,
  getRunPlan,
  synthesizeRunOutput,
  updateAgentRunState,
};
