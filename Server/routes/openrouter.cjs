// D:\Shakhsy11\Bossmind-orchestrator\Server\routes\openrouter.cjs
const express = require("express");
const router = express.Router();

const { openrouterChat } = require("../core/openrouterClient.cjs");

/**
 * POST /api/openrouter/chat
 * Body: { "messages": [ { "role": "user", "content": "Hello" } ], "model": "optional" }
 */
router.post("/chat", async (req, res) => {
  try {
    const { messages, model } = req.body || {};
    const reply = await openrouterChat({ messages, model });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: err?.message || "Unknown error",
    });
  }
});

module.exports = router;
