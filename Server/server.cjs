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
    return null;
  }
}

/* =========================
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
if (openrouterRoute) app.use("/openrouter", openrouterRoute);
if (n8nRoute) app.use("/n8n", n8nRoute);

/* =========================
   ROOT INFO
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    service: "BossMind Orchestrator",
    status: "running",
    endpoints: ["/api/health", "/admin", "/admin/activate"],
  });
});

/* =========================
   ADMIN DASHBOARD UI
========================= */
app.get("/admin", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`.replace(
    "http://",
    "https://"
  );

  res.status(200).send(`
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BossMind Admin Dashboard</title>
<style>
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
});
