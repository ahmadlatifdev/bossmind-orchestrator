// server.js
// BossMind Orchestrator – ACTIVE ENTRY (Railway confirmed)

const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "bossmind-orchestrator",
    runtime: "server.js",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   ADMIN ACTIVATE
========================= */
app.get("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: new Date().toISOString(),
  });
});

app.post("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind activation accepted",
    source: "POST",
    payload: req.body || {},
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   EXISTING API (KEEP)
========================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
