import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/**
 * ENV required:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON  (the full JSON content, pasted as one line)
 *  - GOOGLE_SHEET_ID
 *  - GOOGLE_SHEET_NAME            (tab name, e.g. "AI Cinematic Script Automation")
 * Optional:
 *  - PORT
 *  - ALLOWED_ORIGIN               (BossMind dashboard domain; if empty allows all)
 */

const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

// Optional tighter CORS
if (ALLOWED_ORIGIN) {
  app.use(
    cors({
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
}

function requireEnv(name) {
  if (!process.env[name] || process.env[name].trim() === "") {
    throw new Error(`Missing env: ${name}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Support users pasting JSON with newlines escaped or accidental whitespace
    return JSON.parse(jsonStr.replace(/\n/g, "\\n"));
  }
}

async function getSheetsClient() {
  requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  requireEnv("GOOGLE_SHEET_ID");
  requireEnv("GOOGLE_SHEET_NAME");

  const creds = safeJsonParse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

/**
 * Reads all rows in the sheet and returns:
 *  - headers: string[]
 *  - rows: array of objects by header
 *  - rowIndexMap: array mapping rows[] index -> actual sheet row number
 */
async function readAllRows(sheets) {
  const range = `${SHEET_NAME}!A1:Z`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range
  });

  const values = res.data.values || [];
  if (values.length < 2) {
    return { headers: values[0] || [], rows: [], rowIndexMap: [] };
  }

  const headers = values[0].map((h) => (h || "").trim());
  const rows = [];
  const rowIndexMap = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? "";
    });
    rows.push(obj);
    rowIndexMap.push(i + 1); // sheet row number (1-based)
  }

  return { headers, rows, rowIndexMap };
}

function colIndexToA1(colIndex) {
  // 1 -> A, 26 -> Z, 27 -> AA ...
  let n = colIndex;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function findHeaderIndex(headers, headerName) {
  return headers.findIndex((h) => h.toLowerCase() === headerName.toLowerCase());
}

async function getCellValue(sheets, a1) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${a1}`
  });
  const v = r.data.values?.[0]?.[0] ?? "";
  return v;
}

async function updateCells(sheets, updates) {
  // updates: [{ rangeA1, values: [[...]] }]
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map((u) => ({
        range: `${SHEET_NAME}!${u.rangeA1}`,
        values: u.values
      }))
    }
  });
}

/**
 * Picks next READY row and locks it to QUEUED.
 * Race-minimized with re-check of status cell before update.
 */
async function pickAndLockNextTitle(sheets) {
  const { headers, rows, rowIndexMap } = await readAllRows(sheets);

  const requiredHeaders = ["id", "title", "language", "status", "picked_at", "used_at", "video_id"];
  for (const h of requiredHeaders) {
    if (findHeaderIndex(headers, h) === -1) {
      throw new Error(`Missing required column header: "${h}"`);
    }
  }

  // Find first READY (top-down)
  const readyIdx = rows.findIndex((r) => String(r.status || "").trim().toUpperCase() === "READY");
  if (readyIdx === -1) {
    return { found: false, message: "No READY titles found." };
  }

  const sheetRow = rowIndexMap[readyIdx]; // actual sheet row number
  const statusCol = findHeaderIndex(headers, "status") + 1;
  const pickedAtCol = findHeaderIndex(headers, "picked_at") + 1;

  const statusA1 = `${colIndexToA1(statusCol)}${sheetRow}`;
  const pickedAtA1 = `${colIndexToA1(pickedAtCol)}${sheetRow}`;

  // Re-check status directly to reduce race
  const currentStatus = String(await getCellValue(sheets, statusA1)).trim().toUpperCase();
  if (currentStatus !== "READY") {
    return { found: false, message: "Row was taken by another process. Try again." };
  }

  const pickedAt = nowIso();
  await updateCells(sheets, [
    { rangeA1: statusA1, values: [["QUEUED"]] },
    { rangeA1: pickedAtA1, values: [[pickedAt]] }
  ]);

  const pickedRow = rows[readyIdx];
  return {
    found: true,
    picked: {
      sheet_row: sheetRow,
      id: pickedRow.id,
      title: pickedRow.title,
      language: pickedRow.language,
      status: "QUEUED",
      picked_at: pickedAt
    }
  };
}

/**
 * Marks a QUEUED row as USED.
 * Requires: sheet_row OR id.
 */
async function markUsed(sheets, { sheet_row, id, video_id }) {
  const { headers, rows, rowIndexMap } = await readAllRows(sheets);

  const usedAtCol = findHeaderIndex(headers, "used_at") + 1;
  const statusCol = findHeaderIndex(headers, "status") + 1;
  const videoIdCol = findHeaderIndex(headers, "video_id") + 1;
  const idCol = findHeaderIndex(headers, "id") + 1;

  if (![usedAtCol, statusCol, videoIdCol, idCol].every((x) => x > 0)) {
    throw new Error("Missing required columns for mark-used.");
  }

  let targetRowNum = null;

  if (sheet_row) {
    targetRowNum = Number(sheet_row);
  } else if (id) {
    const idx = rows.findIndex((r) => String(r.id).trim() === String(id).trim());
    if (idx !== -1) targetRowNum = rowIndexMap[idx];
  }

  if (!targetRowNum) {
    return { ok: false, message: "Row not found." };
  }

  const usedAtA1 = `${colIndexToA1(usedAtCol)}${targetRowNum}`;
  const statusA1 = `${colIndexToA1(statusCol)}${targetRowNum}`;
  const videoIdA1 = `${colIndexToA1(videoIdCol)}${targetRowNum}`;

  const usedAt = nowIso();
  const updates = [
    { rangeA1: statusA1, values: [["USED"]] },
    { rangeA1: usedAtA1, values: [[usedAt]] }
  ];
  if (video_id) {
    updates.push({ rangeA1: videoIdA1, values: [[String(video_id)]] });
  }

  await updateCells(sheets, updates);
  return { ok: true, used_at: usedAt, sheet_row: targetRowNum };
}

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "bossmind-sheets-service", time: nowIso() });
});

// Pick next title and lock it
app.get("/api/next-title", async (_req, res) => {
  try {
    const sheets = await getSheetsClient();
    const result = await pickAndLockNextTitle(sheets);
    res.json(result);
  } catch (err) {
    res.status(500).json({ found: false, error: String(err?.message || err) });
  }
});

// Mark used
app.post("/api/mark-used", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const { sheet_row, id, video_id } = req.body || {};
    const result = await markUsed(sheets, { sheet_row, id, video_id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`BossMind Sheets Service running on :${PORT}`);
});
