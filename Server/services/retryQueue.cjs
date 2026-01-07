/**
 * Server/services/retryQueue.cjs
 * Simple in-memory retry queue for pushing transactions to Avalara.
 *
 * Guarantees:
 * - Stripe webhook ACK is never blocked by Avalara availability
 * - Retries happen with backoff
 */

'use strict';

const { pushToAvalara } = require('./avalara.cjs');

const queue = [];
const MAX_QUEUE = 1000;

function nowMs() {
  return Date.now();
}

function enqueueAvalaraJob(tx) {
  if (!tx || !tx.id) throw new Error('Invalid transaction for queue');

  // de-dup by tx.id (avoid queue flooding on retries)
  const exists = queue.some((j) => j.tx?.id === tx.id);
  if (exists) return;

  if (queue.length >= MAX_QUEUE) {
    console.warn('[Queue] full; dropping oldest job');
    queue.shift();
  }

  queue.push({
    tx,
    attempts: 0,
    nextRunAt: nowMs(),
    lastError: null,
  });
}

function getQueueStats() {
  const pending = queue.filter((j) => j.nextRunAt <= nowMs()).length;
  return {
    size: queue.length,
    runnable_now: pending,
  };
}

async function processQueueOnce() {
  // pick first runnable job
  const t = nowMs();
  const idx = queue.findIndex((j) => j.nextRunAt <= t);
  if (idx === -1) return { processed: false, reason: 'no_runnable_jobs' };

  const job = queue[idx];
  job.attempts += 1;

  try {
    const result = await pushToAvalara(job.tx);
    // success: remove job
    queue.splice(idx, 1);
    return { processed: true, ok: true, avalara: result };
  } catch (e) {
    const msg = e?.message || String(e);
    job.lastError = msg;

    // backoff: 30s, 2m, 5m, 10m, 30m max
    const backoff = backoffMs(job.attempts);
    job.nextRunAt = nowMs() + backoff;

    console.warn('[Queue] Avalara push failed:', msg, 'attempt', job.attempts, 'retry_in_ms', backoff);
    return { processed: true, ok: false, error: msg, attempts: job.attempts, retry_in_ms: backoff };
  }
}

function backoffMs(attempts) {
  if (attempts <= 1) return 30_000;
  if (attempts === 2) return 120_000;
  if (attempts === 3) return 300_000;
  if (attempts === 4) return 600_000;
  return 1_800_000;
}

module.exports = {
  enqueueAvalaraJob,
  getQueueStats,
  processQueueOnce,
};
