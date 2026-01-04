'use strict';

/**
 * BossMind – Railway Entry Worker (ROOT)
 * Loads the server entry from the most reliable locations.
 */

function safeLoad(p) {
  try {
    require(p);
    console.log(`[BossMind] Loaded: ${p}`);
    return true;
  } catch (e) {
    return false;
  }
}

// ✅ 1) Prefer root server.cjs (we will ensure it exists)
if (safeLoad('./server.cjs')) process.exit(0);

// ✅ 2) Fallbacks (folder variants)
const started =
  safeLoad('./Server/server.cjs') ||
  safeLoad('./Server/server.js') ||
  safeLoad('./server/server.cjs') ||
  safeLoad('./server/server.js') ||
  safeLoad('./app/server.cjs') ||
  safeLoad('./app/server.js');

if (!started) {
  console.error('❌ BossMind failed to start. No server entry found.');
  process.exit(1);
}
