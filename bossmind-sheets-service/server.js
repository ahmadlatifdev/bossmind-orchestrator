/**
 * BossMind — Sheets Service (KokiDodi)
 * AUTH DISABLED — Make.com safe mode
 * - GET /health
 * - GET /queue
 * - GET /api/queue
 * - POST /queue
 * - POST /api/queue
 */

const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

// ---- middleware ----
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);
  next();
});

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
  console.log("QUEUE_HEADERS:", req.headers);
  console.log("QUEUE_BODY:", req.body);

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
