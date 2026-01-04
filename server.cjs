'use strict';

<<<<<<< HEAD
const express = require('express');
=======
// Root server entry (CommonJS) — Railway will run: node bossmind-worker.js
// bossmind-worker.js will require this file. This file MUST start listening.

const express = require('express');
const cors = require('cors');
>>>>>>> 53d471fd800e5c76508f5e2fcb15ab391c4dba7e

const app = express();
app.disable('x-powered-by');

<<<<<<< HEAD
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = Number(process.env.PORT || 8080);
const STARTED_AT = Date.now();

/* =========================
   HEALTH CHECK (REQUIRED)
========================= */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    port: PORT,
  });
});

/* =========================
   ROOT
========================= */
app.get('/', (req, res) => {
  res.send('BossMind Orchestrator is running');
});

/* =========================
   START SERVER (CRITICAL)
========================= */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BossMind server listening on port ${PORT}`);
});
=======
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const STARTED_AT = Date.now();
const PORT = Number(process.env.PORT || 8080);

// Health
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'bossmind-orchestrator',
    startedAt: new Date(STARTED_AT).toISOString(),
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
  });
});

// Root
app.get('/', (req, res) => {
  res.status(200).send('BossMind Orchestrator is running. Try /health');
});

// Start listening (critical)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BossMind] Listening on 0.0.0.0:${PORT}`);
});

// Keep CommonJS export (harmless, sometimes useful)
module.exports = app;
>>>>>>> 53d471fd800e5c76508f5e2fcb15ab391c4dba7e
