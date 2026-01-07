/**
 * Server/routes/index.cjs
 */

'use strict';

const express = require('express');
const stripeRoutes = require('./stripe.cjs');
const taxRoutes = require('./tax.cjs');

const router = express.Router();

router.get('/ping', (_req, res) => res.status(200).json({ ok: true, pong: true }));

// Stripe webhook endpoint
router.use('/webhooks/stripe', stripeRoutes);

// Tax / Avalara status + manual retry endpoints
router.use('/tax', taxRoutes);

module.exports = router;
