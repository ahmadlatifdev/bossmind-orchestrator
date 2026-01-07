/**
 * Server/routes/stripe.cjs
 * Mounted at: /webhooks/stripe
 */

'use strict';

const express = require('express');
const router = express.Router();

// Browser check
router.get('/', (_req, res) => {
  res.status(200).json({ ok: true, route: '/webhooks/stripe', method: 'GET' });
});

// Self-test (NO Stripe UI needed)
router.get('/self-test', (_req, res) => {
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;

  res.status(200).json({
    ok: true,
    has_STRIPE_WEBHOOK_SECRET: hasWebhookSecret,
    has_STRIPE_SECRET_KEY: hasSecretKey,
    note:
      'If has_STRIPE_WEBHOOK_SECRET is false, add it in Railway Variables. Stripe Dashboard is still needed to create the webhook endpoint and get whsec_.',
  });
});

// Real Stripe webhook endpoint (Stripe sends POST here)
router.post('/', (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' });
  }

  let Stripe;
  try {
    Stripe = require('stripe');
  } catch (_e) {
    return res.status(500).json({ ok: false, error: 'Missing stripe package. Install: npm i stripe' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
    apiVersion: '2024-06-20',
  });

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[StripeWebhook] signature verify failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  console.log('[StripeWebhook] received', event.type);
  return res.status(200).json({ received: true });
});

module.exports = router;
