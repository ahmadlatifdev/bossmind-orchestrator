/* ============================================================
   BossMind Durable Worker v4 (Automation-Lock + Routing + Self-Heal)
   - Claims jobs via bm_claim_next_job
   - Resolves routing via bm_resolve_job_type
   - Respects bm_is_locked (pauses when locked)
   - Marks success/failure via bm_mark_job_success / bm_mark_job_failure
   - Records failure + auto-disables features via bm_record_failure_and_self_heal
   Production safe: no schema mutations
   ============================================================ */

'use strict';

const { createClient } = require('@supabase/supabase-js');

// ----------------------
// ENV (required)
// ----------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Worker identity
const WORKER_ID =
  process.env.BOSSMIND_WORKER_ID ||
  `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

// Polling / leasing
const POLL_INTERVAL_MS = Number(process.env.BOSSMIND_POLL_INTERVAL_MS || 2000);
const LEASE_SECONDS = Number(process.env.BOSSMIND_LEASE_SECONDS || 120);

// Self-heal
const HEAL_WINDOW_MINUTES = Number(process.env.BOSSMIND_HEAL_WINDOW_MINUTES || 30);
const HEAL_THRESHOLD = Number(process.env.BOSSMIND_HEAL_THRESHOLD || 5);

// Caches
const LOCK_CACHE_TTL_MS = Number(process.env.BOSSMIND_LOCK_CACHE_TTL_MS || 2000);
const SWITCH_CACHE_TTL_MS = Number(process.env.BOSSMIND_SWITCH_CACHE_TTL_MS || 5000);

let SHUTTING_DOWN = false;
let _lockCache = { locked: false, ts: 0 };
const _switchCache = new Map();

// Supabase client (service role bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ----------------------
// Job Handlers (extend safely)
// ----------------------
const handlers = {
  async youtube_publish(payload) {
    // TODO: wire to your actual YouTube uploader
    await sleep(800);
    if (payload?.forceFail) throw new Error('Forced failure for test');
    return { ok: true, channel: 'youtube' };
  },

  async sync_sheet(payload) {
    // TODO: wire to your sheet sync module
    await sleep(500);
    return { ok: true, synced: true };
  },

  async render_video(payload) {
    // Provider selection (Runway/Luma) can be controlled by feature switches
    const runwayEnabled = await getFeatureEnabled('render_video_runway');
    const lumaEnabled = await getFeatureEnabled('render_video_luma');

    const preferred = payload?.provider; // 'runway' | 'luma'
    const tryRunwayFirst = preferred === 'runway' ? true : preferred === 'luma' ? false : true;

    if (tryRunwayFirst && runwayEnabled) {
      payload.__effective_provider = 'runway';
      return await renderWithRunway(payload);
    }

    if (lumaEnabled) {
      payload.__effective_provider = 'luma';
      return await renderWithLuma(payload);
    }

    if (runwayEnabled) {
      payload.__effective_provider = 'runway';
      return await renderWithRunway(payload);
    }

    throw new Error('Both render providers are disabled.');
  },
};

async function renderWithRunway(payload) {
  await sleep(1200);
  if (payload?.forceFailRunway) throw new Error('Forced Runway failure for test');
  return { ok: true, rendered: true, provider: 'runway' };
}

async function renderWithLuma(payload) {
  await sleep(1200);
  if (payload?.forceFailLuma) throw new Error('Forced Luma failure for test');
  return { ok: true, rendered: true, provider: 'luma' };
}

// ----------------------
// Core loop
// ----------------------
async function mainLoop() {
  log(`Booted. worker_id=${WORKER_ID}`);

  while (!SHUTTING_DOWN) {
    // 1) Lock gate: if locked, pause and do NOT claim
    const locked = await isAutomationLocked();
    if (locked) {
      log('Automation is LOCKED. Pausing worker (no job claims).');
      await sleep(Math.max(POLL_INTERVAL_MS, 2500));
      continue;
    }

    // 2) Claim next job
    const claimed = await safeClaim();
    if (!claimed) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const { job_id, job_type: original_job_type, payload, idempotency_key, lease_token } = claimed;

    let effective_job_type = original_job_type;
    let resolve_reason = 'not_resolved';

    try {
      // 3) Resolve routing / feature disable
      const resolved = await resolveJobType(original_job_type);
      effective_job_type = resolved?.effective_job_type ?? null;
      resolve_reason = resolved?.reason ?? 'unknown';

      if (!effective_job_type) {
        const disabledErr = new Error(
          `Job blocked: job_type="${original_job_type}" disabled (reason=${resolve_reason})`
        );
        await handleFailure({
          jobId: job_id,
          leaseToken: lease_token,
          originalJobType: original_job_type,
          effectiveJobType: null,
          payload,
          err: disabledErr,
          featureKey: featureKeyFor(original_job_type, payload),
        });
        continue;
      }

      log(
        `Claimed job ${job_id} type=${original_job_type} -> ${effective_job_type} (reason=${resolve_reason}) idem=${idempotency_key}`
      );

      // 4) Execute handler
      const handler = handlers[effective_job_type];
      if (!handler) throw new Error(`No handler registered for "${effective_job_type}"`);

      const result = await handler(payload);

      // 5) Mark success
      await markSuccess(job_id, lease_token, result);
      log(`Succeeded job ${job_id} type=${effective_job_type}`);
    } catch (err) {
      await handleFailure({
        jobId: job_id,
        leaseToken: lease_token,
        originalJobType: original_job_type,
        effectiveJobType: effective_job_type,
        payload,
        err,
        featureKey: featureKeyFor(effective_job_type || original_job_type, payload),
      });
    }
  }

  log('Shutdown complete.');
}

// ----------------------
// Lock state
// ----------------------
async function isAutomationLocked() {
  const now = Date.now();
  if (now - _lockCache.ts < LOCK_CACHE_TTL_MS) return _lockCache.locked;

  try {
    const { data, error } = await supabase.rpc('bm_is_locked');
    if (error) throw error;
    const locked = Boolean(data);
    _lockCache = { locked, ts: now };
    return locked;
  } catch (e) {
    // Fail-safe: if lock cannot be checked, PAUSE (safer than running)
    _lockCache = { locked: true, ts: now };
    log(`Lock check failed; pausing for safety. (${String(e?.message || e)})`);
    return true;
  }
}

// ----------------------
// Feature switch read (cached)
// ----------------------
async function getFeatureEnabled(key) {
  const now = Date.now();
  const cached = _switchCache.get(key);
  if (cached && now - cached.ts < SWITCH_CACHE_TTL_MS) return cached.value;

  const { data, error } = await supabase
    .from('bm_feature_switches')
    .select('enabled')
    .eq('key', key)
    .limit(1);

  if (error) throw error;

  const value = data && data[0] ? Boolean(data[0].enabled) : true;
  _switchCache.set(key, { value, ts: now });
  return value;
}

// ----------------------
// Queue RPCs
// ----------------------
async function safeClaim() {
  try {
    return await claimNextJob();
  } catch (e) {
    logError(e);
    return null;
  }
}

async function claimNextJob() {
  const { data, error } = await supabase.rpc('bm_claim_next_job', {
    p_worker_id: WORKER_ID,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}

async function markSuccess(jobId, leaseToken, result) {
  // Store result back on job row (optional)
  try {
    await supabase
      .from('bm_job_queue')
      .update({ result: result ?? null })
      .eq('id', jobId)
      .eq('lease_token', leaseToken);
  } catch {
    // ignore result storage
  }

  const { error } = await supabase.rpc('bm_mark_job_success', {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (error) throw error;
}

async function markFailure(jobId, leaseToken, err) {
  const { error } = await supabase.rpc('bm_mark_job_failure', {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error: truncateErr(err),
  });
  if (error) throw error;
}

// ----------------------
// Routing RPC
// ----------------------
async function resolveJobType(jobType) {
  try {
    const { data, error } = await supabase.rpc('bm_resolve_job_type', {
      p_job_type: String(jobType),
    });
    if (error) throw error;
    return Array.isArray(data) && data[0]
      ? data[0]
      : { effective_job_type: jobType, reason: 'empty' };
  } catch {
    return { effective_job_type: jobType, reason: 'rpc_missing_or_error' };
  }
}

// ----------------------
// Failure handling + self-heal
// ----------------------
async function handleFailure({
  jobId,
  leaseToken,
  originalJobType,
  effectiveJobType,
  payload,
  err,
  featureKey,
}) {
  const errorText = truncateErr(err);

  try {
    await markFailure(jobId, leaseToken, err);
  } catch (markErr) {
    logError(markErr);
  }

  // Self-heal (auto-disable)
  try {
    const safeFeatureKey = String(featureKey || effectiveJobType || originalJobType || 'unknown');
    const { data, error } = await supabase.rpc('bm_record_failure_and_self_heal', {
      p_job_type: String(effectiveJobType || originalJobType || 'unknown_job'),
      p_feature_key: safeFeatureKey,
      p_error: errorText,
      p_window_minutes: HEAL_WINDOW_MINUTES,
      p_threshold: HEAL_THRESHOLD,
    });
    if (error) throw error;

    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (row?.auto_disabled) {
      log(
        `AUTO-DISABLED feature="${row.disabled_key}" after failures=${row.failure_count} window=${row.window_minutes}m`
      );
    }
  } catch (healErr) {
    logError(healErr);
  }

  log(
    `Failed job ${jobId} type=${originalJobType}${
      effectiveJobType ? ` (effective=${effectiveJobType})` : ''
    } feature=${featureKey || 'unknown'} err=${errorText.split('\n')[0]}`
  );

  await sleep(800);
}

// ----------------------
// Feature key mapping
// ----------------------
function featureKeyFor(jobType, payload) {
  const jt = String(jobType || '').trim();
  if (!jt) return null;

  if (jt === 'youtube_publish') return 'youtube_publish';
  if (jt === 'sync_sheet') return 'sync_sheet';

  if (jt === 'render_video') {
    const provider = payload?.__effective_provider || payload?.provider;
    if (provider === 'runway') return 'render_video_runway';
    if (provider === 'luma') return 'render_video_luma';
    return 'render_video_runway';
  }

  if (jt.includes('runway')) return 'render_video_runway';
  if (jt.includes('luma')) return 'render_video_luma';

  return jt;
}

// ----------------------
// Signals + helpers
// ----------------------
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => logError(err));
process.on('unhandledRejection', (err) => logError(err));

function shutdown() {
  if (SHUTTING_DOWN) return;
  SHUTTING_DOWN = true;
  log('Shutdown signal received...');
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function truncateErr(err) {
  const msg = err && err.stack ? err.stack : err && err.message ? err.message : String(err);
  return msg.slice(0, 4000);
}

function log(msg) {
  console.log(`[BossMind][${new Date().toISOString()}] ${msg}`);
}

function logError(err) {
  console.error(
    `[BossMind][${new Date().toISOString()}][ERROR]`,
    err && err.stack ? err.stack : err
  );
}

// Start
mainLoop().catch((e) => {
  logError(e);
  process.exit(1);
});
