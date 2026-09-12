import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB, getDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import ideaRoutes from "./routes/ideaRoutes.js";
import agentRoutes from "./agent/agentRoutes.js";
import { AGENT_RUNS_COLLECTION } from "./agent/agentRun.js";
import { AGENT_STEPS_COLLECTION } from "./agent/agentStep.js";
import { AGENT_EVIDENCE_COLLECTION } from "./agent/agentEvidence.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "https://reality-analyzer.vercel.app",
];

if (process.env.CLIENT_ORIGIN) {
  const origins = process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  for (const origin of origins) {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  }
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
res.json({
message: "AI Project Reality Analyzer API is running 🚀",
});
});

app.get("/api/health", (req, res) => {
res.json({
success: true,
message: "Server is healthy",
});
});

app.use("/api/auth", authRoutes);
app.use("/api/ideas", ideaRoutes);
app.use("/api/agent", agentRoutes);

const ensureAgentRunIndexes = async () => {
  const db = getDB();
  const collection = db.collection(AGENT_RUNS_COLLECTION);
  await collection.createIndex({ userId: 1, createdAt: -1 });
  console.log("Index ensured on agent_runs: { userId: 1, createdAt: -1 }");
};

const ensureAgentStepIndexes = async () => {
  const db = getDB();
  const collection = db.collection(AGENT_STEPS_COLLECTION);
  await collection.createIndex({ runId: 1, stepNumber: 1 });
  console.log("Index ensured on agent_steps: { runId: 1, stepNumber: 1 }");
};

const ensureAgentEvidenceIndexes = async () => {
  const db = getDB();
  const collection = db.collection(AGENT_EVIDENCE_COLLECTION);
  await collection.createIndex({ runId: 1, stepId: 1 }, { unique: true });
  await collection.createIndex({ userId: 1, runId: 1, createdAt: -1 });
  await collection.createIndex({ runId: 1, evidenceType: 1 });
  console.log("Indexes ensured on agent_evidence: { runId: 1, stepId: 1 }, { userId: 1, runId: 1, createdAt: -1 }, { runId: 1, evidenceType: 1 }");
};

const startServer = async () => {
  await connectDB();
  await ensureAgentRunIndexes();
  await ensureAgentStepIndexes();
  await ensureAgentEvidenceIndexes();

  app.listen(PORT, () => {
    console.log(
      `Server running on port ${PORT}`
    );
  });
};

startServer();

export {
  app,
  startServer,
  ensureAgentRunIndexes,
  ensureAgentStepIndexes,
  ensureAgentEvidenceIndexes,
};
