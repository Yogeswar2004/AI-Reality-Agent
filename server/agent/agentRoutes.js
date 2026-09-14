import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  approveRunPlan,
  cancelAgentRun,
  createAgentRun,
  executeTool,
  generateRunPlan,
  getAgentRun,
  getAgentRunStatus,
  getNextDecision,
  getRunEvidence,
  getRunFinalOutput,
  getRunPlan,
  submitClarificationAnswer,
  synthesizeRunOutput,
  updateAgentRunState,
  createConversationHandler,
  listConversationsHandler,
  getConversationHandler,
  postConversationMessageHandler,
} from "./agentController.js";
import stepRoutes from "./agentStepRoutes.js";

const router = express.Router();

// Conversation endpoints
router.post("/conversations", authenticateToken, createConversationHandler);
router.get("/conversations", authenticateToken, listConversationsHandler);
router.get("/conversations/:id", authenticateToken, getConversationHandler);
router.post("/conversations/:id/messages", authenticateToken, postConversationMessageHandler);

router.post("/runs", authenticateToken, createAgentRun);
router.get("/runs/:id", authenticateToken, getAgentRun);
router.get("/runs/:id/status", authenticateToken, getAgentRunStatus);
router.patch("/runs/:id/state", authenticateToken, updateAgentRunState);
router.post("/runs/:id/cancel", authenticateToken, cancelAgentRun);
router.post("/runs/:id/execute-tool", authenticateToken, executeTool);
router.get("/runs/:id/evidence", authenticateToken, getRunEvidence);

// Planner advisory, clarification, and approval endpoints
router.post("/runs/:id/plan", authenticateToken, generateRunPlan);
router.get("/runs/:id/plan", authenticateToken, getRunPlan);
router.get("/runs/:id/next-decision", authenticateToken, getNextDecision);
router.post("/runs/:id/approve-plan", authenticateToken, approveRunPlan);
router.post("/runs/:id/clarification", authenticateToken, submitClarificationAnswer);

// Synthesis endpoints
router.post("/runs/:id/synthesize", authenticateToken, synthesizeRunOutput);
router.get("/runs/:id/final-output", authenticateToken, getRunFinalOutput);

// Nested routes for agent steps
router.use("/runs/:runId/steps", authenticateToken, stepRoutes);

export default router;
