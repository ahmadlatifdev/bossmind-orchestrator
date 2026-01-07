/**
 * Server/server.cjs
 * BossMind Orchestrator – Railway-safe HTTP server + Stripe webhook raw-body support
 */

'use strict';

const http = require('http');
const express = require('express');

const app = express();

app.set('trust proxy', 1);

/**
 * IMPORTANT (Stripe):
 * Stripe signature verification requires the RAW request body.
 * So we must use express.raw() on the webhook route BEFORE express.json().
 */
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Normal JSON for everything else
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   Health + Root
========================= */

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'bossmind-orchestrator',
    status: 'running',
    time: new Date().toISOString(),
  });
});

/* =========================
   Routes
========================= */

try {
  const routes = require('./routes/index.cjs');
  app.use('/', routes);
} catch (err) {
  console.warn('[BossMind] routes not loaded:', err?.message || err);
}

/* =========================
   404
========================= */

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

/* =========================
   Railway-safe listen
========================= */

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

/* =========================
   Shutdown + Safety
========================= */

function shutdown(signal) {
  console.log(`[BossMind] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => console.error('[BossMind] unhandledRejection:', err));
process.on('uncaughtException', (err) => {
  console.error('[BossMind] uncaughtException:', err);
  process.exit(1);
});

module.exports = { app, server };
