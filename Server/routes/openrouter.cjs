// D:\Shakhsy11\Bossmind-orchestrator\Server\routes\openrouter.cjs
const { assertInferenceAllowed } = require("../core/spendPolicy.cjs");
const express = require("express");
const router = express.Router();

// Provider client is loaded only after cost authorization.

/**
 * POST /api/openrouter/chat
 * Body: { "messages": [ { "role": "user", "content": "Hello" } ], "model": "optional" }
 */
router.post("/chat", async (req, res) => {
  try {
    assertInferenceAllowed("openrouter");
    const { chat: openrouterChat } = require("../core/openrouterClient.cjs");
    const { messages, model } = req.body || {};
    const reply = await openrouterChat({ messages, model });
    res.json({ reply });
  } catch (err) {
    if (err.code === "COST_POLICY_BLOCKED") {
      return res.status(403).json({ ok: false, code: err.code, error: err.code, reason: err.reason });
    }
    res.status(500).json({
      error: true,
      message: err?.message || "Unknown error",
    });
  }
});

module.exports = router;
