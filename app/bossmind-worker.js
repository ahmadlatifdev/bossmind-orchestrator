/**
 * BossMind Orchestrator – Safe Worker
 * Stable minimal runtime to prevent Railway crashes
 */

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Health Check (REQUIRED)
========================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-orchestrator",
    time: new Date().toISOString(),
  });
});

/* =========================
   Root
========================= */
app.get("/", (req, res) => {
  res.send("BossMind Orchestrator is running");
});

/* =========================
   Safe Startup
========================= */
app.listen(PORT, () => {
  console.log(`BossMind Orchestrator listening on port ${PORT}`);
});
