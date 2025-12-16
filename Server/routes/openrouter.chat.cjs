// D:\Shakhsy11\Bossmind-orchestrator\Server\routes\openrouter.chat.cjs
// OpenRouter execution route (provider controls + fallback + metadata + hard timeouts + retry)

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

function readKeyFileSafe() {
  try {
    const p = path.join(__dirname, "..", ".openrouter.key");
    if (fs.existsSync(p)) {
      const k = fs.readFileSync(p, "utf8").trim();
      return k || null;
    }
  } catch (_) {}
  return null;
}

function getOpenRouterKey() {
  const envKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (envKey) return envKey;
  return readKeyFileSafe();
}

function parseCsvList(v) {
  if (!v) return null;
  const arr = String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

router.post("/api/openrouter/chat", async (req, res) => {
  const key = getOpenRouterKey();
  if (!key) {
    return res.status(500).json({
      ok: false,
      error: "OPENROUTER_API_KEY is missing (and Server/.openrouter.key not found).",
    });
  }

  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : null;

  if (!messages || !messages.length) {
    return res.status(400).json({
      ok: false,
      error: "Invalid body: expected { messages: [...] }",
    });
  }

  // Defaults (safe + deterministic)
  const model = (body.model || process.env.OPENROUTER_DEFAULT_MODEL || "openrouter/auto").trim();

  const allow =
    parseCsvList(process.env.OPENROUTER_PROVIDERS_ALLOW) || ["deepseek", "openai"];
  const disallow = parseCsvList(process.env.OPENROUTER_PROVIDERS_DISALLOW) || [];
  const order =
    parseCsvList(process.env.OPENROUTER_PROVIDERS_ORDER) || ["deepseek", "openai"];

  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 30000);
  const maxRetries = Number(process.env.OPENROUTER_RETRIES || 2);

  // "100% benefits" payload knobs
  const payload = {
    model,
    messages,
    route: "fallback", // deterministic fallback behavior
    providers: {
      allow,
      disallow,
      order,
    },
    temperature: typeof body.temperature === "number" ? body.temperature : 0.2,
    max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 4096,
    metadata: {
      app: "BossMind-Orchestrator",
      phase: "openrouter-execution",
      role: "router-execution",
      request_id: body.request_id || null,
    },
  };

  const url = "https://openrouter.ai/api/v1/chat/completions";

  // Minimal observability (console logs) without breaking anything else
  const startedAt = Date.now();
  let attempt = 0;
  let lastErr = null;

  while (attempt <= maxRetries) {
    attempt += 1;
    try {
      const r = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            // Optional headers (safe to include)
            "X-Title": "BossMind-Orchestrator",
            "HTTP-Referer": "http://127.0.0.1",
          },
          body: JSON.stringify(payload),
        },
        timeoutMs
      );

      const text = await r.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { raw: text };
      }

      const elapsedMs = Date.now() - startedAt;

      if (!r.ok) {
        const errMsg =
          (data && (data.error?.message || data.error || data.message)) ||
          `OpenRouter HTTP ${r.status}`;
        lastErr = new Error(errMsg);

        // Retry only for transient-ish failures
        if (attempt <= maxRetries && (r.status === 408 || r.status === 429 || r.status >= 500)) {
          console.log(
            `[OPENROUTER] retrying attempt=${attempt}/${maxRetries} status=${r.status} elapsedMs=${elapsedMs}`
          );
          await sleep(350 * attempt);
          continue;
        }

        return res.status(r.status).json({
          ok: false,
          where: "openrouter",
          status: r.status,
          error: errMsg,
          attempt,
          elapsedMs,
          debug: data,
        });
      }

      // Try to extract a clean answer
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        null;

      // Some responses include routing/provider info in fields; keep raw for visibility
      console.log(
        `[OPENROUTER] ok model=${data?.model || model} attempt=${attempt} elapsedMs=${elapsedMs}`
      );

      return res.json({
        ok: true,
        model: data?.model || model,
        attempt,
        elapsedMs,
        content,
        raw: data, // keep for full observability
      });
    } catch (e) {
      lastErr = e;
      const elapsedMs = Date.now() - startedAt;

      if (attempt <= maxRetries) {
        console.log(
          `[OPENROUTER] exception retrying attempt=${attempt}/${maxRetries} error=${String(
            e?.message || e
          )} elapsedMs=${elapsedMs}`
        );
        await sleep(350 * attempt);
        continue;
      }

      return res.status(500).json({
        ok: false,
        where: "openrouter",
        error: String(e?.message || e),
        attempt,
        elapsedMs,
      });
    }
  }

  return res.status(500).json({
    ok: false,
    where: "openrouter",
    error: String(lastErr?.message || lastErr || "Unknown error"),
  });
});

module.exports = router;
