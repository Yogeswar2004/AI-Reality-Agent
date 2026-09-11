import {
  AgentRunStateError,
  createAgentRun as createRun,
  getAgentRunById,
  updateAgentRunState as updateRunState,
} from "./agentRun.js";
import { getValidNextStates } from "./agentState.js";
import { ToolExecutorError, executeToolStep } from "./toolExecutor.js";

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

export { createAgentRun, executeTool, getAgentRun, updateAgentRunState };
