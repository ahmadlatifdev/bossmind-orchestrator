/**
 * server.js — BossMind Orchestrator (Railway ESM Entry)
 * Node.js 22+ | ES Modules ONLY
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

/* =========================
   BASIC MIDDLEWARE
========================= */
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

/* =========================
   ROOT CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "BossMind Orchestrator",
    status: "RUNNING",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   HEALTH ENDPOINT (REQUIRED)
========================= */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "BossMind Orchestrator",
    health: "OK",
    node: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   ADMIN ACTIVATE
========================= */
app.all("/admin/activate", (req, res) => {
  res.json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: req.method,
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   SAFE 404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
  });
});

/* =========================
   SERVER START (RAILWAY)
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
