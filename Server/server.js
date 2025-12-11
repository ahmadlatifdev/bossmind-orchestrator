// ===============================
// BossMind Orchestrator - server.js
// ===============================

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ===============================
// Environment Variables
// ===============================
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

// ===============================
// Health Check Endpoint
// ===============================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "BossMind Orchestrator Backend Running",
    model: DEEPSEEK_MODEL,
  });
});

// ===============================
// DeepSeek Chat Endpoint
// ===============================
app.post("/api/deepseek/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        error: "Missing DEEPSEEK_API_KEY in environment variables",
      });
    }

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: messages || [],
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("DeepSeek API error:", error);
    res.status(500).json({ error: "DeepSeek request failed" });
  }
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {
  console.log(`BossMind Orchestrator running on port ${PORT}`);
});
