// BossMind Orchestrator API - server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ---- Environment ----
const PORT = process.env.PORT || 8888;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-api",
    model: DEEPSEEK_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// ---- DeepSeek chat endpoint ----
app.post("/api/deepseek/chat", async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        error: "DEEPSEEK_API_KEY is missing in environment variables.",
      });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Request body must include `messages` array." });
    }

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "DeepSeek API error", details: data });
    }

    res.json(data);
  } catch (err) {
    console.error("DeepSeek request failed:", err);
    res
      .status(500)
      .json({ error: "DeepSeek request failed", details: err.message });
  }
});

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`BossMind Orchestrator running on PORT ${PORT}`);
});
