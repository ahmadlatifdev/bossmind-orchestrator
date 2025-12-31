// server.js (Railway entry - ESM)
// BossMind Orchestrator API Server

import express from "express";
import cors from "cors";

const app = express();

// ==========================
// Core Middleware
// ==========================
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// ==========================
// Health Check (REQUIRED)
// ==========================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "BossMind Orchestrator",
    health: "OK",
    node: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ==========================
// Admin Activate Endpoint
// ==========================
app.all("/admin/activate", (req, res) => {
  res.json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: req.method,
    timestamp: new Date().toISOString()
  });
});

// ==========================
// Safe Root
// ==========================
app.get("/", (req, res) => {
  res.json({
    service: "BossMind Orchestrator",
    status: "running",
    endpoints: [
      "/api/health",
      "/admin/activate"
    ]
  });
});

// ==========================
// Boot
// ==========================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
