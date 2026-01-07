/* Server/server.cjs */
'use strict';

const http = require('http');
const express = require('express');

const app = express();

// Railway / proxy safe
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (VERY important for Railway)
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Routes
try {
  const routes = require('./routes/index.cjs');
  if (typeof routes === 'function') {
    app.use('/', routes);
  } else if (routes?.router) {
    app.use('/', routes.router);
  }
} catch (e) {
  console.warn('[BossMind] routes not loaded:', e.message);
}

// Fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

/* ================================
   CRITICAL PART (Railway-safe)
================================ */

// Railway ALWAYS injects PORT
if (!process.env.PORT) {
  console.error('[BossMind] FATAL: process.env.PORT is missing');
  process.exit(1);
}

const PORT = Number(process.env.PORT);
const HOST = '0.0.0.0';

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`[BossMind] server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = (sig) => {
  console.log(`[BossMind] ${sig} received`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', console.error);
process.on('uncaughtException', (e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { app, server };
