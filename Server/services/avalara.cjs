/**
 * Server/services/avalara.cjs
 * Push normalized tax transactions to Avalara AvaTax (REST v2)
 *
 * Env required to actually send:
 * - AVALARA_ACCOUNT_ID
 * - AVALARA_LICENSE_KEY
 * - AVALARA_COMPANY_CODE
 *
 * Optional:
 * - AVALARA_ENV = "sandbox" | "production"  (default: sandbox)
 * - AVALARA_COMMIT = "true" | "false"       (default: false)
 * - AVALARA_DEFAULT_TAX_CODE               (default: P0000000)
 * - AVALARA_FROM_* address fields (recommended)
 */

'use strict';

function avalaraConfigSummary() {
  const env = (process.env.AVALARA_ENV || 'sandbox').toLowerCase();
  return {
    enabled:
      !!process.env.AVALARA_ACCOUNT_ID &&
      !!process.env.AVALARA_LICENSE_KEY &&
      !!process.env.AVALARA_COMPANY_CODE,
    env,
    company_code: process.env.AVALARA_COMPANY_CODE || null,
    commit: String(process.env.AVALARA_COMMIT || 'false').toLowerCase() === 'true',
    has_from_address:
      !!process.env.AVALARA_FROM_COUNTRY &&
      !!process.env.AVALARA_FROM_REGION &&
      !!process.env.AVALARA_FROM_POSTAL_CODE,
  };
}

function getBaseUrl() {
  const env = (process.env.AVALARA_ENV || 'sandbox').toLowerCase();
  // Avalara environments
  // sandbox: https://sandbox-rest.avatax.com
  // production: https://rest.avatax.com
  return env === 'production' ? 'https://rest.avatax.com' : 'https://sandbox-rest.avatax.com';
}

function authHeader() {
  const id = process.env.AVALARA_ACCOUNT_ID;
  const key = process.env.AVALARA_LICENSE_KEY;
  const token = Buffer.from(`${id}:${key}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function requireAvalaraEnabled() {
  const s = avalaraConfigSummary();
  if (!s.enabled) {
    throw new Error(
      'Avalara not enabled: set AVALARA_ACCOUNT_ID, AVALARA_LICENSE_KEY, AVALARA_COMPANY_CODE'
    );
  }
}

async function pushToAvalara(tx) {
  requireAvalaraEnabled();

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v2/transactions/createoradjust`;

  const model = buildCreateTransactionModel(tx);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(model),
  });

  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  if (!resp.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Avalara HTTP ${resp.status}: ${resp.statusText}`;
    throw new Error(message);
  }

  return {
    ok: true,
    code: data?.code || null,
    id: data?.id || null,
    totalTax: data?.totalTax || null,
    status: resp.status,
  };
}

function buildCreateTransactionModel(tx) {
  const commit = String(process.env.AVALARA_COMMIT || 'false').toLowerCase() === 'true';

  const companyCode = process.env.AVALARA_COMPANY_CODE;

  const currency = tx.currency || 'USD';
  const date = new Date(tx.created_at || Date.now()).toISOString().slice(0, 10);

  const shipTo = tx.ship_to || {};
  const shipFrom = {
    line1: process.env.AVALARA_FROM_LINE1 || null,
    line2: process.env.AVALARA_FROM_LINE2 || null,
    city: process.env.AVALARA_FROM_CITY || null,
    region: process.env.AVALARA_FROM_REGION || null,
    postalCode: process.env.AVALARA_FROM_POSTAL_CODE || null,
    country: process.env.AVALARA_FROM_COUNTRY || null,
  };

  const customerCode = safeCustomerCode(tx.customer_email || tx.order_id || 'guest');

  const lines = (tx.items || []).map((it, i) => ({
    number: String(i + 1),
    quantity: Number(it.quantity || 1),
    amount: Number(it.amount || 0),
    taxCode: it.tax_code || process.env.AVALARA_DEFAULT_TAX_CODE || 'P0000000',
    description: it.description || 'Item',
    itemCode: it.sku || tx.order_id || 'item',
  }));

  return {
    createTransactionModel: {
      code: String(tx.order_id || tx.id || `order-${Date.now()}`),
      companyCode,
      date,
      customerCode,
      type: 'SalesInvoice', // record a finalized sale
      commit, // false by default for safer rollout
      currencyCode: currency,

      addresses: {
        ShipTo: {
          line1: shipTo.line1 || null,
          line2: shipTo.line2 || null,
          city: shipTo.city || null,
          region: shipTo.region || null,
          postalCode: shipTo.postal_code || null,
          country: shipTo.country || null,
        },
        ShipFrom: shipFrom,
      },

      lines,
    },
  };
}

function safeCustomerCode(v) {
  // Avalara customerCode max length commonly 50; keep it safe.
  const s = String(v || 'guest').trim().toLowerCase();
  return s.length > 50 ? s.slice(0, 50) : s;
}

module.exports = {
  avalaraConfigSummary,
  pushToAvalara,
};
