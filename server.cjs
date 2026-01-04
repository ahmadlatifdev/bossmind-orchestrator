<<<<<<< HEAD
// Server/server.cjs
"use strict";

const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");

/* =========================
   GLOBAL MIDDLEWARE
========================= */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* =========================
   RUNTIME STATE
========================= */
const STARTED_AT = Date.now();
const PORT = Number(process.env.PORT || 8080);

/* =========================
   SAFE REQUIRE
========================= */
function safeRequire(p) {
  try {
    return require(p);
  } catch (e) {
    console.warn("⚠️ Skipped loading:", p);
=======
// server.js (ESM) — BossMind Orchestrator Entrypoint (Railway runs: node server.js)
import express from "express";
import cors from "cors";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const app = express();
app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const STARTED_AT = Date.now();
const PORT = Number(process.env.PORT || 8080);

function isoNow() {
  return new Date().toISOString();
}
function uptimeSeconds() {
  return Math.floor((Date.now() - STARTED_AT) / 1000);
}
function safeRequire(p) {
  try {
    return require(p);
  } catch {
>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
    return null;
  }
}

/* =========================
<<<<<<< HEAD
   CORE ROUTES
========================= */
const healthRoute = safeRequire("./routes/health.cjs");
const adminRoute = safeRequire("./routes/admin.cjs");
const openrouterRoute = safeRequire("./routes/openrouter.cjs");
const n8nRoute = safeRequire("./routes/n8n.cjs");

/* =========================
   ROUTE REGISTRATION
========================= */
if (healthRoute) app.use("/api/health", healthRoute);
if (adminRoute) app.use("/admin", adminRoute);
=======
   OPTIONAL: LOAD EXTRA ROUTES (IF PRESENT)
   (Does not break anything if missing)
========================= */
const openrouterRoute = safeRequire("./Server/routes/openrouter.cjs");
const n8nRoute = safeRequire("./Server/routes/n8n.cjs");

>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
if (openrouterRoute) app.use("/openrouter", openrouterRoute);
if (n8nRoute) app.use("/n8n", n8nRoute);

/* =========================
<<<<<<< HEAD
   ROOT INFO
=======
   ROOT (keep existing behavior + include /admin)
>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    service: "BossMind Orchestrator",
    status: "running",
<<<<<<< HEAD
    endpoints: ["/api/health", "/admin", "/admin/activate"],
=======
    endpoints: ["/api/health", "/admin/activate", "/admin"],
>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
  });
});

/* =========================
<<<<<<< HEAD
   ADMIN DASHBOARD UI
========================= */
app.get("/admin", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`.replace(
    "http://",
    "https://"
  );

  res.status(200).send(`
<!doctype html>
=======
   HEALTH (match your current JSON)
========================= */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "BossMind Orchestrator",
    health: "OK",
    node: process.version,
    uptime_seconds: uptimeSeconds(),
    timestamp: isoNow(),
  });
});

/* =========================
   ACTIVATE (match your current JSON)
========================= */
app.get("/admin/activate", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BossMind Orchestrator is ACTIVE",
    source: "GET",
    timestamp: isoNow(),
  });
});

/* =========================
   ADMIN DASHBOARD UI (NEW)
========================= */
app.get("/admin", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`.replace("http://", "https://");

  // Default project URLs (safe)
  const BUILDER_URL = process.env.SMART_AI_BUILDER_URL || "https://builder.elegancyart.com";
  const VIDEO_URL = process.env.AI_VIDEO_GENERATOR_URL || "https://ai-video-generator.elegancyart.com";

  const html = `<!doctype html>
>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BossMind Admin Dashboard</title>
<style>
<<<<<<< HEAD
  body{
    margin:0;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    background:#070A12;
    color:#fff;
  }
  .wrap{max-width:1100px;margin:0 auto;padding:32px}
  h1{margin:0 0 8px;font-size:20px}
  p{margin:0 0 20px;color:#bbb}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  .card{
    border:1px solid rgba(255,255,255,.1);
    border-radius:14px;
    padding:16px;
    background:rgba(255,255,255,.04);
  }
  .card h2{margin:0 0 6px;font-size:16px}
  .card span{color:#aaa;font-size:13px}
  a.btn{
    display:inline-block;
    margin-top:12px;
    padding:10px 12px;
    border-radius:10px;
    text-decoration:none;
    color:#fff;
    border:1px solid rgba(255,255,255,.15);
  }
  a.btn:hover{border-color:#8A7DFF}
</style>
</head>
<body>
<div class="wrap">
  <h1>BossMind Admin Dashboard</h1>
  <p>Live control panel for all BossMind projects</p>

  <div class="grid">
    <div class="card">
      <h2>BossMind Core</h2>
      <span>Orchestrator • Health • Automation Brain</span>
      <a class="btn" href="${baseUrl}/api/health" target="_blank">Health</a>
      <a class="btn" href="${baseUrl}/admin/activate" target="_blank">Activate</a>
    </div>

    <div class="card">
      <h2>Smart AI Builder</h2>
      <span>Website & AI Builder System</span>
      <a class="btn" href="https://builder.elegancyart.com" target="_blank">Open</a>
    </div>

    <div class="card">
      <h2>AI Video Generator</h2>
      <span>Scripts → Video → Publish</span>
      <a class="btn" href="https://ai-video-generator.elegancyart.com" target="_blank">Open</a>
    </div>
  </div>
</div>
</body>
</html>
  `);
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BossMind Orchestrator listening on :${PORT}`);
=======
  :root{
    --bg:#070A12; --panel:#0B1020; --stroke:rgba(255,255,255,.10);
    --text:rgba(255,255,255,.92); --muted:rgba(255,255,255,.62);
    --good:#2BE4A7; --accent:#8A7DFF;
  }
  *{box-sizing:border-box}
  body{
    margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    background: radial-gradient(1200px 600px at 20% 10%, rgba(138,125,255,.14), transparent 60%),
                radial-gradient(900px 500px at 80% 30%, rgba(43,228,167,.10), transparent 65%),
                var(--bg);
    color:var(--text);
  }
  .wrap{max-width:1100px;margin:0 auto;padding:28px 18px 40px}
  .top{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:18px;border:1px solid var(--stroke);border-radius:18px;
    background:rgba(255,255,255,.04);
  }
  h1{margin:0;font-size:18px}
  .sub{margin:6px 0 0;color:var(--muted);font-size:13px}
  .pill{
    display:inline-flex;align-items:center;gap:10px;
    padding:8px 10px;border-radius:999px;border:1px solid var(--stroke);
    background:rgba(255,255,255,.03);color:var(--muted);font-size:12px;
    white-space:nowrap;
  }
  .dot{width:8px;height:8px;border-radius:999px;background:var(--accent)}
  .dot.ok{background:var(--good)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}
  @media(max-width:980px){.grid{grid-template-columns:1fr}}
  .card{
    border:1px solid var(--stroke);border-radius:18px;overflow:hidden;
    background:rgba(255,255,255,.04);
  }
  .head{padding:16px 16px 10px;display:flex;justify-content:space-between;gap:10px}
  .title strong{display:block;font-size:15px}
  .title span{display:block;margin-top:6px;color:var(--muted);font-size:12px}
  .body{padding:0 16px 16px}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  a.btn{
    text-decoration:none;color:var(--text);
    border:1px solid var(--stroke);background:rgba(255,255,255,.03);
    padding:10px 12px;border-radius:12px;font-size:13px;
  }
  a.btn:hover{border-color:rgba(138,125,255,.45)}
  .foot{
    margin-top:14px;padding:14px 16px;border:1px solid var(--stroke);
    border-radius:18px;background:rgba(255,255,255,.02);
    color:var(--muted);font-size:12px;display:flex;gap:12px;flex-wrap:wrap;
    justify-content:space-between;
  }
  code{color:rgba(255,255,255,.86)}
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>BossMind Admin Dashboard</h1>
        <div class="sub">Live control panel for your 3 projects (Railway runtime).</div>
      </div>
      <div class="pill"><span id="dot" class="dot"></span><span id="status">Checking health…</span></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="head">
          <div class="title">
            <strong>BossMind Core</strong>
            <span>Orchestrator • Health • Automation brain</span>
          </div>
        </div>
        <div class="body">
          <div class="row">
            <a class="btn" href="${baseUrl}/api/health" target="_blank" rel="noreferrer">Health</a>
            <a class="btn" href="${baseUrl}/admin/activate" target="_blank" rel="noreferrer">Activate</a>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="head">
          <div class="title">
            <strong>Smart AI Builder</strong>
            <span>Luxury AI builder dashboard</span>
          </div>
        </div>
        <div class="body">
          <div class="row">
            <a class="btn" href="${BUILDER_URL}" target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="head">
          <div class="title">
            <strong>AI Video Generator</strong>
            <span>Scripts → scenes → render → publish</span>
          </div>
        </div>
        <div class="body">
          <div class="row">
            <a class="btn" href="${VIDEO_URL}" target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      </div>
    </div>

    <div class="foot">
      <div>Service: <code>bossmind-orchestrator</code></div>
      <div>URL: <code>${baseUrl}</code></div>
      <div>Refresh: <code>15s</code></div>
    </div>
  </div>

<script>
  const healthUrl = ${JSON.stringify("${baseUrl}/api/health")};
  const dot = document.getElementById("dot");
  const status = document.getElementById("status");

  async function check(){
    try{
      const r = await fetch(${JSON.stringify(baseUrl + "/api/health")}, { cache: "no-store" });
      const j = await r.json();
      const ok = !!(j && j.success && j.health === "OK");
      dot.className = ok ? "dot ok" : "dot";
      status.textContent = ok ? "Orchestrator: HEALTH OK" : "Orchestrator: ISSUE";
    }catch(e){
      dot.className = "dot";
      status.textContent = "Orchestrator: OFFLINE";
    }
  }
  check();
  setInterval(check, 15000);
</script>
</body>
</html>`;

  res.status(200).setHeader("content-type", "text/html; charset=utf-8");
  res.send(html);
});

/* =========================
   FALLBACK
========================= */
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not Found", path: req.path });
});

/* =========================
   START
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BossMind Orchestrator listening on ${PORT}`);
>>>>>>> e404de1cf560c8c677a88d1bf7934f07afa63976
});
