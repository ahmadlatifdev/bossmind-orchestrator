/**
 * BossMind Orchestrator - Server Entrypoint (CommonJS)
 * This file exists to guarantee Railway works even if it starts "server.js".
 */

const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {}

const app = require('./app.cjs');

const PORT =
  process.env.PORT ||
  (() => {
    try {
      const p = fs.readFileSync(path.join(__dirname, '.bossmind-port'), 'utf8').trim();
      return p || 3000;
    } catch (_) {
      return 3000;
    }
  })();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BossMind] server.js running on port ${PORT}`);
});
