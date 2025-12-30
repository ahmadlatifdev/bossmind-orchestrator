const express = require('express');
const cors = require('cors');

const app = express();

/* ================================
   CORE MIDDLEWARE
================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/* ================================
   ROUTES (EXPLICIT)
================================ */

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    timestamp: new Date().toISOString(),
  });
});

// ✅ ADMIN ACTIVATE (THIS WAS MISSING AT RUNTIME)
app.use('/admin', require('./routes/admin.cjs'));

// Existing API routes
app.use('/api', require('./routes/index.cjs'));

/* ================================
   FALLBACK
================================ */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    method: req.method,
    path: req.path,
  });
});

module.exports = app;
