/**
 * BossMind Sheets Service (Railway)
 * Auth: Google Workload Identity Federation (NO JSON KEY)
 *
 * Required ENV:
 * - GOOGLE_PROJECT_ID
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_WORKLOAD_IDENTITY_POOL_ID
 * - GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID
 * - GOOGLE_SHEET_ID
 * - GOOGLE_SHEET_NAME
 * Optional:
 * - ALLOWED_ORIGIN
 */

import express from "express";
import cors from "cors";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

const app = express();
app.use(express.json());

/* ---------------- CORS ---------------- */
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(
  cors(
    allowedOrigin
      ? { origin: allowedOrigin }
      : { origin: "*" }
  )
);

/* ---------------- AUTH (Workload Identity) ---------------- */
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  clientOptions: {
    subject: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  },
});

/* ---------------- SHEETS CLIENT ---------------- */
async function getSheets() {
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/* ---------------- ROUTES ---------------- */

// Health
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "bossmind-sheets-service",
    time: new Date().toISOString(),
  });
});

// Debug (safe)
app.get("/debug/env", (req, res) => {
  res.json({
    ok: true,
    hasProjectId: Boolean(process.env.GOOGLE_PROJECT_ID),
    hasServiceAccountEmail: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
    hasSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
    hasSheetName: Boolean(process.env.GOOGLE_SHEET_NAME),
    nodeEnv: process.env.NODE_ENV || null,
  });
});

// GET next READY title
app.get("/api/next-title", async (req, res) => {
  try {
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Z`,
    });

    const rows = read.data.values || [];
    if (!rows.length) {
      return res.json({ ok: false, error: "No rows found" });
    }

    const headersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    });
    const headers = headersRes.data.values[0];

    const statusCol = headers.indexOf("status");
    const titleCol = headers.indexOf("title");
    const pickedAtCol = headers.indexOf("picked_at");

    if (statusCol === -1 || titleCol === -1) {
      return res.json({ ok: false, error: "Required columns missing" });
    }

    const rowIndex = rows.findIndex(r => r[statusCol] === "READY");
    if (rowIndex === -1) {
      return res.json({ ok: false, error: "No READY rows" });
    }

    const sheetRow = rowIndex + 2;
    const now = new Date().toISOString();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${String.fromCharCode(65 + statusCol)}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [["QUEUED"]] },
    });

    if (pickedAtCol !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${String.fromCharCode(65 + pickedAtCol)}${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[now]] },
      });
    }

    return res.json({
      ok: true,
      title: rows[rowIndex][titleCol],
      row: sheetRow,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// POST mark USED
app.post("/api/mark-used", async (req, res) => {
  try {
    const { row } = req.body;
    if (!row) {
      return res.json({ ok: false, error: "Row number required" });
    }

    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!B${row}`,
      valueInputOption: "RAW",
      requestBody: { values: [["USED"]] },
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ---------------- START ---------------- */
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ bossmind-sheets-service listening on ${PORT}`);
});
