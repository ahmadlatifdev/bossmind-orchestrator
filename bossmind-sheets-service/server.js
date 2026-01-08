/**
 * BossMind Sheets Service (Railway)
 * - GET  /health
 * - GET  /debug/env         (safe, no secrets)
 * - GET  /api/next-title    (find first READY row -> set QUEUED + picked_at -> return title/row)
 * - POST /api/mark-used     (set USED + used_at + optional video_id)
 *
 * Env required:
 * - GOOGLE_SERVICE_ACCOUNT_JSON  (full JSON string)
 * - GOOGLE_SHEET_ID
 * - GOOGLE_SHEET_NAME
 * Optional:
 * - ALLOWED_ORIGIN               (for CORS, e.g. https://ai.elegancyart.com)
 */

import express from "express";
import cors from "cors";
import { google } from "googleapis";

const app = express();

/* -------------------- middleware -------------------- */
app.use(express.json({ limit: "2mb" }));

const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim();
app.use(
  cors({
    origin: allowedOrigin ? allowedOrigin : true,
    credentials: true,
  })
);

/* -------------------- helpers -------------------- */
function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    const err = new Error(`Missing required env var: ${name}`);
    err.statusCode = 500;
    throw err;
  }
  return String(v).trim();
}

function safeJsonParse(str, label) {
  try {
    return JSON.parse(str);
  } catch (e) {
    const err = new Error(`Invalid JSON in ${label}`);
    err.statusCode = 500;
    throw err;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeHeader(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function colToA1(colIndex1Based) {
  // 1 -> A, 26 -> Z, 27 -> AA ...
  let n = colIndex1Based;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

async function getSheetsClient() {
  const jsonStr = requiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  const sheetId = requiredEnv("GOOGLE_SHEET_ID");
  const sheetName = requiredEnv("GOOGLE_SHEET_NAME");

  const creds = safeJsonParse(jsonStr, "GOOGLE_SERVICE_ACCOUNT_JSON");

  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth: jwt });
  return { sheets, sheetId, sheetName };
}

async function readHeaderMap(sheets, sheetId, sheetName) {
  // Read first row as headers
  const range = `${sheetName}!1:1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const headers = (res.data.values?.[0] || []).map((h) => String(h ?? ""));
  const map = {};
  headers.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key) map[key] = idx; // 0-based
  });
  return { headers, map };
}

function ensureColumn(map, key) {
  const k = normalizeHeader(key);
  if (map[k] === undefined) {
    const err = new Error(`Missing column in sheet header row: ${key}`);
    err.statusCode = 500;
    throw err;
  }
  return map[k]; // 0-based
}

async function findFirstReadyRow(sheets, sheetId, sheetName, header) {
  // Read all rows (safe for moderate sheets). If huge later, we can optimize.
  const range = `${sheetName}!A:ZZ`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const values = res.data.values || [];
  if (values.length < 2) return null; // header only

  const { map } = header;
  const statusIdx = ensureColumn(map, "status");

  // Row index in Sheets is 1-based; values[0] is header row
  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const status = String(row[statusIdx] || "").trim().toUpperCase();
    if (status === "READY") {
      return { sheetRowNumber: r + 1, rowValues: row, allValues: values };
    }
  }
  return null;
}

async function updateCells(sheets, sheetId, updates) {
  // updates: [{ range: "Sheet!A2", value: "x" }, ...]
  if (!updates.length) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map((u) => ({
        range: u.range,
        values: [[u.value]],
      })),
    },
  });
}

function rowToObject(header, rowValues) {
  const obj = {};
  header.headers.forEach((h, idx) => {
    const key = normalizeHeader(h) || `col_${idx + 1}`;
    obj[key] = rowValues?.[idx] ?? "";
  });
  return obj;
}

/* -------------------- routes -------------------- */
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-sheets-service",
    time: nowIso(),
  });
});

app.get("/", (req, res) => {
  res.status(200).send("BossMind Sheets Service is running. Try /health");
});

app.get("/debug/env", (req, res) => {
  res.status(200).json({
    ok: true,
    hasDeepseekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    deepseekModel: process.env.DEEPSEEK_MODEL || null,
    hasGoogleServiceAccountJson: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    hasGoogleSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
    hasGoogleSheetName: Boolean(process.env.GOOGLE_SHEET_NAME),
    allowedOrigin: process.env.ALLOWED_ORIGIN || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
});

/**
 * GET /api/next-title
 * Finds first row where status=READY, sets status=QUEUED and picked_at=now, returns title + row details
 */
app.get("/api/next-title", async (req, res) => {
  try {
    const { sheets, sheetId, sheetName } = await getSheetsClient();
    const header = await readHeaderMap(sheets, sheetId, sheetName);

    const found = await findFirstReadyRow(sheets, sheetId, sheetName, header);
    if (!found) {
      return res.status(200).json({
        ok: true,
        message: "No READY rows found",
        picked: null,
        time: nowIso(),
      });
    }

    const { map } = header;
    const statusIdx = ensureColumn(map, "status");
    const pickedAtIdx = map["picked_at"] !== undefined ? map["picked_at"] : null;

    // Optional columns
    const titleIdx =
      map["title"] !== undefined
        ? map["title"]
        : map["video_title"] !== undefined
        ? map["video_title"]
        : null;

    if (titleIdx === null) {
      const err = new Error("Missing column in sheet header row: title (or video_title)");
      err.statusCode = 500;
      throw err;
    }

    const rowNumber = found.sheetRowNumber;
    const pickedAt = nowIso();

    // Build updates
    const updates = [];

    // status -> QUEUED
    updates.push({
      range: `${sheetName}!${colToA1(statusIdx + 1)}${rowNumber}`,
      value: "QUEUED",
    });

    // picked_at -> now (only if column exists)
    if (pickedAtIdx !== null) {
      updates.push({
        range: `${sheetName}!${colToA1(pickedAtIdx + 1)}${rowNumber}`,
        value: pickedAt,
      });
    }

    await updateCells(sheets, sheetId, updates);

    // Prepare response
    const rowObj = rowToObject(header, found.rowValues);
    const title = String(found.rowValues[titleIdx] || "").trim();

    return res.status(200).json({
      ok: true,
      picked: {
        sheet: sheetName,
        row: rowNumber,
        title,
        picked_at: pickedAt,
      },
      row: rowObj,
      time: nowIso(),
    });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: String(e?.message || e),
      time: nowIso(),
    });
  }
});

/**
 * POST /api/mark-used
 * Body: { row: number, video_id?: string }
 * Sets status=USED, used_at=now, optionally video_id
 */
app.post("/api/mark-used", async (req, res) => {
  try {
    const row = Number(req.body?.row);
    const videoId = req.body?.video_id ? String(req.body.video_id).trim() : "";

    if (!row || Number.isNaN(row) || row < 2) {
      return res.status(400).json({
        ok: false,
        error: "Body must include a valid 'row' number (>= 2).",
        time: nowIso(),
      });
    }

    const { sheets, sheetId, sheetName } = await getSheetsClient();
    const header = await readHeaderMap(sheets, sheetId, sheetName);
    const { map } = header;

    const statusIdx = ensureColumn(map, "status");
    const usedAtIdx = map["used_at"] !== undefined ? map["used_at"] : null;
    const videoIdIdx = map["video_id"] !== undefined ? map["video_id"] : null;

    const usedAt = nowIso();

    const updates = [];

    // status -> USED
    updates.push({
      range: `${sheetName}!${colToA1(statusIdx + 1)}${row}`,
      value: "USED",
    });

    // used_at -> now (if exists)
    if (usedAtIdx !== null) {
      updates.push({
        range: `${sheetName}!${colToA1(usedAtIdx + 1)}${row}`,
        value: usedAt,
      });
    }

    // video_id -> if provided + column exists
    if (videoId && videoIdIdx !== null) {
      updates.push({
        range: `${sheetName}!${colToA1(videoIdIdx + 1)}${row}`,
        value: videoId,
      });
    }

    await updateCells(sheets, sheetId, updates);

    return res.status(200).json({
      ok: true,
      updated: {
        sheet: sheetName,
        row,
        status: "USED",
        used_at: usedAt,
        video_id: videoId || null,
      },
      time: nowIso(),
    });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: String(e?.message || e),
      time: nowIso(),
    });
  }
});

/* -------------------- start -------------------- */
const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ bossmind-sheets-service listening on ${PORT}`);
});
