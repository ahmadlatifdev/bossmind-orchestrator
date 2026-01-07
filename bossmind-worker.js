/**
 * bossmind-worker.js
 * MUST respect Railway dynamic PORT
 */

'use strict';

const path = require('path');

function log(...args) {
  console.log('[BossMindWorker]', ...args);
}
function fatal(...args) {
  console.error('[BossMindWorker][FATAL]', ...args);
  process.exit(1);
}

// ❗ DO NOT override Railway variables
if (!process.env.PORT) {
  fatal('process.env.PORT is missing (Railway did not inject it)');
}

process.env.HOST = '0.0.0.0';

const serverEntry = path.join(__dirname, 'Server', 'server.cjs');

try {
  log('Booting real server entry:', serverEntry);
  require(serverEntry);
  log(`Using Railway PORT=${process.env.PORT}`);
} catch (e) {
  fatal('Failed to boot server:', e.stack || e);
}

// keep process alive
setInterval(() => {}, 60_000).unref();

// graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
