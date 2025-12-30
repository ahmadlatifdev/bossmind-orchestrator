// server.js (ROOT – Railway entry, ESM compatible)

import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// Health
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "bossmind-orchestrator",
    runtime: "root-server.js",
    timestamp: new Date().toISOString(),
  });
});

// Admin Activate
app.get("/admin/activate", (req, res) => {
  res.json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: new Date().toISOString(),
  });
});

app.post("/admin/activate", (req, res) => {
  res.json({
    success: true,
    message: "BossMind activation accepted",
    payload: req.body || {},
    source: "POST",
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

// Start
app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
