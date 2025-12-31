// admin.cjs
// BossMind Orchestrator — Admin Control Server (Railway entry)

const express = require("express");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS (safe simple) ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 3000;

// --- In-memory state ---
const state = {
  active: true,
  lastActivation: null,
  lastPayload: null,
};

// --- Root ---
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    message: "BossMind Orchestrator Admin is running",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// HEALTH ENDPOINTS (what your dashboard needs)
// =====================================================

// Primary health (the one you tried)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    active: state.active,
    lastActivation: state.lastActivation,
    timestamp: new Date().toISOString(),
  });
});

// Backup alias (useful if you ever change dashboard)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    active: state.active,
    lastActivation: state.lastActivation,
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// ADMIN ACTIVATE (already working for you)
// =====================================================

app.get("/admin/activate", (req, res) => {
  state.active = true;
  state.lastActivation = new Date().toISOString();
  state.lastPayload = { source: "GET" };

  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: state.lastActivation,
  });
});

app.post("/admin/activate", (req, res) => {
  const body = req.body || {};
  state.active = true;
  state.lastActivation = new Date().toISOString();
  state.lastPayload = body;

  res.status(200).json({
    success: true,
    message: "BossMind activation accepted",
    payload: body,
    source: "POST",
    timestamp: state.lastActivation,
  });
});

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`BossMind Admin Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});
