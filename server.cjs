'use strict';

const express = require('express');

const app = express();
app.disable('x-powered-by');

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
