import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import ideaRoutes from "./routes/ideaRoutes.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
cors({
origin: "http://localhost:5173",
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

const startServer = async () => {
await connectDB();

app.listen(PORT, () => {
console.log(
`Server running on port ${PORT}`
);
});
};

startServer();
