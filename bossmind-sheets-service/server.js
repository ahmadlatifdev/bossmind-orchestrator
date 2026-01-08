// bossmind-sheets-service/server.js
"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// Health check (Railway + your browser)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-sheets-service",
    time: new Date().toISOString(),
  });
});

// Root
app.get("/", (req, res) => {
  res.status(200).send("BossMind Sheets Service is running. Try /health");
});

// Optional: quick env check (safe, no secrets)
app.get("/debug/env", (req, res) => {
  res.status(200).json({
    ok: true,
    hasDeepseekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    deepseekModel: process.env.DEEPSEEK_MODEL || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ bossmind-sheets-service listening on ${PORT}`);
});
