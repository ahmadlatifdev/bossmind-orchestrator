/**
 * Server/routes/stripe.cjs
 * Mounted at: /webhooks/stripe
 *
 * Requires:
 * - STRIPE_WEBHOOK_SECRET (whsec_...)
 *
 * Optional:
 * - STRIPE_SECRET_KEY (only needed if you later call Stripe API)
 *
 * Behavior:
 * - Always ACK Stripe quickly (200) once signature is valid
 * - Creates normalized tax transaction record
 * - Enqueues push to Avalara with retry
 */

'use strict';

const express = require('express');
const router = express.Router();

const { storeTransaction } = require('../services/store.cjs');
const { enqueueAvalaraJob, processQueueOnce } = require('../services/retryQueue.cjs');

// Browser verification
router.get('/', (_req, res) => {
  res.status(200).json({ ok: true, route: '/webhooks/stripe', method: 'GET' });
});

router.post('/', async (req, res) => {
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
    // req.body is RAW Buffer because of express.raw() in server.cjs
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[StripeWebhook] signature verify failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  // Only build tax transactions for events we care about
  try {
    const tx = normalizeStripeEventToTaxTransaction(event);

    if (tx) {
      await storeTransaction(tx);
      await enqueueAvalaraJob(tx);

      // Fire-and-forget attempt (non-blocking). Stripe ACK should not wait on Avalara.
      processQueueOnce().catch((e) => console.warn('[Queue] processQueueOnce error:', e?.message || e));
    }

  } catch (e) {
    console.error('[StripeWebhook] handler error:', e?.stack || e);
    // Still ACK Stripe to prevent endless retries if your handler fails internally
  }

  return res.status(200).json({ received: true });
});

module.exports = router;

/* =========================
   Helpers
========================= */

function normalizeStripeEventToTaxTransaction(event) {
  const type = event.type;

  // We support: checkout.session.completed + invoice.paid + charge.succeeded (optional)
  if (
    type !== 'checkout.session.completed' &&
    type !== 'invoice.paid' &&
    type !== 'charge.succeeded'
  ) {
    return null;
  }

  const nowIso = new Date().toISOString();

  if (type === 'checkout.session.completed') {
    const s = event.data.object;

    const currency = (s.currency || '').toUpperCase();
    const total = money(s.amount_total);
    const tax = money(s.total_details?.amount_tax);
    const subtotal = total != null && tax != null ? total - tax : money(s.amount_subtotal);

    const addr = s.customer_details?.address || {};
    const email = s.customer_details?.email || null;

    return {
      id: `stripe:${type}:${s.id}`,
      source: 'stripe',
      source_event_type: type,
      source_event_id: event.id,
      created_at: nowIso,

      // Business identifiers
      order_id: s.id,
      customer_email: email,

      // Amounts (major units)
      currency,
      amount_total: total,
      amount_subtotal: subtotal,
      amount_tax: tax,

      // Location
      ship_to: {
        line1: addr.line1 || null,
        line2: addr.line2 || null,
        city: addr.city || null,
        region: addr.state || null,
        postal_code: addr.postal_code || null,
        country: addr.country || null,
      },

      // Product classification (configure defaults)
      items: [
        {
          sku: s.id,
          description: 'Stripe Checkout Session',
          quantity: 1,
          // Avalara expects amount excluding tax; use subtotal if available else (total-tax)
          amount: subtotal ?? total,
          tax_code: process.env.AVALARA_DEFAULT_TAX_CODE || 'P0000000',
        },
      ],

      // Metadata passthrough
      metadata: {
        stripe_mode: s.mode || null,
        payment_status: s.payment_status || null,
        stripe_customer: s.customer || null,
      },
    };
  }

  if (type === 'invoice.paid') {
    const inv = event.data.object;
    const currency = (inv.currency || '').toUpperCase();

    const total = money(inv.amount_paid);
    const tax = money(inv.tax) ?? money(inv.total_tax_amounts?.[0]?.amount);
    const subtotal = money(inv.subtotal);

    const custEmail = inv.customer_email || null;

    // Stripe invoice may not include a full address unless customer is configured
    const addr = inv.customer_address || inv.account_country ? {} : {};
    // NOTE: address will often be missing — Avalara can still record with what you have,
    // but accurate tax jurisdiction requires country/region/postal. Prefer Checkout sessions for physical goods.

    return {
      id: `stripe:${type}:${inv.id}`,
      source: 'stripe',
      source_event_type: type,
      source_event_id: event.id,
      created_at: nowIso,

      order_id: inv.id,
      customer_email: custEmail,

      currency,
      amount_total: total,
      amount_subtotal: subtotal,
      amount_tax: tax,

      ship_to: {
        line1: addr.line1 || null,
        line2: addr.line2 || null,
        city: addr.city || null,
        region: addr.state || null,
        postal_code: addr.postal_code || null,
        country: addr.country || inv.account_country || null,
      },

      items: [
        {
          sku: inv.id,
          description: 'Stripe Invoice',
          quantity: 1,
          amount: subtotal ?? total,
          tax_code: process.env.AVALARA_DEFAULT_TAX_CODE || 'P0000000',
        },
      ],

      metadata: {
        stripe_subscription: inv.subscription || null,
        stripe_customer: inv.customer || null,
      },
    };
  }

  if (type === 'charge.succeeded') {
    const ch = event.data.object;
    const currency = (ch.currency || '').toUpperCase();

    const total = money(ch.amount);
    // Charge object often doesn’t carry structured tax. Use this only as a fallback logging signal.
    // We'll still create a record but tax may be null.
    const tax = null;
    const subtotal = total;

    return {
      id: `stripe:${type}:${ch.id}`,
      source: 'stripe',
      source_event_type: type,
      source_event_id: event.id,
      created_at: nowIso,

      order_id: ch.id,
      customer_email: ch.billing_details?.email || null,

      currency,
      amount_total: total,
      amount_subtotal: subtotal,
      amount_tax: tax,

      ship_to: {
        line1: ch.billing_details?.address?.line1 || null,
        line2: ch.billing_details?.address?.line2 || null,
        city: ch.billing_details?.address?.city || null,
        region: ch.billing_details?.address?.state || null,
        postal_code: ch.billing_details?.address?.postal_code || null,
        country: ch.billing_details?.address?.country || null,
      },

      items: [
        {
          sku: ch.id,
          description: 'Stripe Charge',
          quantity: 1,
          amount: subtotal,
          tax_code: process.env.AVALARA_DEFAULT_TAX_CODE || 'P0000000',
        },
      ],

      metadata: {
        stripe_customer: ch.customer || null,
        payment_method: ch.payment_method_details?.type || null,
      },
    };
  }

  return null;
}

function money(amountMinorUnits) {
  if (amountMinorUnits === undefined || amountMinorUnits === null) return null;
  // Stripe uses minor units (cents) for most currencies.
  // For zero-decimal currencies this is still "minor" but equals major; this is acceptable for logging + Avalara if you keep consistent.
  return Number(amountMinorUnits) / 100;
}
