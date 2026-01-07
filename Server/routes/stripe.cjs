/**
 * Server/routes/stripe.cjs
 * Mounted at: /webhooks/stripe
 */

'use strict';

const express = require('express');
const router = express.Router();

// Optional GET for quick verification in browser
router.get('/', (_req, res) => {
  res.status(200).json({ ok: true, route: '/webhooks/stripe', method: 'GET' });
});

// Stripe sends POST webhooks here
router.post('/', (req, res) => {
  // If you haven't set secrets yet, return clear message (so no silent failures)
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' });
  }

  let Stripe;
  try {
    Stripe = require('stripe');
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Missing stripe package. Install: npm i stripe' });
  }

  // You can keep STRIPE_SECRET_KEY empty for now; constructEvent still works with webhook secret.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', { apiVersion: '2024-06-20' });

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    // req.body is RAW Buffer (because server.cjs uses express.raw() on /webhooks/stripe)
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[StripeWebhook] signature verify failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  console.log('[StripeWebhook] received', event.type);

  // TODO: handle events you want
  return res.status(200).json({ received: true });
});

module.exports = router;
