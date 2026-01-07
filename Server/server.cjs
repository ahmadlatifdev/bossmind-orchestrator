/**
 * Server/server.cjs
 * BossMind Orchestrator – Railway-safe HTTP server
 * DO NOT hardcode PORT
 * DO NOT override process.env.PORT
 */

'use strict';

const http = require('http');
const express = require('express');

const app = express();

/* ======================================
   Core Express Setup
====================================== */

app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ======================================
   Health Check (Railway REQUIRED)
====================================== */

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

/* ======================================
   Root Route (prevents 502 / blank page)
====================================== */

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'bossmind-orchestrator',
    status: 'running',
    time: new Date().toISOString(),
  });
});

/* ======================================
   Load API Routes (optional)
====================================== */

try {
  const routes = require('./routes/index.cjs');
  if (typeof routes === 'function') {
    app.use('/', routes);
  } else if (routes && typeof routes.router === 'function') {
    app.use('/', routes.router);
  }
} catch (err) {
  console.warn('[BossMind] routes not loaded:', err?.message || err);
}

/* ======================================
   404 Fallback
====================================== */

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

/* ======================================
   Railway-SAFE Server Boot
====================================== */

if (!process.env.PORT) {
  console.error('[BossMind][FATAL] process.env.PORT is missing');
  process.exit(1);
}

const PORT = Number(process.env.PORT);
const HOST = '0.0.0.0';

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`[BossMind] server listening on http://${HOST}:${PORT}`);
});

/* ======================================
   Graceful Shutdown
====================================== */

function shutdown(signal) {
  console.log(`[BossMind] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/* ======================================
   Safety Nets
====================================== */

process.on('unhandledRejection', (err) => {
  console.error('[BossMind] unhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[BossMind] uncaughtException:', err);
  process.exit(1);
});

/* ======================================
   Exports (used by bossmind-worker.js)
====================================== */

module.exports = {
  app,
  server,
};
