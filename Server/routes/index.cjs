/**
 * Server/routes/index.cjs
 */

'use strict';

const express = require('express');
const stripeRoutes = require('./stripe.cjs');

const router = express.Router();

// quick sanity endpoint
router.get('/ping', (_req, res) => res.status(200).json({ ok: true, pong: true }));

// Stripe webhook endpoint (POST /webhooks/stripe)
router.use('/webhooks/stripe', stripeRoutes);

module.exports = router;
