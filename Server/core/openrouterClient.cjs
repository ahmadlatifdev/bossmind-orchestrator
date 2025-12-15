"use strict";

/**
 * OpenRouter Client (CommonJS)
 * - Uses Node 18+ global fetch (you are on Node v22)
 * - Non-streaming chat completions
 * - Returns { reply, raw }
 *
 * Required .env:
 *   OPENROUTER_API_KEY=...
 *
 * Optional .env:
 *   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
 *   OPENROUTER_SITE_URL=https://your-domain.com
 *   OPENROUTER_APP_NAME=BossMind
 *   OPENROUTER_TIMEOUT_MS=60000
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

function getEnv(name, fallback = "") {
  const v = process.env[name];
  return (typeof v === "string" && v.trim().length > 0) ? v.trim() : fallback;
}

function redactKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function extractAssistantText(json) {
  // OpenAI-style: choices[0].message.content
  const c0 = json && json.choices && json.choices[0];
  const msg = c0 && c0.message;
  const content = msg && msg.content;

  if (typeof content === "string") return content;

  // Some APIs return an array of content blocks
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b?.text === "string" ? b.text : ""))
      .join("")
      .trim();
  }

  // Fallback
  return "";
}

async function chat({ model, messages, headers = {}, temperature, max_tokens }) {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return {
      reply: "Missing OPENROUTER_API_KEY in .env",
      raw: { ok: false, error: "Missing OPENROUTER_API_KEY" },
    };
  }

  const baseUrl = getEnv("OPENROUTER_BASE_URL", DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const siteUrl = getEnv("OPENROUTER_SITE_URL", "");
  const appName = getEnv("OPENROUTER_APP_NAME", "BossMind");
  const timeoutMs = Number(getEnv("OPENROUTER_TIMEOUT_MS", "60000")) || 60000;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      reply: "Invalid messages[] (must be non-empty array).",
      raw: { ok: false, error: "Invalid messages[]" },
    };
  }

  const payload = {
    model: model || "deepseek/deepseek-chat",
    messages,
  };

  if (typeof temperature === "number") payload.temperature = temperature;
  if (typeof max_tokens === "number") payload.max_tokens = max_tokens;

  const reqHeaders = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // OpenRouter recommended attribution headers (optional but good practice)
    ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
    ...(appName ? { "X-Title": appName } : {}),
    // Caller-provided headers (safe add-ons)
    ...headers,
  };

  let res;
  let text;

  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    text = await res.text();
  } catch (err) {
    return {
      reply: "OpenRouter request failed (network/timeout).",
      raw: {
        ok: false,
        error: "Network/timeout",
        details: String(err && err.message ? err.message : err),
        usingKey: redactKey(apiKey),
        url,
      },
    };
  }

  // Try JSON parse; if it fails, return raw text
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  if (!res.ok) {
    const errMsg =
      (json && (json.error?.message || json.message || json.error)) ||
      `HTTP ${res.status}`;

    return {
      reply: `OpenRouter error: ${errMsg}`,
      raw: {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        error: errMsg,
        responseText: text,
        usingKey: redactKey(apiKey),
        url,
      },
    };
  }

  const reply = extractAssistantText(json);
  return { reply: reply || "", raw: json };
}

module.exports = { chat };
