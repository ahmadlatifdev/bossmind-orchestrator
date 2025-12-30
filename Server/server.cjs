/**
 * BossMind Orchestrator - Server Entrypoint (CommonJS)
 * - Loads the existing Express app from ./app.cjs
 * - Adds /api/health
 * - Applies SINGLE_WRITER execution guard
 * - Starts HTTP server (Railway compatible)
 */

const fs = require('fs');
const path = require('path');

/* ================================
   LOAD ENV (LOCAL DEV SAFE)
================================ */
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {}

/* ================================
   EXECUTION GUARD (SINGLE WRITER)
================================ */
const { executionGuard } = require('./middleware/executionGuard.cjs');

/* ================================
   LOAD EXPRESS APP
================================ */
const app = require('./app.cjs');

/* ================================
   HEALTH ENDPOINT (CANONICAL)
================================ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    timestamp: new Date().toISOString(),
  });
});

/* ================================
   APPLY EXECUTION GUARD
   (ONLY WRITE / ACTION ROUTES)
================================ */
app.use(
  ['/admin', '/jobs', '/orchestrator', '/execute', '/run'],
  executionGuard
);

/* ================================
   PORT RESOLUTION
================================ */
const PORT =
  process.env.PORT ||
  (() => {
    try {
      const p = fs
        .readFileSync(path.join(__dirname, '.bossmind-port'), 'utf8')
        .trim();
      return p || 3000;
    } catch {
      return 3000;
    }
  })();

/* ================================
   START SERVER
================================ */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BossMind] Server running on port ${PORT}`);
  console.log(`[BossMind] Health: /api/health`);
  console.log(
    `[BossMind] Execution mode: ${process.env.BOSSMIND_EXECUTION_MODE || 'NOT SET'}`
  );
});
