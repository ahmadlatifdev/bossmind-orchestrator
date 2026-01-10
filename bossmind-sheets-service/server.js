/**
 * BossMind — Sheets Service (KokiDodi)
 * Production-safe version
 * - GET /health
 * - GET /queue
 * - GET /api/queue
 * - POST /queue
 * - POST /api/queue
 * - x-bossmind-secret authentication
 * - Full request logging
 */

const express = require("express");
const crypto = require("crypto");

const app = express();

// ---- config ----
const PORT = process.env.PORT || 8080;
const WEBHOOK_SECRET =
  process.env.BOSSMIND_WEBHOOK_SECRET ||
  process.env.WEBHOOK_SECRET ||
  "";

// ---- middleware ----
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);
  next();
});

// ---- helpers ----
function safeEqual(a, b) {
  const aa = String(a ?? "").trim();
  const bb = String(b ?? "").trim();
  if (!aa || !bb) return false;
  return aa === bb;
}

function checkAuth(req) {
  if (!WEBHOOK_SECRET) return true;
  const header =
    req.headers["x-bossmind-secret"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return safeEqual(header, WEBHOOK_SECRET);
}

// ---- routes ----
app.get("/", (req, res) => {
  res.status(200).send("BossMind sheets service running");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    state: process.env.BOSSMIND_STATE || "ACTIVE",
    time: new Date().toISOString(),
  });
});

app.get("/queue", (req, res) => {
  res.status(200).json({ ok: true, message: "Use POST /queue or POST /api/queue" });
});

app.get("/api/queue", (req, res) => {
  res.status(200).json({ ok: true, message: "Use POST /queue or POST /api/queue" });
});

app.post("/queue", (req, res) => handleQueue(req, res));
app.post("/api/queue", (req, res) => handleQueue(req, res));

function handleQueue(req, res) {
  console.log("QUEUE_REQUEST_HEADERS:", req.headers);
  console.log("QUEUE_REQUEST_BODY:", req.body);

  if (!checkAuth(req)) {
    console.log("AUTH_FAIL");
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { title, moral, theme, rowNumber } = req.body || {};

  if (!title || !moral || !theme) {
    return res.status(400).json({
      ok: false,
      error: "Missing fields",
      got: { title, moral, theme, rowNumber },
    });
  }

  console.log("QUEUE_ACCEPTED", { title, moral, theme, rowNumber });

  return res.status(200).json({
    ok: true,
    received: { title, moral, theme, rowNumber },
    time: new Date().toISOString(),
  });
}

// ---- start ----
app.listen(PORT, () => {
  console.log(`bossmind-sheets-service listening on ${PORT}`);
  console.log(`BOSSMIND_STATE=${process.env.BOSSMIND_STATE || "ACTIVE"}`);
});
