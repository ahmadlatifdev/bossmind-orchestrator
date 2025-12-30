// Server/routes/admin.cjs
// BossMind Orchestrator – Admin Control Server (Railway entry)

const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Health
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-orchestrator",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// /admin/activate (GET)
app.get("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    mode: "admin",
    timestamp: new Date().toISOString(),
  });
});

// /admin/activate (POST)
app.post("/admin/activate", (req, res) => {
  const payload = req.body || {};
  res.status(200).json({
    success: true,
    message: "BossMind activation command accepted",
    received: payload,
    timestamp: new Date().toISOString(),
  });
});

// 404 (keeps same style you saw)
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

app.listen(PORT, () => {
  console.log(`BossMind Orchestrator running on port ${PORT}`);
});
