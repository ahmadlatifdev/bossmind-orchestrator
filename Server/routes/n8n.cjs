// Server/routes/n8n.cjs
const express = require("express");
const path = require("path");

const router = express.Router();

// Absolute-safe loader (Windows-proof)
function loadIntegrationsConfig() {
  try {
    const cfgPath = path.resolve(
      __dirname,
      "../config/integrations.cjs"
    );
    return require(cfgPath);
  } catch (e) {
    console.warn("⚠️ n8n config not loaded:", e.message);
    return { n8n: { enabled: false } };
  }
}

// Health / verification endpoint
router.get("/ping", (req, res) => {
  const cfg = loadIntegrationsConfig();
  res.json({
    ok: true,
    service: "bossmind-n8n",
    n8nEnabled: !!cfg?.n8n?.enabled,
    webhookUrlSet: !!cfg?.n8n?.webhookUrl,
    ts: new Date().toISOString(),
  });
});

module.exports = router;
