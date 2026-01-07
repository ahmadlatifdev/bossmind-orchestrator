// Server/server.cjs
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// ----------------------------
// Basics
// ----------------------------
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ----------------------------
// Health (always available)
// ----------------------------
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    ts: new Date().toISOString(),
  });
});

// ----------------------------
// Routes loader (fixes ../routes issue)
// Loads ONLY from: Server/routes/*
// ----------------------------
function isRouter(obj) {
  return obj && typeof obj === "function" && typeof obj.use === "function";
}

function safeRequire(modulePath) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(modulePath);
  } catch (e) {
    return { __error: e };
  }
}

function loadRoutesFromServerFolder() {
  const routesDir = path.join(__dirname, "routes");

  if (!fs.existsSync(routesDir) || !fs.statSync(routesDir).isDirectory()) {
    console.log("[BossMind] Routes folder not found:", routesDir);
    return;
  }

  // Prefer index.(cjs|js) if present
  const indexCjs = path.join(routesDir, "index.cjs");
  const indexJs = path.join(routesDir, "index.js");

  if (fs.existsSync(indexCjs)) {
    const mod = safeRequire(indexCjs);
    if (mod.__error) {
      console.log("[BossMind] Routes index.cjs failed:", mod.__error.message);
      return;
    }
    const router = mod.router || mod.default || mod;
    if (isRouter(router)) {
      app.use(router);
      console.log("[BossMind] Loaded routes via:", indexCjs);
    } else if (typeof router === "function") {
      router(app);
      console.log("[BossMind] Loaded routes initializer via:", indexCjs);
    } else {
      console.log("[BossMind] index.cjs did not export a router/function.");
    }
    return;
  }

  if (fs.existsSync(indexJs)) {
    const mod = safeRequire(indexJs);
    if (mod.__error) {
      console.log("[BossMind] Routes index.js failed:", mod.__error.message);
      return;
    }
    const router = mod.router || mod.default || mod;
    if (isRouter(router)) {
      app.use(router);
      console.log("[BossMind] Loaded routes via:", indexJs);
    } else if (typeof router === "function") {
      router(app);
      console.log("[BossMind] Loaded routes initializer via:", indexJs);
    } else {
      console.log("[BossMind] index.js did not export a router/function.");
    }
    return;
  }

  // Otherwise load every route file in Server/routes
  const files = fs
    .readdirSync(routesDir)
    .filter((f) => /\.(cjs|js)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log("[BossMind] No route files found in:", routesDir);
    return;
  }

  for (const file of files) {
    const full = path.join(routesDir, file);
    const mod = safeRequire(full);

    if (mod.__error) {
      console.log(`[BossMind] Skipped loading: ./routes/${file} → ${mod.__error.message}`);
      continue;
    }

    const exported = mod.router || mod.default || mod;

    // If module exports { path: "/x", router }
    if (exported && exported.path && exported.router && isRouter(exported.router)) {
      app.use(exported.path, exported.router);
      console.log(`[BossMind] Mounted ./routes/${file} at ${exported.path}`);
      continue;
    }

    // If module exports express.Router
    if (isRouter(exported)) {
      app.use(exported);
      console.log(`[BossMind] Mounted ./routes/${file}`);
      continue;
    }

    // If module exports function(app)
    if (typeof exported === "function") {
      try {
        exported(app);
        console.log(`[BossMind] Initialized ./routes/${file}`);
      } catch (e) {
        console.log(`[BossMind] Route init failed: ./routes/${file} → ${e.message}`);
      }
      continue;
    }

    console.log(`[BossMind] Route file ./routes/${file} has unsupported export.`);
  }
}

loadRoutesFromServerFolder();

// ----------------------------
// Start
// ----------------------------
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`[BossMind] Orchestrator listening on ${HOST}:${PORT}`);
});

module.exports = app;
