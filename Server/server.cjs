"use strict";

/* ================================
   IMPORTS
================================ */

const express = require("express");
const path = require("path");

/* ================================
   APP INIT
================================ */

const app = express();
app.disable("x-powered-by");

/* ================================
   GLOBAL MIDDLEWARE
================================ */

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ================================
   RUNTIME STATE
================================ */

const STARTED_AT = Date.now();

/**
 * STRICT Railway-safe PORT handling
 * This is REQUIRED for Railway to stop crashing
 */
const PORT_RAW = process.env.PORT;
const PORT = PORT_RAW ? Number(PORT_RAW) : 8080;

if (!PORT_RAW) {
  console.warn(
    "[BossMind] WARNING: process.env.PORT is missing. Falling back to 8080 (local only)."
  );
} else if (Number.isNaN(PORT)) {
  console.error(
    "[BossMind] ERROR: process.env.PORT is not a valid number:",
    PORT_RAW
  );
  process.exit(1);
} else {
  console.log("[BossMind] Using Railway PORT:", PORT);
}

/* ================================
   HEALTH CHECK (Railway compatible)
================================ */

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    service: "bossmind-orchestrator",
    timestamp: new Date().toISOString(),
  });
});

/* ================================
   ROOT ROUTE
================================ */

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "BossMind Orchestrator",
    status: "running",
    startedAt: STARTED_AT,
  });
});

/* ================================
   STRIPE WEBHOOK PLACEHOLDER
   (endpoint exists, logic can be expanded later)
================================ */

app.post("/api/stripe/webhook", (req, res) => {
  res.status(200).json({ received: true });
});

/* ================================
   404 HANDLER
================================ */

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.originalUrl,
  });
});

/* ================================
   ERROR HANDLER
================================ */

app.use((err, _req, res, _next) => {
  console.error("[BossMind] Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
  });
});

/* ================================
   START SERVER (Railway REQUIRED)
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BossMind Orchestrator listening on :${PORT}`);
});

