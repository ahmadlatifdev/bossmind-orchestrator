/**
 * Server/routes/index.cjs
 */

'use strict';

const express = require('express');

const router = express.Router();

// quick sanity endpoint
router.get('/ping', (_req, res) => res.status(200).json({ ok: true, pong: true }));

// Stripe webhook route
// IMPORTANT: This requires the file: Server/routes/stripe.cjs (same folder, same exact name)
const stripeRoutes = require('./stripe.cjs');
router.use('/webhooks/stripe', stripeRoutes);

module.exports = router;
