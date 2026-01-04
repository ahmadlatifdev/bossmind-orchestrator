// bossmind-worker.js (repo ROOT)
// Purpose: Railway Start Command expects this entry file.
// It loads your real server entry (CommonJS) from /server.

'use strict';

function tryRequire(p) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require(p);
    console.log(`[bossmind-worker] Loaded: ${p}`);
    return true;
  } catch (e) {
    return false;
  }
}

// Try common server entry locations (no crash until all fail)
const ok =
  tryRequire('./server/server.cjs') ||
  tryRequire('./server/index.cjs') ||
  tryRequire('./server/app.cjs') ||
  tryRequire('./server/server.js') ||
  tryRequire('./server/index.js');

if (!ok) {
  console.error(
    '[bossmind-worker] Could not find a server entry. Expected one of:\n' +
      '- ./server/server.cjs\n' +
      '- ./server/index.cjs\n' +
      '- ./server/app.cjs\n' +
      '- ./server/server.js\n' +
      '- ./server/index.js\n'
  );
  process.exit(1);
}
