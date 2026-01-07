/**
 * Server/routes/tax.cjs
 * Mounted at: /tax
 *
 * Endpoints:
 * - GET /tax/status
 * - POST /tax/queue/process-once
 */

'use strict';

const express = require('express');
const router = express.Router();

const { getStoreStats, listRecentTransactions } = require('../services/store.cjs');
const { getQueueStats, processQueueOnce } = require('../services/retryQueue.cjs');
const { avalaraConfigSummary } = require('../services/avalara.cjs');

router.get('/status', async (_req, res) => {
  const store = await getStoreStats();
  const queue = getQueueStats();
  const avalara = avalaraConfigSummary();

  res.status(200).json({
    ok: true,
    avalara,
    store,
    queue,
  });
});

// Manual “process one job now” trigger (useful for testing)
router.post('/queue/process-once', async (_req, res) => {
  try {
    const result = await processQueueOnce();
    res.status(200).json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// View recent records (debug)
router.get('/recent', async (_req, res) => {
  const items = await listRecentTransactions(25);
  res.status(200).json({ ok: true, count: items.length, items });
});

module.exports = router;
