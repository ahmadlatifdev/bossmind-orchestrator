// server.js (Railway entry) — ESM compatible (because package.json has "type":"module")

import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// In-memory activation flag (safe + simple)
let ACTIVATED = false;
let LAST_ACTIVATION = null;

// Root
app.get("/", (_req, res) => {
  res.status(200).send("BossMind Orchestrator is running.");
});

// ✅ Health endpoint (your dashboard pings this)
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    activated: ACTIVATED,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    node: process.version,
  });
});

// ✅ Admin Activate (GET)
app.get("/admin/activate", (_req, res) => {
  ACTIVATED = true;
  LAST_ACTIVATION = { source: "GET", timestamp: new Date().toISOString() };

  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: LAST_ACTIVATION.timestamp,
  });
});

// ✅ Admin Activate (POST)
app.post("/admin/activate", (req, res) => {
  ACTIVATED = true;

  const phase = req?.body?.phase ?? "activate";
  const source = req?.body?.source ?? "manual";

  LAST_ACTIVATION = {
    phase,
    source: "POST",
    received_source: source,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    success: true,
    message: "BossMind activation accepted",
    payload: { phase, source },
    source: "POST",
    timestamp: LAST_ACTIVATION.timestamp,
  });
});

// Start
app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
