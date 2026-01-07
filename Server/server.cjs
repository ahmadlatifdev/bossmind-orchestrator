/* Server/server.cjs (CommonJS) */
'use strict';

const http = require('http');
const express = require('express');

// --- App ---
const app = express();

// Trust proxy (Railway/Reverse proxy)
app.set('trust proxy', 1);

// Basic middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health (Railway needs fast, reliable response)
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'bossmind-orchestrator',
    time: new Date().toISOString(),
  });
});

// Load routes (if present)
try {
  // Your logs show this exists: /app/Server/routes/index.cjs
  const routes = require('./routes/index.cjs');
  if (typeof routes === 'function') {
    app.use('/', routes);
  } else if (routes && typeof routes.router === 'function') {
    app.use('/', routes.router);
  }
} catch (e) {
  console.warn('[BossMind] routes load skipped:', e?.message || e);
}

// Fallback
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

// --- Server (THIS is the critical part for Railway) ---
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`[BossMind] server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[BossMind] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Don’t crash silently
process.on('unhandledRejection', (err) => {
  console.error('[BossMind] unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[BossMind] uncaughtException:', err);
  process.exit(1);
});

module.exports = { app, server };
