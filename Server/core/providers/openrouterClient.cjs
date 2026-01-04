// Server/core/providers/openrouterClient.cjs
// BossMind Phase 6 — OpenRouter Client (CJS)
// Uses native fetch (Node 18+). No external deps.

function mustGetKey() {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) {
    const err = new Error("OPENROUTER_API_KEY missing");
    err.code = "MISSING_OPENROUTER_KEY";
    throw err;
  }
  return key;
}

function toMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      role: String(m.role || "user"),
      content: String(m.content || "")
    }));
}

async function chat({ messages, model = "openrouter/auto", timeoutMs = 30000 } = {}) {
  const key = mustGetKey();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        // Optional but recommended by OpenRouter:
        "X-Title": "BossMind Orchestrator"
      },
      body: JSON.stringify({
        model,
        messages: toMessages(messages)
      }),
      signal: controller.signal
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const err = new Error(`OpenRouter HTTP ${resp.status}`);
      err.code = "OPENROUTER_HTTP_ERROR";
      err.status = resp.status;
      err.details = text.slice(0, 500);
      throw err;
    }

    const data = await resp.json();
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      typeof data.choices[0].message.content === "string"
        ? data.choices[0].message.content
        : "";

    return { ok: true, provider: "openrouter", model, content, raw: data };
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "OpenRouter timeout" : (e.message || String(e));
    return { ok: false, provider: "openrouter", model, error: msg, code: e.code || "OPENROUTER_ERROR" };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { chat };
