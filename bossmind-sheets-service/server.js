/**
 * BossMind — Queue API (Zero-Make-Mapping Mode)
 * Make sends ONLY: { rowNumber }
 * BossMind fetches Title/Moral/Theme from Google Sheet, validates READY, locks row to PROCESSING, then queues.
 *
 * Endpoints:
 *  GET  /health
 *  POST /api/queue
 *  GET  /api/queue/next
 *  POST /api/queue/ack
 *
 * Required ENV:
 *  PORT
 *  BOSSMIND_WEBHOOK_SECRET
 *  GOOGLE_SHEET_ID
 *  GOOGLE_SHEET_NAME
 *
 * Optional ENV:
 *  BOSSMIND_MAINTENANCE=1
 *  BOSSMIND_MAX_INFLIGHT=3
 *  BOSSMIND_RATE_LIMIT_PER_MIN=60
 *  BOSSMIND_IDEMPOTENCY_TTL_MS=86400000
 *  BOSSMIND_JOB_TTL_MS=3600000
 */

const express = require("express");
const crypto = require("crypto");

const app = express();

// ---------- Config ----------
const PORT = Number(process.env.PORT || 3000);

const SECRET = String(process.env.BOSSMIND_WEBHOOK_SECRET || "").trim();
const MAINTENANCE = String(process.env.BOSSMIND_MAINTENANCE || "").trim() === "1";

const MAX_INFLIGHT = clampInt(process.env.BOSSMIND_MAX_INFLIGHT, 1, 50, 3);
const RATE_LIMIT_PER_MIN = clampInt(process.env.BOSSMIND_RATE_LIMIT_PER_MIN, 5, 6000, 60);

const IDEMPOTENCY_TTL_MS = clampInt(
  process.env.BOSSMIND_IDEMPOTENCY_TTL_MS,
  60_000,
  7 * 24 * 3600_000,
  24 * 3600_000
);
const JOB_TTL_MS = clampInt(process.env.BOSSMIND_JOB_TTL_MS, 60_000, 24 * 3600_000, 3600_000);

const GOOGLE_SHEET_ID = String(process.env.GOOGLE_SHEET_ID || "").trim();
const GOOGLE_SHEET_NAME = String(process.env.GOOGLE_SHEET_NAME || "").trim();

if (!SECRET) {
  console.error("❌ BOSSMIND_WEBHOOK_SECRET is missing.");
  process.exit(1);
}
if (!GOOGLE_SHEET_ID || !GOOGLE_SHEET_NAME) {
  console.error("❌ GOOGLE_SHEET_ID / GOOGLE_SHEET_NAME is missing.");
  process.exit(1);
}

// ---------- Middleware ----------
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  req.bossmindId = crypto.randomBytes(8).toString("hex");
  res.setHeader("X-BossMind-Request-Id", req.bossmindId);
  next();
});

// Rate limiter
const rateBucket = new Map();
app.use((req, res, next) => {
  const key = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString();
  const now = Date.now();
  const entry = rateBucket.get(key);

  if (!entry || now > entry.resetAt) {
    rateBucket.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_PER_MIN) {
    return res.status(429).json({
      ok: false,
      error: "RATE_LIMIT",
      requestId: req.bossmindId,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  next();
});

// Maintenance gate
app.use((req, res, next) => {
  if (!MAINTENANCE) return next();
  if (req.path === "/health") return next();
  return res.status(503).json({ ok: false, error: "MAINTENANCE_MODE", requestId: req.bossmindId });
});

// Secret validation
function validateSecret(req) {
  const headerSecret = String(req.headers["x-bossmind-secret"] || "").trim();
  const querySecret = String(req.query.secret || "").trim();
  const incoming = headerSecret || querySecret;
  if (!incoming) return false;

  const aa = Buffer.from(incoming);
  const bb = Buffer.from(SECRET);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

// ---------- In-memory queue ----------
const queue = [];
const jobsById = new Map();
const idempotency = new Map(); // key -> { jobId, expiresAt }
let inFlight = 0;

// ---------- Helpers ----------
function clampInt(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function cleanStr(v, maxLen) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isIntLike(v) {
  if (typeof v === "number" && Number.isInteger(v)) return true;
  if (typeof v === "string" && v.trim() !== "" && Number.isInteger(Number(v))) return true;
  return false;
}
function toInt(v) {
  return typeof v === "number" ? v : Number(String(v).trim());
}

function nowISO() {
  return new Date().toISOString();
}

function makeIdempotencyKey({ title, moral, theme, rowNumber }) {
  const raw = `${rowNumber}::${title}::${theme}::${moral}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function purgeExpired() {
  const now = Date.now();

  for (const [k, v] of idempotency.entries()) {
    if (now > v.expiresAt) idempotency.delete(k);
  }

  for (const job of queue) {
    if (job.status !== "PROCESSING") continue;
    if (now - job.updatedAt > JOB_TTL_MS) {
      job.status = "FAILED";
      job.updatedAt = now;
      job.error = { code: "STUCK_PROCESSING_TIMEOUT", message: `Auto-failed after ${JOB_TTL_MS}ms in PROCESSING` };
      inFlight = Math.max(0, inFlight - 1);
    }
  }
}
setInterval(purgeExpired, 15_000).unref();

// ---------- Google Sheets (BossMind reads the truth) ----------
async function getSheetsClient() {
  // Uses Google ADC / Workload Identity if available in runtime.
  // (No secrets stored in Make)
  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function fetchRowAndLockToProcessing(rowNumber) {
  const sheets = await getSheetsClient();

  // We need Title(A), Moral(B), Theme(C), Status(E)
  const range = `${GOOGLE_SHEET_NAME}!A${rowNumber}:E${rowNumber}`;

  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = (getRes.data && getRes.data.values && getRes.data.values[0]) || [];
  const title = cleanStr(values[0], 140);
  const moral = cleanStr(values[1], 500);
  const theme = cleanStr(values[2], 140);
  const status = cleanStr(values[4], 40).toUpperCase();

  if (!title || !moral || !theme) {
    return { ok: false, error: "SHEET_ROW_MISSING_FIELDS", message: "Row must have Title/Moral/Theme filled." };
  }
  if (status !== "READY") {
    return { ok: false, error: "SHEET_ROW_NOT_READY", message: `Row status is "${status}", expected "READY".` };
  }

  // Lock row status -> PROCESSING (column E)
  const updateRange = `${GOOGLE_SHEET_NAME}!E${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: updateRange,
    valueInputOption: "RAW",
    requestBody: { values: [["PROCESSING"]] },
  });

  return { ok: true, title, moral, theme };
}

// ---------- Routes ----------
app.get("/health", (req, res) => {
  purgeExpired();
  res.status(200).json({
    ok: true,
    service: "bossmind-queue",
    time: nowISO(),
    maintenance: MAINTENANCE,
    inFlight,
    queued: queue.filter((j) => j.status === "QUEUED").length,
    processing: queue.filter((j) => j.status === "PROCESSING").length,
    completed: queue.filter((j) => j.status === "COMPLETED").length,
    failed: queue.filter((j) => j.status === "FAILED").length,
  });
});

// Accepts either:
//  A) Legacy payload: { title, moral, theme, rowNumber }
//  B) Zero-Make-Mapping: { rowNumber }  (BossMind fetches the row)
app.post("/api/queue", async (req, res) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", requestId: req.bossmindId });
  }

  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("application/json")) {
    return res.status(400).json({ ok: false, error: "INVALID_CONTENT_TYPE", requestId: req.bossmindId });
  }

  purgeExpired();
  if (inFlight >= MAX_INFLIGHT) {
    return res.status(429).json({
      ok: false,
      error: "MAX_INFLIGHT_REACHED",
      requestId: req.bossmindId,
      maxInFlight: MAX_INFLIGHT,
    });
  }

  const body = req.body || {};

  if (!isIntLike(body.rowNumber)) {
    return res.status(400).json({ ok: false, error: "SCHEMA_ROWNUMBER", requestId: req.bossmindId });
  }
  const rowNumber = toInt(body.rowNumber);

  let title = cleanStr(body.title, 140);
  let moral = cleanStr(body.moral, 500);
  let theme = cleanStr(body.theme, 140);

  // Zero-Make-Mapping mode: fetch from sheet if missing
  if (!title || !moral || !theme) {
    try {
      const fetched = await fetchRowAndLockToProcessing(rowNumber);
      if (!fetched.ok) {
        return res.status(400).json({
          ok: false,
          error: fetched.error,
          message: fetched.message,
          requestId: req.bossmindId,
        });
      }
      title = fetched.title;
      moral = fetched.moral;
      theme = fetched.theme;
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "SHEET_FETCH_FAILED",
        message: String(e && e.message ? e.message : e),
        requestId: req.bossmindId,
      });
    }
  }

  if (!title || !moral || !theme) {
    return res.status(400).json({
      ok: false,
      error: "MISSING_FIELDS",
      got: { title, moral, theme, rowNumber },
      requestId: req.bossmindId,
    });
  }

  const idemKey = makeIdempotencyKey({ title, moral, theme, rowNumber });
  const existing = idempotency.get(idemKey);
  if (existing && Date.now() <= existing.expiresAt) {
    return res.status(200).json({ ok: true, deduped: true, jobId: existing.jobId, requestId: req.bossmindId });
  }

  const jobId = crypto.randomBytes(10).toString("hex");
  const now = Date.now();

  const job = {
    jobId,
    createdAt: now,
    updatedAt: now,
    status: "QUEUED",
    title,
    moral,
    theme,
    rowNumber,
  };

  queue.push(job);
  jobsById.set(jobId, job);
  idempotency.set(idemKey, { jobId, expiresAt: now + IDEMPOTENCY_TTL_MS });

  return res.status(202).json({ ok: true, jobId, status: job.status, requestId: req.bossmindId });
});

app.get("/api/queue/next", (req, res) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", requestId: req.bossmindId });
  }

  purgeExpired();

  const job = queue.find((j) => j.status === "QUEUED");
  if (!job) return res.status(204).send();

  job.status = "PROCESSING";
  job.updatedAt = Date.now();
  inFlight += 1;

  return res.status(200).json({
    ok: true,
    job: { jobId: job.jobId, title: job.title, moral: job.moral, theme: job.theme, rowNumber: job.rowNumber },
    requestId: req.bossmindId,
  });
});

app.post("/api/queue/ack", (req, res) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", requestId: req.bossmindId });
  }

  const body = req.body || {};
  const jobId = cleanStr(body.jobId, 64);
  const ok = Boolean(body.ok);

  if (!jobId) return res.status(400).json({ ok: false, error: "SCHEMA_JOBID", requestId: req.bossmindId });

  const job = jobsById.get(jobId);
  if (!job) return res.status(404).json({ ok: false, error: "JOB_NOT_FOUND", requestId: req.bossmindId });

  if (job.status !== "PROCESSING") {
    return res.status(409).json({
      ok: false,
      error: "INVALID_STATUS_TRANSITION",
      currentStatus: job.status,
      expected: "PROCESSING",
      requestId: req.bossmindId,
    });
  }

  job.updatedAt = Date.now();

  if (ok) {
    job.status = "COMPLETED";
  } else {
    job.status = "FAILED";
    const code = cleanStr(body.errorCode || "WORKER_FAILED", 80);
    const msg = cleanStr(body.errorMessage || "Worker reported failure", 500);
    job.error = { code, message: msg };
  }

  inFlight = Math.max(0, inFlight - 1);

  return res.status(200).json({ ok: true, jobId, status: job.status, requestId: req.bossmindId });
});

app.use((req, res) => res.status(404).json({ ok: false, error: "NOT_FOUND", requestId: req.bossmindId }));

app.listen(PORT, () => {
  console.log(`✅ bossmind-sheets-service listening on ${PORT}`);
  console.log(`BOSSMIND_STATE=ACTIVE`);
});
