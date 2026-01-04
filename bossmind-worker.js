"use strict";

/**
 * BossMind Worker — Railway Safe Bootstrap
 * If running on Railway (PORT is set), we directly start the real server entry
 * instead of scanning/looping for files.
 */

function isRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_SERVICE_ID ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.PORT
  );
}

function tryRequire(p) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require(p);
    console.log(`[BossMind] Started server via: ${p}`);
    return true;
  } catch (e) {
    console.log(`[BossMind] Skip require: ${p}`);
    return false;
  }
}

/**
 * HARD GUARANTEE:
 * On Railway, we start the server from known locations (no scanning).
 */
if (isRailwayRuntime()) {
  console.log("[BossMind] Railway runtime detected — starting server directly...");

  const candidates = [
    "./Server/server.cjs",
    "./Server/server.js",
    "./server.cjs",
    "./server.js",
    "./app/server.cjs",
    "./app/server.js",
  ];

  for (const p of candidates) {
    if (tryRequire(p)) {
      // If server module starts listening, we're done.
      // Keep process alive.
      setInterval(() => {}, 1 << 30);
      break;
    }
  }

  console.error(
    "[BossMind] FATAL: Could not start server from known entries. Check that Server/server.cjs exists and listens on process.env.PORT."
  );
  process.exit(1);
}

/**
 * Non-Railway: optional local/dev behavior
 * If you still want scanning locally, keep it minimal and safe.
 */
console.log("[BossMind] Non-Railway runtime — nothing to do here.");
console.log("[BossMind] Tip: run the server directly: node Server/server.cjs");
process.exit(0);
