"use strict";

/**
 * BossMind – DeepSeek Chat Handler
 * --------------------------------
 * This is the ONLY entry point used by server.cjs
 * It receives validated messages[] and returns a response object.
 *
 * Flow:
 * 1) Validate input
 * 2) Route model (via modelRouter if present)
 * 3) Call OpenRouter / DeepSeek client
 * 4) Return normalized response
 */

const path = require("path");

// Optional safety / routing layers (used if present)
let modelRouter = null;
let approvalGuard = null;
let openrouterClient = null;

try {
  modelRouter = require("./modelRouter.cjs");
} catch (_) {}

try {
  approvalGuard = require("./approvalGuard.cjs");
} catch (_) {}

try {
  openrouterClient = require("./openrouterClient.cjs");
} catch (_) {}

/**
 * Main handler
 * @param {Object} params
 * @param {Object} params.req
 * @param {Array}  params.messages
 */
module.exports = async function handleDeepseekChat({ req, messages }) {
  /* ---------------- Basic validation ---------------- */

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      ok: false,
      error: "messages[] must be a non-empty array",
    };
  }

  /* ---------------- Approval guard (if enabled) ---------------- */

  if (approvalGuard && typeof approvalGuard.check === "function") {
    const approved = approvalGuard.check(req);
    if (!approved) {
      return {
        ok: false,
        error: "Request blocked by approvalGuard",
      };
    }
  }

  /* ---------------- Model routing ---------------- */

  let model = "deepseek/deepseek-chat";

  if (modelRouter && typeof modelRouter.route === "function") {
    try {
      model = modelRouter.route(messages);
    } catch (_) {
      // fallback to default model
    }
  }

  /* ---------------- OpenRouter / DeepSeek call ---------------- */

  if (!openrouterClient || typeof openrouterClient.chat !== "function") {
    // Safety fallback (should never happen once wired)
    return {
      ok: true,
      mode: "local-fallback",
      model,
      reply:
        "DeepSeek handler is installed, but openrouterClient.chat() is not wired yet.",
    };
  }

  try {
    const aiResponse = await openrouterClient.chat({
      model,
      messages,
      headers: {
        "x-bossmind": "true",
        "x-client-ip": req.ip,
      },
    });

    return {
      ok: true,
      model,
      reply: aiResponse.reply || aiResponse,
    };
  } catch (err) {
    return {
      ok: false,
      error: "DeepSeek/OpenRouter call failed",
      details: String(err && err.message ? err.message : err),
    };
  }
};
