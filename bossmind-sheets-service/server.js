"use strict";

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check (Railway will use this)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "bossmind-sheets-service" });
});

// Home
app.get("/", (req, res) => {
  res.status(200).send("BossMind Sheets Service is running.");
});

/**
 * IMPORTANT:
 * - Railway injects PORT automatically.
 * - Must listen on process.env.PORT (not a fixed port).
 */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BossMind Sheets Service listening on port ${PORT}`);
});
