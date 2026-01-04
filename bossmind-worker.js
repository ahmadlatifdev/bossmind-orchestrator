'use strict';

/**
 * BossMind – Railway Entry Worker (ROOT)
 * Start command: node bossmind-worker.js
 * This worker loads the real server entry and keeps the process alive.
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

// Prefer root server.cjs (the file we just fixed)
if (safeLoad('./server.cjs')) {
  // Do NOT exit — server.cjs must keep the process alive by listening on PORT
  return;
}

// Fallbacks (case-safe / legacy)
const tried = [
  './Server/server.cjs',
  './Server/server.js',
  './server/server.cjs',
  './server/server.js',
  './app/server.cjs',
  './app/server.js',
];

for (const p of tried) {
  if (safeLoad(p)) return;
}

console.error('❌ BossMind failed to start. No server entry found.');
console.error('Expected one of:');
console.error(['./server.cjs', ...tried].map(x => `- ${x}`).join('\n'));
process.exit(1);
