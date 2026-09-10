import {
  AgentRunStateError,
  createAgentRun as createRun,
  getAgentRunById,
  updateAgentRunState as updateRunState,
} from "./agentRun.js";
import { getValidNextStates } from "./agentState.js";

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

export { createAgentRun, getAgentRun, updateAgentRunState };
