// Server/core/modelRouter.cjs
// BossMind Phase 6 — Model Router (CJS)
// Decides which provider/model should handle a request.
// No network calls here; purely routing logic.

function normText(v) {
  return String(v || "").trim();
}

function hasAny(text, words) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}

function extractText(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m) => (m && typeof m.content === "string" ? m.content : ""))
    .join("\n")
    .trim();
}

/**
 * route(messages, state) => { provider, model, reason }
 *
 * provider: "openrouter" | "deepseek"
 * model: provider-specific model string
 */
function route(messages, state = {}) {
  const activeModel = normText(state.active_model) || "openrouter";
  const text = extractText(messages);

  // Hard safety: empty prompt -> do not call paid models
  if (!text) {
    return { provider: "openrouter", model: "openrouter/auto", reason: "empty_prompt_safe_default" };
  }

  // If self-heal has switched active_model, respect it first
  if (activeModel === "deepseek") {
    return { provider: "deepseek", model: "deepseek-chat", reason: "state_active_model" };
  }
  if (activeModel === "openrouter") {
    // continue below; openrouter is default
  }

  // Heuristics (simple + stable):
  // - Code tasks -> DeepSeek (better coding)
  // - General chat/analysis -> OpenRouter (default)
  const codeSignals = [
    "error",
    "stack trace",
    "exception",
    "node",
    "npm",
    "pnpm",
    "yarn",
    "express",
    "typescript",
    "javascript",
    "python",
    "cjs",
    "esm",
    "import",
    "require(",
    "module.exports",
    "traceback",
    "compile",
    "build",
    "deploy",
    "server.cjs",
    ".env",
    "supabase",
    "sql"
  ];

  if (hasAny(text, codeSignals)) {
    return { provider: "deepseek", model: "deepseek-chat", reason: "code_intent_detected" };
  }

  // Default route
  return { provider: "openrouter", model: "openrouter/auto", reason: "default" };
}

module.exports = { route };
