// admin.cjs
// BossMind Orchestrator — Admin + Health API (Railway entry)
// CommonJS (.cjs) so "require" works even if package.json sets "type":"module"

const express = require("express");

const app = express();

// ---- Basic middleware ----
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Simple permissive CORS (no extra deps)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---- Config ----
const PORT = Number(process.env.PORT || 8080);
const SERVICE_NAME = process.env.SERVICE_NAME || "bossmind-orchestrator";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""; // optional

function nowISO() {
  return new Date().toISOString();
}

function requireAdmin(req, res, next) {
  // If no token set, allow (keeps your current behavior)
  if (!ADMIN_TOKEN) return next();

  const headerToken =
    (req.headers["x-admin-token"] || req.headers["authorization"] || "")
      .toString()
      .replace(/^Bearer\s+/i, "")
      .trim();

  const queryToken = (req.query.token || "").toString().trim();

  if (headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN) return next();

  return res.status(401).json({
    success: false,
    error: "unauthorized",
    message: "Missing/invalid admin token",
    timestamp: nowISO(),
  });
}

// ---- Root ----
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: SERVICE_NAME,
    message: "BossMind Orchestrator is running",
    timestamp: nowISO(),
  });
});

// ---- Health (THIS is what your dashboard needs) ----
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: SERVICE_NAME,
    status: "healthy",
    timestamp: nowISO(),
    env: {
      hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY),
      model: process.env.DEEPSEEK_MODEL || null,
    },
  });
});

// Optional alias (nice for quick tests)
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// ---- Activation endpoint (GET + POST) ----
app.get("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: nowISO(),
  });
});

app.post("/admin/activate", requireAdmin, (req, res) => {
  const payload = req.body || {};
  res.status(200).json({
    success: true,
    message: "BossMind activation accepted",
    source: "POST",
    payload,
    timestamp: nowISO(),
  });
});

// ---- Start ----
const server = app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});

// ---- Graceful shutdown ----
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
