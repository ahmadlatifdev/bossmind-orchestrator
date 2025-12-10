// =============================
// BossMind Orchestrator - API
// DeepSeek smart env detection
// =============================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Helpers ----------
const PORT = process.env.PORT || 5000;
const HOST = "localhost";

// 🔍 Smart DeepSeek env detection
const DEEPSEEK_KEY =
  process.env.DEEPSEEK_API_KEY ||
  process.env.DEEPSEEK__API_KEY ||
  process.env.DEEPSEEK_KEY ||
  process.env.DEEPSEEK ||
  null;

const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL ||
  process.env.DEEPSEEK__MODEL ||
  "deepseek-chat";

function logStartup() {
  console.log("✅ Bossmind API Server running at http://" + HOST + ":" + PORT);
  console.log("🌐 Network: http://192.168.4.23:" + PORT);
  console.log("🔓 CORS: Enabled for all origins (*)");
  console.log("🩺 Test:  http://localhost:" + PORT + "/api/health");
  console.log("🤖 DeepSeek env debug:", {
    hasKey: !!DEEPSEEK_KEY,
    keys: Object.keys(process.env).filter((k) => k.startsWith("DEEPSEEK")),
  });
}

// ---------- Health Check ----------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "bossmind-api",
    timestamp: new Date().toISOString(),
  });
});

// ---------- DeepSeek Status ----------
app.get("/api/deepseek/status", (req, res) => {
  const hasKey = !!DEEPSEEK_KEY;
  res.json({
    online: hasKey,
    model: DEEPSEEK_MODEL,
    message: hasKey ? "DeepSeek configured" : "No API key or invalid configuration",
    envKeys: Object.keys(process.env).filter((k) => k.startsWith("DEEPSEEK")),
  });
});

// ---------- Missions: Run (DeepSeek) ----------
app.post("/api/missions/run", async (req, res) => {
  try {
    const { missionId, missionName, payload } = req.body || {};

    if (!DEEPSEEK_KEY) {
      return res.status(500).json({
        success: false,
        error: "DeepSeek API key missing in environment",
      });
    }

    const userDescription = `
Mission ID: ${missionId || "N/A"}
Mission Name: ${missionName || "N/A"}
Payload:
${JSON.stringify(payload || {}, null, 2)}
`.trim();

    const body = {
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are BossMind, an AI orchestrator that executes system missions and returns clear, concise results for the admin dashboard.",
        },
        {
          role: "user",
          content: `Execute the following mission and return:\n- What you will do\n- The main steps\n- Key risks or notes\n\n${userDescription}`,
        },
      ],
      stream: false,
    };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return res.status(response.status).json({
        success: false,
        error: "DeepSeek API error",
        details: errorText,
      });
    }

    const result = await response.json();

    const message =
      result?.choices?.[0]?.message?.content || "No response content from DeepSeek";

    return res.json({
      success: true,
      mission: {
        id: missionId || null,
        name: missionName || null,
      },
      model: DEEPSEEK_MODEL,
      result: message,
      usage: result?.usage || null,
    });
  } catch (error) {
    console.error("Error in /api/missions/run:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error while running mission",
    });
  }
});

// ---------- Root ----------
app.get("/", (req, res) => {
  res.send("BossMind Orchestrator API is running.");
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  logStartup();
});
