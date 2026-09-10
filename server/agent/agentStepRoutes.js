import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { createStep, getSteps } from "./agentStepController.js";

const router = express.Router();

// POST /api/agent/runs/:runId/steps
router.post("/", authenticateToken, createStep);

// GET /api/agent/runs/:runId/steps
router.get("/", authenticateToken, getSteps);

export default router;