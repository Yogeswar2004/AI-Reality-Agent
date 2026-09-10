import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  createAgentRun,
  getAgentRun,
  updateAgentRunState,
} from "./agentController.js";
import stepRoutes from "./agentStepRoutes.js";

const router = express.Router();

router.post("/runs", authenticateToken, createAgentRun);
router.get("/runs/:id", authenticateToken, getAgentRun);
router.patch("/runs/:id/state", authenticateToken, updateAgentRunState);

// Nested routes for agent steps
router.use("/runs/:runId/steps", authenticateToken, stepRoutes);

export default router;
