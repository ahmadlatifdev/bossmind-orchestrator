// Server/server.cjs

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================
   GLOBAL MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   SAFE ROUTE LOADER
========================= */
function safeRequire(p) {
  try {
    return require(p);
  } catch (e) {
    console.warn("⚠️ Skipped loading:", p);
    return null;
  }
}

/* =========================
   CORE ROUTES
========================= */
const healthRoute = safeRequire("./routes/health.cjs");
const openrouterRoute = safeRequire("./routes/openrouter.cjs");
const n8nRoute = safeRequire("./routes/n8n.cjs");

/* =========================
   ROUTE REGISTRATION
========================= */
if (healthRoute) {
  app.use("/health", healthRoute);
}

if (openrouterRoute) {
  app.use("/openrouter", openrouterRoute);
}

if (n8nRoute) {
  app.use("/n8n", n8nRoute);
}

/* =========================
   FALLBACK
========================= */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "BossMind Orchestrator",
    status: "running",
    ts: new Date().toISOString(),
  });
});

/* =========================
   PORT HANDLING (SAFE)
========================= */
const PORT_FILE = path.join(__dirname, ".bossmind-port");
let PORT = process.env.PORT || 5000;

try {
  if (fs.existsSync(PORT_FILE)) {
    const saved = parseInt(fs.readFileSync(PORT_FILE, "utf8"));
    if (!isNaN(saved)) PORT = saved;
  }
} catch (_) {}

app.listen(PORT, () => {
  try {
    fs.writeFileSync(PORT_FILE, String(PORT));
  } catch (_) {}

  console.log(`🚀 BossMind Orchestrator running on port ${PORT}`);
});
