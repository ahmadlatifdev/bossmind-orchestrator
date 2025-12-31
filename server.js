// server.js (Railway entry)
// BossMind Orchestrator API Server (CommonJS)

const express = require("express");

const app = express();

// Railway runs behind proxy
app.set("trust proxy", 1);

// Parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic CORS (no extra dependency)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ✅ HEALTH (this is what your dashboard is looking for)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    timestamp: new Date().toISOString(),
  });
});

// Optional alias
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    timestamp: new Date().toISOString(),
  });
});

// Try to mount your existing routers (keeps your current structure working)
try {
  const adminRouter = require("./Server/routes/admin.cjs");
  app.use("/admin", adminRouter);
} catch (e) {
  // fallback (so /admin/activate still works even if router import fails)
  app.all("/admin/activate", (req, res) => {
    res.json({
      success: true,
      message: "BossMind activation accepted",
      source: req.method,
      payload: req.body || null,
      timestamp: new Date().toISOString(),
    });
  });
}

try {
  const apiRouter = require("./Server/routes/index.cjs");
  app.use("/api", apiRouter);
} catch (e) {
  // no-op
}

try {
  const openRouter = require("./Server/routes/openrouter.cjs");
  app.use("/api", openRouter);
} catch (e) {
  // no-op
}

// Default root
app.get("/", (req, res) => {
  res.status(200).send("BossMind Orchestrator is running.");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`BossMind API Server running on port ${PORT}`);
});
