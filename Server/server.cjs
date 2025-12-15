const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5055;
const HOST = "127.0.0.1";

// Optional model defaults (can override via env)
const OPENROUTER_MODEL_CHAT =
  process.env.OPENROUTER_MODEL_CHAT || "deepseek/deepseek-chat";
const OPENROUTER_MODEL_CODE =
  process.env.OPENROUTER_MODEL_CODE || "deepseek/deepseek-coder";

// --- KEY LOADING (ENV preferred, file fallback) ---
function loadOpenRouterKey() {
  // 1) ENV (preferred)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (typeof envKey === "string" && envKey.trim()) return envKey.trim();

  // 2) File fallback: Server/.openrouter.key (plain text)
  //    Path: D:\Shakhsy11\Bossmind-orchestrator\Server\.openrouter.key
  try {
    const keyPath = path.join(__dirname, ".openrouter.key");
    if (fs.existsSync(keyPath)) {
      const fileKey = fs.readFileSync(keyPath, "utf8");
      if (typeof fileKey === "string" && fileKey.trim()) return fileKey.trim();
    }
  } catch (e) {
    // ignore file read errors; handled later
  }

  return "";
}

const OPENROUTER_API_KEY = loadOpenRouterKey();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// CORS (your original behavior)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

/* =========================
   Router Logic
========================= */
function chooseModel(reqBody) {
  if (reqBody && typeof reqBody.model === "string" && reqBody.model.trim()) {
    return reqBody.model.trim();
  }

  const messages = Array.isArray(reqBody?.messages) ? reqBody.messages : [];
  const allText = messages
    .map((m) => (typeof m?.content === "string" ? m.content : ""))
    .join("\n")
    .toLowerCase();

  const looksLikeCode =
    allText.includes("```") ||
    allText.includes("stack trace") ||
    allText.includes("error:") ||
    allText.includes("module_not_found") ||
    allText.includes("syntaxerror") ||
    allText.includes("express") ||
    allText.includes("node.js") ||
    allText.includes("powershell") ||
    allText.includes("server.cjs") ||
    allText.includes("api endpoint") ||
    allText.includes("fix") ||
    allText.includes("bug") ||
    allText.includes("refactor");

  return looksLikeCode ? OPENROUTER_MODEL_CODE : OPENROUTER_MODEL_CHAT;
}

/* =========================
   OpenRouter Caller
========================= */
async function callOpenRouter({ model, messages }) {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "BossMind-Orchestrator"
    },
    body: JSON.stringify({ model, messages })
  });

  const text = await resp.text();

  if (!resp.ok) {
    return { ok: false, status: resp.status, errorText: text };
  }

  try {
    return { ok: true, status: resp.status, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 502,
      errorText: "OpenRouter returned non-JSON response",
      raw: text
    };
  }
}

/* =========================
   Health
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    server: "BossMind Chat Server",
    port: PORT,
    openrouter_key_set: Boolean(OPENROUTER_API_KEY),
    router_enabled: true,
    models: {
      chat_default: OPENROUTER_MODEL_CHAT,
      code_default: OPENROUTER_MODEL_CODE
    },
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      chat: "POST /api/deepseek/chat",
      test: "GET /api/deepseek/test"
    }
  });
});

/* =========================
   Test
========================= */
app.get("/api/deepseek/test", (req, res) => {
  res.json({
    message: "Server is working!",
    openrouter_key_set: Boolean(OPENROUTER_API_KEY),
    router_enabled: true,
    instructions:
      "Send POST request to /api/deepseek/chat with JSON body {messages:[...]}",
    example: {
      method: "POST",
      url: `http://${HOST}:${PORT}/api/deepseek/chat`,
      headers: { "Content-Type": "application/json" },
      body: {
        messages: [{ role: "user", content: "Hello" }]
      }
    }
  });
});

/* =========================
   Main chat endpoint
========================= */
app.post("/api/deepseek/chat", async (req, res) => {
  try {
    console.log("=== Chat Request Received ===");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Invalid request",
        details: "Request body must be valid JSON object"
      });
    }

    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      return res.status(400).json({
        error: "Invalid request",
        details: 'Request must contain "messages" array'
      });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "Server not configured",
        details:
          "OpenRouter key is missing. Set OPENROUTER_API_KEY or create Server/.openrouter.key"
      });
    }

    const selectedModel = chooseModel(req.body);

    const result = await callOpenRouter({
      model: selectedModel,
      messages: req.body.messages
    });

    if (!result.ok) {
      console.error("=== OpenRouter Error ===");
      console.error("Status:", result.status);
      console.error("Body:", result.errorText || result.raw);

      return res.status(result.status).json({
        error: "OpenRouter error",
        status: result.status,
        model: selectedModel,
        details: result.errorText || result.raw
      });
    }

    const payload = result.data;
    payload.bossmind = {
      routed_model: selectedModel,
      router_enabled: true,
      routed_at: new Date().toISOString()
    };

    return res.json(payload);
  } catch (error) {
    console.error("Error in /api/deepseek/chat:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    requested: req.originalUrl,
    available_endpoints: ["GET /health", "GET /api/deepseek/test", "POST /api/deepseek/chat"]
  });
});

/* =========================
   Global error handler
========================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong"
  });
});

/* =========================
   Start server
========================= */
const server = app.listen(PORT, HOST, () => {
  console.log("=".repeat(50));
  console.log("✅ BOSS MIND SERVER STARTED SUCCESSFULLY");
  console.log("=".repeat(50));
  console.log(`🌐 URL: http://${HOST}:${PORT}`);
  console.log(`📊 Health: http://${HOST}:${PORT}/health`);
  console.log(`💬 Chat: POST http://${HOST}:${PORT}/api/deepseek/chat`);
  console.log(`🧪 Test: GET http://${HOST}:${PORT}/api/deepseek/test`);
  console.log(`🧭 Router: ENABLED`);
  console.log(`🧠 Model (chat): ${OPENROUTER_MODEL_CHAT}`);
  console.log(`🧠 Model (code): ${OPENROUTER_MODEL_CODE}`);
  console.log(`🔑 OpenRouter key set: ${Boolean(OPENROUTER_API_KEY)}`);
  console.log("=".repeat(50));
  console.log("Press Ctrl+C to stop server");
  console.log("=".repeat(50));
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ ERROR: Port ${PORT} is already in use!`);
    console.error("   Run this command to fix:");
    console.error(
      `   Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
    );
  } else {
    console.error("Server error:", error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping server...");
  server.close(() => {
    console.log("✅ Server stopped");
    process.exit(0);
  });
});

module.exports = app;
