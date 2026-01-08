/**
 * BossMind Sheets Service
 * FINAL – authoritative version
 *
 * Routes:
 *  GET  /                → service banner
 *  GET  /health          → health check
 *  GET  /debug/env       → env presence (no secrets)
 *  GET  /api/next-title  → pick first READY row → QUEUED
 *  POST /api/mark-used   → mark row as USED
 */

import express from "express";
import cors from "cors";
import { google } from "googleapis";

/* =========================
   APP SETUP
========================= */
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
  })
);

/* =========================
   UTILITIES
========================= */
const nowISO = () => new Date().toISOString();

const requireEnv = (key) => {
  if (!process.env[key]) {
    throw new Error(`Missing env variable: ${key}`);
  }
  return process.env[key];
};

const colToLetter = (col) => {
  let s = "";
  while (col > 0) {
    let m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - m) / 26);
  }
  return s;
};

/* =========================
   GOOGLE SHEETS
========================= */
async function getSheets() {
  const creds = JSON.parse(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function getSheetMeta() {
  return {
    sheetId: requireEnv("GOOGLE_SHEET_ID"),
    sheetName: requireEnv("GOOGLE_SHEET_NAME"),
  };
}

async function getHeaderMap(sheets, sheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!1:1`,
  });

  const headers = res.data.values[0];
  const map = {};
  headers.forEach((h, i) => {
    map[h.toLowerCase().trim()] = i + 1;
  });
  return map;
}

/* =========================
   ROUTES
========================= */
app.get("/", (req, res) => {
  res.send("BossMind Sheets Service is running. Try /health");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "bossmind-sheets-service",
    time: nowISO(),
  });
});

app.get("/debug/env", (req, res) => {
  res.json({
    ok: true,
    hasDeepseekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    deepseekModel: process.env.DEEPSEEK_MODEL || null,
    hasGoogleServiceAccountJson: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    hasGoogleSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
    hasGoogleSheetName: Boolean(process.env.GOOGLE_SHEET_NAME),
    nodeEnv: process.env.NODE_ENV || "production",
  });
});

/**
 * GET /api/next-title
 * Finds first row with status=READY
 * Sets status=QUEUED + picked_at
 */
app.get("/api/next-title", async (req, res) => {
  try {
    const sheets = await getSheets();
    const { sheetId, sheetName } = await getSheetMeta();
    const headers = await getHeaderMap(sheets, sheetId, sheetName);

    const statusCol = headers["status"];
    const titleCol = headers["title"] || headers["video_title"];
    const pickedAtCol = headers["picked_at"];

    if (!statusCol || !titleCol) {
      throw new Error("Sheet must contain 'status' and 'title' columns");
    }

    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:ZZ`,
    });

    const data = rows.data.values || [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if ((row[statusCol - 1] || "").toUpperCase() === "READY") {
        const rowNum = i + 1;

        const updates = [
          {
            range: `${sheetName}!${colToLetter(statusCol)}${rowNum}`,
            values: [["QUEUED"]],
          },
        ];

        if (pickedAtCol) {
          updates.push({
            range: `${sheetName}!${colToLetter(pickedAtCol)}${rowNum}`,
            values: [[nowISO()]],
          });
        }

        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: updates,
          },
        });

        return res.json({
          ok: true,
          picked: {
            row: rowNum,
            title: row[titleCol - 1],
          },
        });
      }
    }

    res.json({ ok: true, message: "No READY rows found" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/mark-used
 * Body: { row, video_id? }
 */
app.post("/api/mark-used", async (req, res) => {
  try {
    const { row, video_id } = req.body;
    if (!row) throw new Error("row is required");

    const sheets = await getSheets();
    const { sheetId, sheetName } = await getSheetMeta();
    const headers = await getHeaderMap(sheets, sheetId, sheetName);

    const statusCol = headers["status"];
    const usedAtCol = headers["used_at"];
    const videoIdCol = headers["video_id"];

    const updates = [
      {
        range: `${sheetName}!${colToLetter(statusCol)}${row}`,
        values: [["USED"]],
      },
    ];

    if (usedAtCol) {
      updates.push({
        range: `${sheetName}!${colToLetter(usedAtCol)}${row}`,
        values: [[nowISO()]],
      });
    }

    if (video_id && videoIdCol) {
      updates.push({
        range: `${sheetName}!${colToLetter(videoIdCol)}${row}`,
        values: [[video_id]],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });

    res.json({ ok: true, row, status: "USED" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ bossmind-sheets-service listening on ${PORT}`);
});
