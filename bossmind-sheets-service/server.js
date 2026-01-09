/**
 * BossMind — Queue + Script Engine (KokiDodi)
 * - Receives Make webhook → processes ONE job
 * - Locks input row (KokiDodi-1) READY → PROCESSING → COMPLETED/FAILED
 * - Generates 8–12 minute cinematic script via DeepSeek
 * - Appends result to output sheet (AI Video Titles Automation) with Status=COMPLETED
 *
 * ENV REQUIRED (Railway Variables):
 *   PORT=8080 (Railway sets this automatically)
 *   DEEPSEEK_API_KEY=...
 *
 *   GOOGLE_SHEET_ID=...                         (the spreadsheet ID)
 *   GOOGLE_SERVICE_ACCOUNT_JSON=...             (full JSON string)  OR
 *   GOOGLE_SERVICE_ACCOUNT_BASE64=...           (base64 of the JSON)
 *
 * OPTIONAL:
 *   INPUT_SHEET_NAME=KokiDodi-1
 *   OUTPUT_SHEET_NAME=AI Video Titles Automation
 *   STATUS_COL=E
 *   ERROR_COL=I
 *   DEEPSEEK_MODEL=deepseek-chat
 *   WEBHOOK_SECRET=...                          (recommended; Make sends x-bossmind-secret)
 *   BOSSMIND_STATE=ACTIVE                       (ACTIVE required; LOCKED disables)
 */

import express from "express";
import crypto from "crypto";
import { google } from "googleapis";

const app = express();

// Accept JSON + raw (some webhooks send text)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// --------- ENV ----------
const PORT = Number(process.env.PORT || 8080);

const BOSSMIND_STATE = (process.env.BOSSMIND_STATE || "ACTIVE").toUpperCase();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const INPUT_SHEET_NAME = process.env.INPUT_SHEET_NAME || "KokiDodi-1";
const OUTPUT_SHEET_NAME = process.env.OUTPUT_SHEET_NAME || "AI Video Titles Automation";

const STATUS_COL = process.env.STATUS_COL || "E";
const ERROR_COL = process.env.ERROR_COL || "I";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // if set, require header x-bossmind-secret

// --------- HELPERS ----------
function mask(s, keep = 6) {
  if (!s) return "";
  if (s.length <= keep) return "*".repeat(s.length);
  return s.slice(0, keep) + "*".repeat(Math.max(4, s.length - keep));
}

function getServiceAccountJSON() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

  if (raw && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Sometimes user pastes JSON with escaped \n. Try to normalize.
      const normalized = raw.replace(/\\n/g, "\n");
      return JSON.parse(normalized);
    }
  }

  if (b64 && b64.trim()) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    try {
      return JSON.parse(decoded);
    } catch (e) {
      const normalized = decoded.replace(/\\n/g, "\n");
      return JSON.parse(normalized);
    }
  }

  throw new Error(
    "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_BASE64"
  );
}

function requireEnv() {
  const missing = [];
  if (!DEEPSEEK_API_KEY) missing.push("DEEPSEEK_API_KEY");
  if (!GOOGLE_SHEET_ID) missing.push("GOOGLE_SHEET_ID");

  // Service account must exist
  try {
    getServiceAccountJSON();
  } catch {
    missing.push("GOOGLE_SERVICE_ACCOUNT_JSON/BASE64");
  }

  if (missing.length) {
    throw new Error("Missing env: " + missing.join(", "));
  }
}

function safeStr(v) {
  return (v ?? "").toString().trim();
}

// Supports multiple payload shapes coming from Make
function extractJob(payload) {
  // Common shapes:
  // 1) { title, moral, theme, rowNumber }
  // 2) { data: { title, moral, theme, rowNumber } }
  // 3) { row: { A, B, C, rowNumber } }
  // 4) { Title, Moral, Theme } etc.

  const p = payload || {};
  const d = p.data || p.row || p.payload || p;

  const title =
    safeStr(d.title) || safeStr(d.Title) || safeStr(d.A) || safeStr(p.title);
  const moral =
    safeStr(d.moral) || safeStr(d.Moral) || safeStr(d.B) || safeStr(p.moral);
  const theme =
    safeStr(d.theme) || safeStr(d.Theme) || safeStr(d.C) || safeStr(p.theme);

  // Row number in the input sheet (1-based)
  const rowNumberRaw =
    d.rowNumber ?? d.row ?? p.rowNumber ?? p.row ?? d.RowNumber ?? d.Row;
  const rowNumber = rowNumberRaw ? Number(rowNumberRaw) : null;

  return { title, moral, theme, rowNumber };
}

function nowISO() {
  return new Date().toISOString();
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

async function getSheetsClient() {
  const sa = getServiceAccountJSON();
  // Normalize private key newlines if needed
  if (sa.private_key && typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function a1(sheetName, col, row) {
  return `'${sheetName.replace(/'/g, "''")}'!${col}${row}`;
}

async function updateCell(sheets, sheetName, col, row, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: a1(sheetName, col, row),
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}

async function appendRow(sheets, sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `'${sheetName.replace(/'/g, "''")}'!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function findExistingCompletedByTitle(sheets, title) {
  // Looks at output sheet columns A (Title) and E (Status)
  // If same Title exists with COMPLETED, we skip appending to prevent duplicates.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `'${OUTPUT_SHEET_NAME.replace(/'/g, "''")}'!A:E`,
  });

  const rows = res.data.values || [];
  const target = title.trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    const t = (rows[i]?.[0] || "").toString().trim().toLowerCase();
    const st = (rows[i]?.[4] || "").toString().trim().toUpperCase();
    if (t && t === target && st === "COMPLETED") return true;
  }
  return false;
}

async function deepseekGenerateScript({ title, moral, theme }) {
  const prompt = `
You are BossMind Script Writer for the Koki & Dodi YouTube channel.
Write ONE complete cinematic story script designed to produce a 8–12 minute video.
Target: kids/family adventure with a strong moral lesson.

REQUIREMENTS:
- Language: English
- Use main characters: Koki and Dodi (consistent names)
- Structure with clear headings:
  1) Hook (0:00–0:30)
  2) Setup
  3) Rising Action (at least 4 scenes)
  4) Climax
  5) Resolution + Moral recap
- Include scene-by-scene narration + dialogue.
- Add short ambient sound cues in brackets like: [wind], [forest ambience], [mystery music]
- Keep it safe, positive, non-violent, age-appropriate.
- Make it cinematic (visual descriptions, emotions, pacing).

INPUT:
Title: ${title}
Moral: ${moral}
Theme: ${theme}

OUTPUT:
Return only the full script text (no JSON).
`.trim();

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: "You are a precise professional screenplay writer." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`DeepSeek HTTP ${resp.status}: ${t.slice(0, 400)}`);
  }

  const json = await resp.json();
  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    "";

  const cleaned = (text || "").toString().trim();
  if (!cleaned) throw new Error("DeepSeek returned empty script.");
  return cleaned;
}

// --------- ROUTES ----------
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "bossmind-sheets-service",
    state: BOSSMIND_STATE,
    time: nowISO(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, state: BOSSMIND_STATE, time: nowISO() });
});

app.post("/api/queue", async (req, res) => {
  try {
    if (BOSSMIND_STATE !== "ACTIVE") {
      return res.status(423).json({ ok: false, error: "BOSSMIND_STATE is not ACTIVE" });
    }

    // Optional secret gate from Make
    if (WEBHOOK_SECRET) {
      const got = req.headers["x-bossmind-secret"];
      if (safeStr(got) !== safeStr(WEBHOOK_SECRET)) {
        return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
      }
    }

    requireEnv();

    const payload = req.body || {};
    const { title, moral, theme, rowNumber } = extractJob(payload);

    if (!title || !moral || !theme) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: title, moral, theme",
        received: { title: !!title, moral: !!moral, theme: !!theme, rowNumber },
      });
    }

    const sheets = await getSheetsClient();

    // Lock input row if we have rowNumber
    if (rowNumber && Number.isFinite(rowNumber)) {
      await updateCell(sheets, INPUT_SHEET_NAME, STATUS_COL, rowNumber, "PROCESSING");
      await updateCell(sheets, INPUT_SHEET_NAME, ERROR_COL, rowNumber, "");
    }

    // Dedup guard: if already completed in output sheet, skip generating to avoid repeats
    const already = await findExistingCompletedByTitle(sheets, title);
    if (already) {
      if (rowNumber && Number.isFinite(rowNumber)) {
        await updateCell(sheets, INPUT_SHEET_NAME, STATUS_COL, rowNumber, "COMPLETED");
      }
      return res.json({ ok: true, skipped: true, reason: "Already COMPLETED in output", title });
    }

    // Generate script (8–12 min cinematic)
    const script = await deepseekGenerateScript({ title, moral, theme });

    // Append to output sheet:
    // Columns expected (from your screenshots):
    // A Title | B Moral | C Theme | D Script | E Status | F Reviewed
    await appendRow(sheets, OUTPUT_SHEET_NAME, [
      title,
      moral,
      theme,
      script,
      "COMPLETED",
      "", // Reviewed
    ]);

    // Mark input row done
    if (rowNumber && Number.isFinite(rowNumber)) {
      await updateCell(sheets, INPUT_SHEET_NAME, STATUS_COL, rowNumber, "COMPLETED");
    }

    return res.json({
      ok: true,
      title,
      rowNumber,
      outputSheet: OUTPUT_SHEET_NAME,
      scriptChars: script.length,
      jobId: sha1(`${title}|${moral}|${theme}`),
      time: nowISO(),
    });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);

    // Best-effort: if payload included rowNumber, mark FAILED + error
    try {
      const { rowNumber } = extractJob(req.body || {});
      if (rowNumber && Number.isFinite(Number(rowNumber))) {
        const sheets = await getSheetsClient();
        await updateCell(sheets, INPUT_SHEET_NAME, STATUS_COL, Number(rowNumber), "FAILED");
        await updateCell(sheets, INPUT_SHEET_NAME, ERROR_COL, Number(rowNumber), msg.slice(0, 500));
      }
    } catch {
      // ignore
    }

    return res.status(500).json({ ok: false, error: msg, time: nowISO() });
  }
});

// --------- START ----------
app.listen(PORT, () => {
  // Railway logs will show this line
  console.log(`bossmind-sheets-service listening on ${PORT}`);
  console.log(`BOSSMIND_STATE=${BOSSMIND_STATE}`);
  console.log(`DEEPSEEK_API_KEY=${mask(DEEPSEEK_API_KEY)}`);
  console.log(`SHEET_ID=${mask(GOOGLE_SHEET_ID, 8)}`);
  console.log(`INPUT_SHEET_NAME=${INPUT_SHEET_NAME}`);
  console.log(`OUTPUT_SHEET_NAME=${OUTPUT_SHEET_NAME}`);
});
