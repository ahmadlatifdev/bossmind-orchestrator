// admin.js
// BossMind Orchestrator – Admin Control Server
// Production-safe Railway entrypoint

const express = require("express");
const app = express();

// =========================
// BASIC CONFIG
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-orchestrator",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// =========================
// ADMIN ACTIVATE (GET)
// =========================
app.get("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    mode: "admin",
    timestamp: new Date().toISOString()
  });
});

// =========================
// ADMIN ACTIVATE (POST)
// =========================
app.post("/admin/activate", (req, res) => {
  const payload = req.body || {};

  res.status(200).json({
    success: true,
    message: "BossMind activation command accepted",
    received: payload,
    timestamp: new Date().toISOString()
  });
});

// =========================
// SAFETY: 404 HANDLER
// =========================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`BossMind Orchestrator running on port ${PORT}`);
});
