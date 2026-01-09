import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/**
 * BossMind – Sheets Service (KokiDodi)
 * Accepts Make / Apps Script jobs
 * Writes logs so Railway HTTP logs show activity
 */

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.BOSSMIND_SECRET || "bossmind";

/* ============ HEALTH ============ */
app.get("/health", (req, res) => {
  console.log("HEALTH_CHECK");
  res.json({ ok: true, state: "ACTIVE", time: new Date().toISOString() });
});

/* ============ QUEUE (GET for browser test) ============ */
app.get("/queue", (req, res) => {
  console.log("GET /queue");
  res.json({ ok: true, message: "Use POST /queue or POST /api/queue" });
});

app.get("/api/queue", (req, res) => {
  console.log("GET /api/queue");
  res.json({ ok: true, message: "Use POST /queue or POST /api/queue" });
});

/* ============ QUEUE (POST) ============ */
app.post("/queue", handleQueue);
app.post("/api/queue", handleQueue);

function handleQueue(req, res) {
  console.log("QUEUE_REQUEST_HEADERS:", req.headers);
  console.log("QUEUE_REQUEST_BODY:", JSON.stringify(req.body));

  // simple auth
  const token = req.headers["x-bossmind-key"];
  if (token !== AUTH_TOKEN) {
    console.log("AUTH_FAIL");
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { title, moral, theme, rowNumber } = req.body || {};

  if (!title || !rowNumber) {
    console.log("INVALID_PAYLOAD");
    return res.status(400).json({ ok: false, error: "Missing title or rowNumber" });
  }

  console.log("QUEUE_ACCEPTED:", { title, moral, theme, rowNumber });

  // For now we just acknowledge — DeepSeek + Sheets logic can run here later
  return res.json({
    ok: true,
    received: { title, moral, theme, rowNumber },
    state: "QUEUED"
  });
}

/* ============ START ============ */
app.listen(PORT, () => {
  console.log("bossmind-sheets-service listening on", PORT);
  console.log("BOSSMIND_STATE=ACTIVE");
});
