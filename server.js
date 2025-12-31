// server.js (Railway entry)
// BossMind Orchestrator API Server (ESM)

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   HEALTH CHECK
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
    payload: req.body || null,
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   FALLBACK
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
