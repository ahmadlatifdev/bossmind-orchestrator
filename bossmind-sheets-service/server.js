/**
 * BossMind — Sheets Service (KokiDodi)
 * Fix: ensure /api/queue exists (GET + POST) so browser tests + Make POST both work.
 * Also logs every request so Railway HTTP logs show activity.
 */

const express = require("express");
const crypto = require("crypto");

const app = express();

// ---- config ----
const PORT = process.env.PORT || 8080;

// Optional auth: set BOSSMIND_WEBHOOK_SECRET in Railway (recommended)
const WEBHOOK_SECRET =
  process.env.BOSSMIND_WEBHOOK_SECRET ||
  process.env.WEBHOOK_SECRET ||
  "";

// ---- middleware ----
app.use(express.json({ limit: "2mb" }));

// Basic request logger (forces visible activity in logs)
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(
    `[${now}] ${req.method} ${req.originalUrl} ua="${req.headers["user-agent"] || ""}"`
  );
  next();
});

// ---- helpers ----
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function checkAuth(req) {
  if (!WEBHOOK_SECRET) return true; // no secret set => allow (dev)
  const header =
    req.headers["x-bossmind-secret"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return safeEqual(header, WEBHOOK_SECRET);
}

// ---- routes ----
app.get("/", (req, res) => {
  res.status(200).send("BossMind sheets service is running.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, state: process.env.BOSSMIND_STATE || "ACTIVE", time: new Date().toISOString() });
});

// Browser test support (your GET was failing before)
app.get("/queue", (req, res) => {
  res.status(200).json({ ok: true, message: "Use POST /api/queue (JSON) to submit a job." });
});

app.get("/api/queue", (req, res) => {
  res.status(200).json({ ok: true, message: "Use POST /api/queue (JSON) to submit a job." });
});

// Accept both paths (Make/Apps Script can target either)
app.post("/queue", (req, res) => handleQueue(req, res));
app.post("/api/queue", (req, res) => handleQueue(req, res));

function handleQueue(req, res) {
  // auth
  if (!checkAuth(req)) {
    console.log("AUTH_FAIL");
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // body
  const { title, moral, theme, rowNumber } = req.body || {};
  console.log("QUEUE_IN_BODY:", JSON.stringify({ title, moral, theme, rowNumber }));

  if (!title || !moral || !theme) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: title, moral, theme",
      got: { title: !!title, moral: !!moral, theme: !!theme, rowNumber: rowNumber ?? null },
    });
  }

  // NOTE: This endpoint confirms reception.
  // Your existing processing pipeline should run after receiving this request.
  // For now we return success so you can see Railway HTTP logs immediately.
  return res.status(200).json({
    ok: true,
    received: { title, moral, theme, rowNumber: rowNumber ?? null },
    time: new Date().toISOString(),
  });
}

// ---- start ----
app.listen(PORT, () => {
  console.log(`bossmind-sheets-service listening on ${PORT}`);
  console.log(`BOSSMIND_STATE=${process.env.BOSSMIND_STATE || "ACTIVE"}`);
});
