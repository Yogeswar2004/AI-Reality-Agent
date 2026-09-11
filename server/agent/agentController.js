import { ObjectId } from "mongodb";
import {
  AgentRunStateError,
  createAgentRun as createRun,
  getAgentRunById,
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
  try {
    const runId = req.params.id;
    const userId = req.user.userId;
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

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ToolExecutorError) {
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

    return res.status(200).json({
      success: true,
      run: updatedRun,
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

export {
  approveRunPlan,
  createAgentRun,
  executeTool,
  generateRunPlan,
  getAgentRun,
  getNextDecision,
  getRunPlan,
  updateAgentRunState,
};
