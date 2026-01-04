// bossmind-worker.js (ESM-safe Railway entry)
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeLoad(relPath) {
  try {
    const abs = path.resolve(__dirname, relPath);
    require(abs);
    console.log(`[BossMind] Loaded: ${relPath}`);
    return true;
  } catch (e) {
    // keep it quiet but visible in logs
    console.warn(`[BossMind] Skipped: ${relPath}`);
    return false;
  }
}

// Try all likely locations (case + folder variants)
const candidates = [
  "./server.cjs",
  "./server.js",
  "./Server/server.cjs",
  "./Server/server.js",
  "./server/server.cjs",
  "./server/server.js",
  "./app/server.cjs",
  "./app/server.js",
];

let started = false;
for (const p of candidates) {
  if (safeLoad(p)) {
    started = true;
    break;
  }
}

if (!started) {
  console.error("BossMind failed to start. No server entry found.");
  process.exit(1);
}
