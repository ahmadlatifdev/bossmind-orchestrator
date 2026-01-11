'use strict';

/**
 * BossMind Orchestrator — Sheets + Queue API (Unified)
 * - Fixes 404 on /, /api/queue, /queue/run, /queue/tick
 * - Keeps /health working
 * - Adds safe enqueue endpoint for Make.com / HeroPage / Worker
 *
 * Node: 18+
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// If your runtime is Node 18+, fetch exists globally.
// If not, uncomment next line and add dependency: npm i node-fetch
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let google;
let GoogleAuth;
try {
  ({ google } = require('googleapis'));
  ({ GoogleAuth } = require('google-auth-library'));
} catch (_) {
  // google libs optional until you enable sheet pulling via env vars
}

const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   ENV + CONFIG
========================= */
const PORT = Number(process.env.PORT || 8080);

const BOSSMIND_STATE = process.env.BOSSMIND_STATE || process.env.BOSSMIND_MODE || 'ACTIVE';
const BOSSMIND_SECRET = (process.env.BOSSMIND_SECRET || process.env.WEBHOOK_SECRET || '').trim();

// Optional: Make.com / external worker forwarding
const WORKER_WEBHOOK_URL = (process.env.WORKER_WEBHOOK_URL || '').trim(); // e.g. https://worker-service.up.railway.app/worker/consume
const WORKER_WEBHOOK_SECRET = (process.env.WORKER_WEBHOOK_SECRET || BOSSMIND_SECRET || '').trim();

// Optional: Sheet pull settings (only used when configured)
const GOOGLE_SERVICE_ACCOUNT_JSON = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
const GOOGLE_SHEET_ID = (process.env.GOOGLE_SHEET_ID || '').trim();
const GOOGLE_SHEET_NAME = (process.env.GOOGLE_SHEET_NAME || process.env.SHEET_NAME || 'KokiDodi-1').trim();

// Columns (1-based like Sheets UI). Default status column = E, error column = I
const STATUS_COL = Number(process.env.STATUS_COL || 5);
const ERROR_COL = Number(process.env.ERROR_COL || 9);

// Status values
const STATUS_READY = (process.env.STATUS_READY || 'READY').trim();
const STATUS_PROCESSING = (process.env.STATUS_PROCESSING || 'PROCESSING').trim();
const STATUS_COMPLETED = (process.env.STATUS_COMPLETED || 'COMPLETED').trim();
const STATUS_FAILED = (process.env.STATUS_FAILED || 'FAILED').trim();

// Pull batch size per tick
const PULL_BATCH = Number(process.env.PULL_BATCH || 25);

// Internal
const NOW = () => new Date().toISOString();

/* =========================
   In-Memory Queue
========================= */
const queue = [];
const metrics = {
  startedAt: NOW(),
  inFlight: 0,
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  lastTickAt: null,
  lastRunAt: null,
};

function makeId() {
  return crypto.randomBytes(12).toString('hex');
}

function safeJson(obj) {
  try { return JSON.stringify(obj); } catch { return '{"ok":false}'; }
}

function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

function requireSecret(req) {
  // Accept either header or query
  const got =
    (req.headers['x-bossmind-secret'] || req.headers['x-webhook-secret'] || req.query?.secret || '')
      .toString()
      .trim();

  // If no secret configured, do not block (for easy bring-up).
  if (!BOSSMIND_SECRET) return { ok: true };

  if (!got || got !== BOSSMIND_SECRET) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  }
  return { ok: true };
}

async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/* =========================
   Google Sheets Helpers (Optional)
========================= */
async function getSheetsClient() {
  if (!google || !GoogleAuth) throw new Error('GOOGLE_LIBS_MISSING');
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_MISSING');
  if (!GOOGLE_SHEET_ID) throw new Error('GOOGLE_SHEET_ID_MISSING');

  let creds;
  try {
    creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_INVALID');
  }

  const auth = new GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

function colToLetter(colNum1Based) {
  let col = colNum1Based;
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

async function pullReadyRowsFromSheet(limit = PULL_BATCH) {
  // If sheet env not set, do nothing (still supports manual enqueue).
  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_SHEET_ID) return [];

  const sheets = await getSheetsClient();

  // Read A:I (9 cols) by default to include status and error.
  const readRange = `${GOOGLE_SHEET_NAME}!A:I`;
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: readRange,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const values = data.values || [];
  if (values.length <= 1) return [];

  // Assume row 1 is header.
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const rowNumber = i + 1;

    const status = (row[STATUS_COL - 1] || '').toString().trim();
    if (status !== STATUS_READY) continue;

    const title = (row[0] || '').toString().trim();
    const moral = (row[1] || '').toString().trim();
    const theme = (row[2] || '').toString().trim();

    if (!title) continue;

    out.push({ rowNumber, title, moral, theme });
    if (out.length >= limit) break;
  }

  return out;
}

async function setSheetStatus(rowNumber, status, errorText = '') {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_SHEET_ID) return;

  const sheets = await getSheetsClient();

  const statusColLetter = colToLetter(STATUS_COL);
  const errorColLetter = colToLetter(ERROR_COL);

  const statusRange = `${GOOGLE_SHEET_NAME}!${statusColLetter}${rowNumber}`;
  const errorRange = `${GOOGLE_SHEET_NAME}!${errorColLetter}${rowNumber}`;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: statusRange, values: [[status]] },
        { range: errorRange, values: [[errorText || '']] },
      ],
    },
  });
}

/* =========================
   Queue Core
========================= */
function enqueueJob(payload, meta = {}) {
  const job = {
    id: makeId(),
    createdAt: NOW(),
    status: 'QUEUED',
    payload: {
      title: payload.title || '',
      moral: payload.moral || '',
      theme: payload.theme || '',
      rowNumber: payload.rowNumber || null,
      lang: payload.lang || null,
      project: payload.project || 'AI Video Generator',
      ...payload,
    },
    meta: {
      source: meta.source || 'manual',
      ip: meta.ip || '',
      ua: meta.ua || '',
      ...meta,
    },
  };

  queue.push(job);
  metrics.queued = queue.filter(j => j.status === 'QUEUED').length;
  return job;
}

function listQueue() {
  const counts = {
    queued: queue.filter(j => j.status === 'QUEUED').length,
    processing: queue.filter(j => j.status === 'PROCESSING').length,
    completed: queue.filter(j => j.status === 'COMPLETED').length,
    failed: queue.filter(j => j.status === 'FAILED').length,
  };
  return { items: queue.slice(-200).reverse(), counts };
}

async function forwardToWorker(job) {
  if (!WORKER_WEBHOOK_URL) return { ok: false, skipped: true, reason: 'WORKER_WEBHOOK_URL_NOT_SET' };

  const res = await fetchWithTimeout(
    WORKER_WEBHOOK_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bossmind-secret': WORKER_WEBHOOK_SECRET,
      },
      body: safeJson({
        jobId: job.id,
        ...job.payload,
      }),
    },
    20000
  );

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 400) };
  }
  return { ok: true, status: res.status, body: text.slice(0, 400) };
}

async function processOneQueuedJob() {
  const job = queue.find(j => j.status === 'QUEUED');
  if (!job) return { ok: true, empty: true };

  job.status = 'PROCESSING';
  job.startedAt = NOW();
  metrics.inFlight = 1;
  metrics.processing = queue.filter(j => j.status === 'PROCESSING').length;
  metrics.queued = queue.filter(j => j.status === 'QUEUED').length;

  // If linked to Sheets, mark sheet as PROCESSING
  if (job.payload?.rowNumber) {
    await setSheetStatus(job.payload.rowNumber, STATUS_PROCESSING, '');
  }

  try {
    const workerRes = await forwardToWorker(job);

    // If no worker configured, we keep job as QUEUED? No — mark FAILED with clear reason.
    if (workerRes.skipped) {
      job.status = 'FAILED';
      job.failedAt = NOW();
      job.error = workerRes.reason;

      if (job.payload?.rowNumber) {
        await setSheetStatus(job.payload.rowNumber, STATUS_FAILED, workerRes.reason);
      }

      metrics.failed += 1;
      return { ok: false, error: workerRes.reason };
    }

    // Worker accepted
    job.status = 'COMPLETED';
    job.completedAt = NOW();
    job.worker = workerRes;

    if (job.payload?.rowNumber) {
      await setSheetStatus(job.payload.rowNumber, STATUS_COMPLETED, '');
    }

    metrics.completed += 1;
    return { ok: true, jobId: job.id, worker: workerRes };
  } catch (e) {
    const msg = (e && e.message) ? e.message : 'WORKER_ERROR';

    job.status = 'FAILED';
    job.failedAt = NOW();
    job.error = msg;

    if (job.payload?.rowNumber) {
      await setSheetStatus(job.payload.rowNumber, STATUS_FAILED, msg);
    }

    metrics.failed += 1;
    return { ok: false, error: msg };
  } finally {
    metrics.inFlight = 0;
    metrics.processing = queue.filter(j => j.status === 'PROCESSING').length;
    metrics.queued = queue.filter(j => j.status === 'QUEUED').length;
  }
}

/* =========================
   ROUTES
========================= */

// Root (fixes GET / 404)
app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'bossmind-sheets-service',
    role: 'sheets+queue',
    state: BOSSMIND_STATE,
    time: NOW(),
    routes: [
      'GET /health',
      'GET /api/queue',
      'POST /api/queue',
      'POST /queue/tick',
      'POST /queue/run',
    ],
  });
});

// Health
app.get('/health', (req, res) => {
  const q = listQueue().counts;
  res.status(200).json({
    ok: true,
    service: 'bossmind-queue',
    time: NOW(),
    maintenance: BOSSMIND_STATE !== 'ACTIVE',
    inFlight: metrics.inFlight,
    queued: q.queued,
    processing: q.processing,
    completed: q.completed,
    failed: q.failed,
  });
});

// Queue list (fixes GET /api/queue 404)
app.get('/api/queue', (req, res) => {
  const q = listQueue();
  res.status(200).json({ ok: true, ...q });
});

// Enqueue (for Make.com / HeroPage / anything)
app.post('/api/queue', (req, res) => {
  const auth = requireSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  const body = req.body || {};
  const title = (body.title || '').toString().trim();
  if (!title) return res.status(400).json({ ok: false, error: 'TITLE_REQUIRED' });

  const job = enqueueJob(
    {
      title,
      moral: (body.moral || '').toString(),
      theme: (body.theme || '').toString(),
      rowNumber: body.rowNumber ?? null,
      project: body.project || 'AI Video Generator',
      lang: body.lang ?? null,
    },
    {
      source: body.source || 'api',
      ip: getClientIp(req),
      ua: (req.headers['user-agent'] || '').toString(),
    }
  );

  res.status(201).json({ ok: true, jobId: job.id });
});

// Tick: Pull READY rows from sheet -> enqueue -> process 1 job
app.post('/queue/tick', async (req, res) => {
  const auth = requireSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  if (BOSSMIND_STATE !== 'ACTIVE') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'BOSSMIND_NOT_ACTIVE' });
  }

  metrics.lastTickAt = NOW();

  try {
    const pulled = await pullReadyRowsFromSheet(PULL_BATCH);
    const enqueued = [];

    for (const r of pulled) {
      const job = enqueueJob(
        { ...r, project: 'AI Video Generator', source: 'sheet' },
        { source: 'sheet', ip: getClientIp(req), ua: (req.headers['user-agent'] || '').toString() }
      );
      enqueued.push(job.id);
    }

    const processed = await processOneQueuedJob();
    res.status(200).json({
      ok: true,
      pulled: pulled.length,
      enqueued: enqueued.length,
      processed,
    });
  } catch (e) {
    const msg = (e && e.message) ? e.message : 'TICK_FAILED';
    res.status(500).json({ ok: false, error: msg });
  }
});

// Run: process jobs until queue empty OR max N
app.post('/queue/run', async (req, res) => {
  const auth = requireSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  if (BOSSMIND_STATE !== 'ACTIVE') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'BOSSMIND_NOT_ACTIVE' });
  }

  metrics.lastRunAt = NOW();

  const max = Number(req.body?.max || 10);
  const results = [];

  try {
    // First pull from sheet (optional)
    const pulled = await pullReadyRowsFromSheet(PULL_BATCH);
    for (const r of pulled) {
      enqueueJob(
        { ...r, project: 'AI Video Generator', source: 'sheet' },
        { source: 'sheet', ip: getClientIp(req), ua: (req.headers['user-agent'] || '').toString() }
      );
    }

    for (let i = 0; i < max; i++) {
      const r = await processOneQueuedJob();
      results.push(r);
      if (r && r.empty) break;
    }

    res.status(200).json({
      ok: true,
      pulled: pulled.length,
      processed: results.length,
      results,
    });
  } catch (e) {
    const msg = (e && e.message) ? e.message : 'RUN_FAILED';
    res.status(500).json({ ok: false, error: msg });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  // Keep logs minimal (Railway)
  console.log(`bossmind-sheets-service listening on ${PORT}`);
  console.log(`BOSSMIND_STATE=${BOSSMIND_STATE}`);
});
