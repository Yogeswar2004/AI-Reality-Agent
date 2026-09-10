import { ObjectId } from "mongodb";
import {
  createAgentStep,
  getAgentStepsByRunId,
} from "./agentStep.js";

const createStep = async (req, res) => {
  try {
    const runId = req.params.runId;
    const userId = req.user.userId; // from authenticateToken middleware

    // Ownership check: verify the run exists and belongs to the user
    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid run ID",
      });
    }

    const run = await getDB()
      .collection("agent_runs")
      .findOne({ _id: new ObjectId(runId), userId });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Run not found or access denied",
      });
    }

    const { stepNumber, type, input, metadata } = req.body;

    // Validate required fields
    if (typeof stepNumber !== "number" || !Number.isInteger(stepNumber) || stepNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "stepNumber must be a positive integer",
      });
    }

    if (typeof type !== "string" || !type.trim()) {
      return res.status(400).json({
        success: false,
        message: "step type is required",
      });
    }

    if (typeof input !== "object" || input === null) {
      return res.status(400).json({
        success: false,
        message: "step input must be a JSON object",
      });
    }

    const step = await createAgentStep({
      runId,
      stepNumber,
      type: type.trim(),
      input,
      metadata: metadata ?? null,
    });

    return res.status(201).json({
      success: true,
      step,
    });
  } catch (error) {
    console.error("Create agent step error:", error);
    if (error.name === "AgentStepError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create agent step",
    });
  }
};

const getSteps = async (req, res) => {
  try {
    const runId = req.params.runId;
    const userId = req.user.userId;

    const steps = await getAgentStepsByRunId({ runId, userId });

    return res.status(200).json({
      success: true,
      steps,
    });
  } catch (error) {
    console.error("Get agent steps error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent steps",
    });
  }
};

export { createStep, getSteps };