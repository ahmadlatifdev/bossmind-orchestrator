'use strict';

/**
 * BossMind – Railway Entry Worker
 * --------------------------------
 * This file MUST exist at repo root.
 * Railway Start Command points here.
 * Do NOT rename unless Start Command is changed.
 */

function safeLoad(path) {
  try {
    require(path);
    console.log(`[BossMind] Loaded: ${path}`);
    return true;
  } catch (err) {
    return false;
  }
}

// Try all known server entry locations (case-safe)
const started =
  safeLoad('./Server/server.cjs') ||
  safeLoad('./Server/server.js') ||
  safeLoad('./server/server.cjs') ||
  safeLoad('./server/server.js') ||
  safeLoad('./app/server.cjs') ||
  safeLoad('./app/server.js');

if (!started) {
  console.error(`
❌ BossMind failed to start.
No server entry found.

Expected one of:
- /Server/server.cjs
- /Server/server.js
- /server/server.cjs
- /server/server.js
- /app/server.cjs
- /app/server.js
`);
  process.exit(1);
}

