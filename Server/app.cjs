const express = require('express');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health (keep stable)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bossmind-api',
    timestamp: new Date().toISOString(),
  });
});

// ✅ Hard-mount admin router (no abstractions)
const adminRouter = require('./routes/admin.cjs');

// Mount in TWO places to guarantee reachability (no conflicts)
app.use('/admin', adminRouter);
app.use('/api/admin', adminRouter);

// Existing API routes (keep)
app.use('/api', require('./routes/index.cjs'));

// 404
app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.path}`);
});

module.exports = app;
