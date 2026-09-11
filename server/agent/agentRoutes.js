import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  approveRunPlan,
  createAgentRun,
  executeTool,
  generateRunPlan,
  getAgentRun,
  getNextDecision,
  getRunPlan,
  updateAgentRunState,
} from "./agentController.js";
import stepRoutes from "./agentStepRoutes.js";

const router = express.Router();

router.post("/runs", authenticateToken, createAgentRun);
router.get("/runs/:id", authenticateToken, getAgentRun);
router.patch("/runs/:id/state", authenticateToken, updateAgentRunState);
router.post("/runs/:id/execute-tool", authenticateToken, executeTool);

// Planner advisory and approval endpoints
router.post("/runs/:id/plan", authenticateToken, generateRunPlan);
router.get("/runs/:id/plan", authenticateToken, getRunPlan);
router.get("/runs/:id/next-decision", authenticateToken, getNextDecision);
router.post("/runs/:id/approve-plan", authenticateToken, approveRunPlan);

// Nested routes for agent steps
router.use("/runs/:runId/steps", authenticateToken, stepRoutes);

export default router;
