const express = require("express");
const router = express.Router();

/**
 * Health check
 * URL: http://localhost:5000/api/health
 */
router.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/**
 * Root API check
 * URL: http://localhost:5000/api
 */
router.get("/", (req, res) => {
  res.json({
    name: "BossMind Orchestrator",
    status: "API is running",
  });
});

module.exports = router;
