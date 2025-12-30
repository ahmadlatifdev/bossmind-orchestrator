/**
 * BossMind Orchestrator - Express App (CommonJS)
 * - Builds the Express app
 * - Mounts existing routes safely (supports both export styles)
 * - Activates /admin/activate via ./routes/admin.cjs
 */

const express = require('express');

// Optional middleware (safe if installed)
let cors;
try {
  cors = require('cors');
} catch (_) {
  cors = null;
}

const app = express();

/* ================================
   CORE MIDDLEWARE
================================ */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (cors) {
  app.use(cors());
}

/* ================================
   SAFE ROUTE LOADER (COMPAT)
   Supports:
   1) module.exports = router
   2) module.exports = (app) => { ... }
================================ */
function mountCompat(prefix, modulePath) {
  let mod;
  try {
    mod = require(modulePath);
  } catch (e) {
    console.warn(`[BossMind] Route module not found: ${modulePath}`);
    return;
  }

  // If module exports a function expecting (app)
  if (typeof mod === 'function') {
    try {
      mod(app);
      console.log(`[BossMind] Mounted function routes from ${modulePath}`);
      return;
    } catch (e) {
      console.error(`[BossMind] Failed mounting function routes from ${modulePath}`, e);
      return;
    }
  }

  // If module exports an object with a router default
  if (mod && typeof mod === 'object' && typeof mod.default === 'function') {
    app.use(prefix, mod.default);
    console.log(`[BossMind] Mounted default router from ${modulePath} at ${prefix}`);
    return;
  }

  // If module exports an Express router
  app.use(prefix, mod);
  console.log(`[BossMind] Mounted router from ${modulePath} at ${prefix}`);
}

/* ================================
   ROUTES
================================ */

// ✅ NEW: Admin activation route
// POST /admin/activate
mountCompat('/admin', './routes/admin.cjs');

// Existing routes (keep them)
mountCompat('/api', './routes/index.cjs');

// If you have openrouter routes in this repo, mount them too (safe)
mountCompat('/openrouter', './routes/openrouter.cjs');

/* ================================
   FALLBACKS
================================ */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    message: 'BossMind Orchestrator is running',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

module.exports = app;
