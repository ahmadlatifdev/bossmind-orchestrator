const express = require('express');

let cors;
try {
  cors = require('cors');
} catch (_) {
  cors = null;
}

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (cors) app.use(cors());

// ✅ Health (stable)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    timestamp: new Date().toISOString(),
  });
});

// ✅ HARD MOUNT admin router (no abstractions)
app.use('/admin', require('./routes/admin.cjs'));

// ✅ Keep your existing API routes
app.use('/api', require('./routes/index.cjs'));

// 404 (matches what you're seeing now)
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.path}`);
});

module.exports = app;
