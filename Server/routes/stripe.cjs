/**
 * Server/routes/stripe.cjs
 * POST /webhooks/stripe
 *
 * Requires env:
 * - STRIPE_WEBHOOK_SECRET
 *
 * Optional (only if you later call Stripe API from this server):
 * - STRIPE_SECRET_KEY
 */

'use strict';

const express = require('express');

const router = express.Router();

let stripe = null;
try {
  // Only needed if you want to call Stripe API in normal routes.
  // Webhook verification uses STRIPE_WEBHOOK_SECRET + constructEvent (still needs stripe lib).
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
    apiVersion: '2024-06-20',
  });
} catch (e) {
  // If stripe package missing, you will see this clearly in logs
  stripe = null;
}

router.post('/', (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' });
  }
  if (!stripe || typeof stripe.webhooks?.constructEvent !== 'function') {
    return res.status(500).json({ ok: false, error: 'Stripe SDK not available (install stripe)' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature');

  let event;
  try {
    // req.body is RAW Buffer because of express.raw() in Server/server.cjs
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[StripeWebhook] signature verify failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  // Handle events you care about
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[StripeWebhook] checkout.session.completed', {
          id: session.id,
          mode: session.mode,
          customer: session.customer,
          payment_status: session.payment_status,
        });
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('[StripeWebhook] payment_intent.succeeded', {
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
        });
        break;
      }

      default:
        console.log('[StripeWebhook] received', event.type);
    }
  } catch (e) {
    console.error('[StripeWebhook] handler error:', e);
    // Still acknowledge to Stripe to avoid repeated retries if you prefer.
  }

  // Acknowledge receipt
  return res.status(200).json({ received: true });
});

module.exports = router;
