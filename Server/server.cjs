/**
 * BossMind Orchestrator - Server Entrypoint (CommonJS)
 * - Loads the existing Express app from ./app.cjs
 * - Adds /api/health (if not already present)
 * - Applies SINGLE_WRITER execution guard to write/action routes only
 * - Starts the HTTP server on Railway PORT
 */

const fs = require('fs');
const path = require('path');

// Load .env locally if present (Railway provides env vars in production anyway)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {}

// Import the execution guard (SINGLE_WRITER)
const { executionGuard } = require('./middleware/executionGuard.cjs');

// Load your existing Express app (keeps your current routes intact)
const app = require('./app.cjs');

// ---------------------------
// Health Endpoint (canonical)
// ---------------------------
// If your app.cjs already defines this, Express will use the first match.
// Keeping it here ensures it exists even if app.cjs changes.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------
// SINGLE_WRITER guard (no conflicts)
// ------------------------------------
// Protect only “write/execution” paths.
// Add/remove prefixes here without touching route files.
app.use(['/admin', '/jobs', '/orchestrator', '/execute', '/run'], executionGuard);

// ---------------------------
// Port selection
// ---------------------------
const PORT =
  process.env.PORT ||
  (() => {
    // optional local dev fallback: read .bossmind-port if it exists
    try {
      const p = fs.readFileSync(path.join(__dirname, '.bossmind-port'), 'utf8').trim();
      return p || 3000;
    } catch (_) {
      return 3000;
    }
  })();

// ---------------------------
// Start server
// ---------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BossMind] Server running on port ${PORT}`);
  console.log(`[BossMind] Health: /api/health`);
  console.log(`[BossMind] Execution mode: ${process.env.BOSSMIND_EXECUTION_MODE || '(not set)'}`);
});
