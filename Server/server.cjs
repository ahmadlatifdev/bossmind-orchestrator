const express = require("express");
const fs = require("fs");
const path = require("path");

// ================================
// BossMind Router (CJS ENFORCED)
// ================================
const {
  routeModel,
  assertBenefit,
  ALLOWED_MODELS,
  BENEFITS
} = require("./core/modelRouter.cjs");

// OpenRouter execution route
const openRouterRoute = require("./routes/openrouter.chat.cjs");

const app = express();
const PORT = 5055;
const HOST = "127.0.0.1";

/* =========================
   KEY + TOKEN LOADING
========================= */
function loadOpenRouterKey() {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();

  try {
    const keyPath = path.join(__dirname, ".openrouter.key");
    if (fs.existsSync(keyPath)) {
      const fileKey = fs.readFileSync(keyPath, "utf8");
      if (fileKey && fileKey.trim()) return fileKey.trim();
    }
  } catch (_) {}

  return "";
}

function loadAdminToken() {
  const envTok = process.env.BOSSMIND_ADMIN_TOKEN;
  if (envTok && envTok.trim()) return envTok.trim();
  return "";
}

const OPENROUTER_API_KEY = loadOpenRouterKey();
const BOSSMIND_ADMIN_TOKEN = loadAdminToken();

/* =========================
   Middleware
========================= */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-BossMind-Token");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

/* =========================
   GLOBAL GUARD (PROTECT ALL /api/*)
   Required header:
   - X-BossMind-Token: <token>
   OR Authorization: Bearer <token>
========================= */
function extractToken(req) {
  const h1 = req.headers["x-bossmind-token"];
  if (typeof h1 === "string" && h1.trim()) return h1.trim();

  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return "";
}

app.use((req, res, next) => {
  // keep health public
  if (req.path === "/health") return next();

  // protect everything under /api/
  if (req.path.startsWith("/api/")) {
    if (!BOSSMIND_ADMIN_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "BOSSMIND_ADMIN_TOKEN missing in .env (guard cannot be enforced)."
      });
    }

    const provided = extractToken(req);
    if (!provided || provided !== BOSSMIND_ADMIN_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized (missing/invalid BossMind token)."
      });
    }
  }

  next();
});

/* =========================
   Mount OpenRouter execution route
========================= */
app.use(openRouterRoute);

/* =========================
   INTENT DETECTION
========================= */
function detectIntent(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const text = messages
    .map((m) => (typeof m?.content === "string" ? m.content : ""))
    .join("\n")
    .toLowerCase();

  const codeHints = [
    "```",
    "error",
    "stack trace",
    "bug",
    "fix",
    "refactor",
    "express",
    "node",
    "powershell",
    "server.cjs"
  ];

  return codeHints.some((k) => text.includes(k)) ? "code" : "chat";
}

/* =========================
   APPROVAL HANDLING
========================= */
function getApprovedFiles(body) {
  const raw = body?.approved_files || body?.approvedFiles || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((x) => x.trim()).filter(Boolean);
}

function validateApprovedFiles(files) {
  for (const f of files) {
    if (f.includes("..")) {
      throw new Error(`APPROVAL BLOCK: Path traversal detected: ${f}`);
    }
    if (/^[a-zA-Z]:\\/.test(f) || f.startsWith("/")) {
      throw new Error(`APPROVAL BLOCK: Absolute path rejected: ${f}`);
    }
  }
}

/* =========================
   MODEL SELECTION (FINAL)
========================= */
function chooseModel(body) {
  if (body.model) {
    throw new Error("ROUTER BLOCK: Manual model override is forbidden");
  }

  const intent = detectIntent(body);
  const approvedFiles = getApprovedFiles(body);

  if (intent === "code") {
    validateApprovedFiles(approvedFiles);
  }

  const model = routeModel({ intent, approvedFiles });

  if (intent === "code") {
    assertBenefit(model, "canWriteCode");
  } else {
    assertBenefit(model, "canDecide");
  }

  return { model, intent, approvedFiles };
}

/* =========================
   OPENROUTER CALL (BossMind Router Execution)
========================= */
async function callOpenRouter({ model, messages }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "BossMind-Orchestrator"
    },
    body: JSON.stringify({ model, messages })
  });

  const text = await res.text();

  if (!res.ok) {
    return { ok: false, status: res.status, error: text };
  }

  return { ok: true, data: JSON.parse(text) };
}

/* =========================
   HEALTH
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    router: "ENFORCED",
    allowed_models: ALLOWED_MODELS,
    benefits: BENEFITS,
    key_loaded: Boolean(OPENROUTER_API_KEY),
    admin_token_loaded: Boolean(BOSSMIND_ADMIN_TOKEN),
    port: PORT,
    time: new Date().toISOString(),
    routes: {
      bossmind: "/api/deepseek/chat",
      openrouter_exec: "/api/openrouter/chat"
    }
  });
});

/* =========================
   CHAT ENDPOINT (BossMind enforced router -> OpenRouter)
========================= */
app.post("/api/deepseek/chat", async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OpenRouter key missing" });
    }

    if (!Array.isArray(req.body?.messages)) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const { model, intent, approvedFiles } = chooseModel(req.body);

    const result = await callOpenRouter({
      model,
      messages: req.body.messages
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    result.data.bossmind = {
      routed_model: model,
      intent,
      approvals: approvedFiles.length,
      enforced: true,
      time: new Date().toISOString()
    };

    res.json(result.data);
  } catch (err) {
    res.status(403).json({
      error: "BossMind enforcement block",
      details: err.message
    });
  }
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

/* =========================
   START SERVER
========================= */
const server = app.listen(PORT, HOST, () => {
  console.log("====================================");
  console.log("✅ BOSS MIND SERVER RUNNING");
  console.log(`🌐 http://${HOST}:${PORT}`);
  console.log("🧠 Router: HARD ENFORCED");
  console.log("🔒 API Guard: /api/* requires token");
  console.log("====================================");
});

process.on("SIGINT", () => {
  console.log("\n🛑 Server stopping...");
  server.close(() => process.exit(0));
});

module.exports = app;
