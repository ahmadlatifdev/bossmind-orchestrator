/**
 * bossmind-worker.js
 * Railway may force this as the start command.
 * This file MUST start the real web server and keep the process alive.
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

// Force safe defaults (Railway provides PORT automatically)
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.PORT = process.env.PORT || '3000';

const serverEntry = path.join(__dirname, 'Server', 'server.cjs');

try {
  log('Booting real server entry:', serverEntry);

  // IMPORTANT: Server/server.cjs must call server.listen(process.env.PORT, '0.0.0.0')
  const exported = require(serverEntry);

  // Optional: if Server/server.cjs exports a server, we can log its address after a short delay
  setTimeout(() => {
    try {
      const srv = exported?.server;
      if (srv && typeof srv.address === 'function') {
        const addr = srv.address();
        if (addr) log('Server address:', addr);
      }
    } catch (_) {}
  }, 500);

  log(`Expected listen on HOST=${process.env.HOST} PORT=${process.env.PORT}`);

} catch (e) {
  fatal('Failed to require Server/server.cjs:', e?.stack || e);
}

// Keep process alive (Railway expects a long-running process)
setInterval(() => {
  log('heartbeat', new Date().toISOString());
}, 60_000).unref();

// Graceful shutdown
function shutdown(signal) {
  log(`${signal} received, exiting...`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[BossMindWorker] unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[BossMindWorker] uncaughtException:', err);
  process.exit(1);
});
