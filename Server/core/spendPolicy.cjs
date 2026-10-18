'use strict';

// Admission check only. Keep existing grants, scheduling, leases and durable
// execution around callers. This module never reads provider credentials,
// initializes an SDK, executes a process, or contacts a provider.
const fs = require('node:fs');
const path = require('node:path');
const POLICY_ID = 'BOSSMIND-OPEN-SOURCE-ONLY-1';
const MAX_AGE_MS = 30 * 86400000;
const LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'GPL-3.0-only', 'GPL-3.0-or-later', 'AGPL-3.0-only', 'AGPL-3.0-or-later']);
// These identifiers designate existing cloud transports. A local model must use
// a distinct reviewed adapter ID; relabeling a cloud client cannot authorize it.
const CLOUD_IDS = new Set(['openrouter', 'deepseek', 'kimi', 'codex-cli', 'gemini-cli', 'gemini-argon', 'cursor', 'cursor-cli', 'google', 'google-ai', 'gemini', 'gemini-4-argon', 'moonshot', 'deepseek-chat', 'codex', 'claude', 'anthropic-cli', 'openai', 'anthropic', 'grok', 'xai']);
const PROHIBITED = Object.freeze(['purchase', 'subscribe', 'paid-upgrade', 'manual-paid-renewal', 'trial-enrollment', 'top-up', 'add-payment-method', 'buy-credits', 'buy-hardware', 'buy-hosting', 'enable-paid-or-metered-api', 'provision-billable-resource', 'paid-provider-fallback', 'quota-auto-upgrade']);

function deepFreeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
function copy(value) { try { return JSON.parse(JSON.stringify(value)); } catch { return null; } }
function blocked(reason) { return Object.freeze({allowed:false,status:'BLOCKED',code:'COST_POLICY_BLOCKED',policyId:POLICY_ID,reason}); }
function reject(decision) {
  const error = new Error('Open-source-only policy blocked this action.');
  error.code = 'COST_POLICY_BLOCKED'; error.status = 403;
  error.reason = decision.reason; error.details = decision;
  throw error;
}
function validPolicy(p) {
  return p?.schemaVersion === 1 && p.policyId === POLICY_ID && p.defaultDecision === 'BLOCKED' &&
    p.newAutonomousSpendLimit === 0 && p.olderApprovalsOverridePolicy === false &&
    p.newWorkerRequirements?.verifiedOpenSourceLicense === true &&
    p.newWorkerRequirements?.commercialUseCompatible === true &&
    p.newWorkerRequirements?.modelCodeAndWeightsReviewedSeparately === true &&
    p.newWorkerRequirements?.maintainedStableVersionPinned === true &&
    p.newWorkerRequirements?.incrementalCharges === 0 &&
    p.newWorkerRequirements?.meteredDependenciesAllowed === false &&
    p.newWorkerRequirements?.unknownLicenseOrCost === 'BLOCKED' &&
    p.newWorkerRequirements?.evidenceRequired === true &&
    Array.isArray(p.prohibitedActions) && PROHIBITED.every(action => p.prohibitedActions.includes(action));
}
function evidenceReference(value) {
  if (typeof value !== 'string' || value.length > 1024) return false;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; }
}
function currentDate(value, now) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now && now - time <= MAX_AGE_MS;
}
function eligibleLicense(license, now) {
  return license?.openSource === true && license.commercialUse === true &&
    LICENSES.has(license.spdx) && evidenceReference(license.source) && currentDate(license.reviewedAt,now);
}
function pinned(value) { return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value); }
function localEndpoint(value) {
  if (typeof value !== 'string' || value.length > 512 || /[\s\\]/.test(value)) return false;
  try {
    const u = new URL(value);
    return ['http:','https:'].includes(u.protocol) && ['127.0.0.1','[::1]'].includes(u.hostname) &&
      !!u.port && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' &&
      // URL parsing normalizes shorthand/encoded IPs. Require literal spelling.
      (value === u.origin || value === u.origin + '/');
  } catch { return false; }
}

/**
 * Factory for trusted host configuration and isolated tests only. Never build a
 * catalog or policy from an HTTP request, owner grant, environment override, or
 * model response. Production exports below load fixed repository-owned files.
 */
function createSpendGuard({policy,inventory,now = () => Date.now()} = {}) {
  const p = deepFreeze(copy(policy));
  const entries = deepFreeze(copy(inventory));
  const policyValid = validPolicy(p);
  const catalogValid = Array.isArray(entries) && entries.every(entry =>
    entry && typeof entry === 'object' && /^[a-z][a-z0-9-]{1,63}$/.test(entry.id || '')) &&
    new Set(entries.map(entry => entry.id)).size === entries.length;
  const evaluateProvider = providerId => {
    if (!policyValid) return blocked('POLICY_MISSING_OR_INVALID');
    if (!catalogValid) return blocked('LOCAL_CATALOG_MISSING_OR_INVALID');
    if (typeof providerId !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(providerId)) return blocked('PROVIDER_ID_INVALID');
    if (CLOUD_IDS.has(providerId)) return blocked('CLOUD_PROVIDER_PROHIBITED');
    const entry = entries.find(item => item.id === providerId);
    if (!entry) return blocked('PROVIDER_NOT_VERIFIED_LOCAL');
    let timestamp;
    try { timestamp = now(); } catch { return blocked('VERIFICATION_TIME_INVALID'); }
    if (!Number.isFinite(timestamp)) return blocked('VERIFICATION_TIME_INVALID');
    if (entry.kind !== 'local-ai' || entry.execution?.type !== 'local' ||
      entry.execution.cloudDisabled !== true || entry.execution.redirects !== false ||
      entry.execution.existingResources !== true || !localEndpoint(entry.execution.endpoint)) return blocked('EXECUTION_NOT_VERIFIED_LOCAL');
    if (entry.billing?.incrementalCharge !== 0 || entry.billing.meteredDependencies !== false) return blocked('COST_NOT_VERIFIED_ZERO');
    if (!/^[a-z][a-z0-9._-]{0,63}$/.test(entry.software?.id || '') ||
      typeof entry.software?.version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,99}$/.test(entry.software.version) ||
      /^(latest|next|nightly|canary|main|master|auto|configured-default)$/i.test(entry.software.version) ||
      !pinned(entry.software.digest) || !pinned(entry.model?.digest) ||
      typeof entry.model?.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(entry.model.id) ||
      /(?:^|[:/._-])(cloud|latest|auto)(?:$|[:/._-])/i.test(entry.model.id)) return blocked('ARTIFACT_NOT_PINNED_LOCAL');
    if (![entry.software.license,entry.model.codeLicense,entry.model.weightsLicense].every(l => eligibleLicense(l,timestamp))) return blocked('LICENSE_NOT_VERIFIED_OPEN_SOURCE');
    const verification = entry.verification;
    const expires = typeof verification?.expiresAt === 'string' ? Date.parse(verification.expiresAt) : NaN;
    const verified = typeof verification?.verifiedAt === 'string' ? Date.parse(verification.verifiedAt) : NaN;
    if (!currentDate(verification?.verifiedAt,timestamp) || !Number.isFinite(expires) || expires <= timestamp ||
      expires > verified + MAX_AGE_MS || verification.maintenance !== 'maintained' ||
      verification.quality !== 'passed' || verification.security !== 'passed' ||
      !evidenceReference(verification.reference)) return blocked('VERIFICATION_MISSING_OR_EXPIRED');
    const binding = deepFreeze({providerId:entry.id,modelId:entry.model.id,modelDigest:entry.model.digest,
      endpoint:entry.execution.endpoint,softwareDigest:entry.software.digest,policyId:POLICY_ID});
    return Object.freeze({allowed:true,status:'ALLOWED',code:'COST_POLICY_ALLOWED',policyId:POLICY_ID,binding});
  };
  const assertInferenceAllowed = providerId => {
    const decision = evaluateProvider(providerId); if (!decision.allowed) reject(decision);
    return decision.binding;
  };
  const runInference = async (providerId,fn) => {
    const binding = assertInferenceAllowed(providerId);
    if (typeof fn !== 'function') reject(blocked('INFERENCE_CALLBACK_REQUIRED'));
    return fn(binding);
  };
  const assertActionAllowed = action => reject(blocked(policyValid ? PROHIBITED.includes(action) ? 'PAID_ACTION_PROHIBITED' : 'ACTION_NOT_VERIFIED_ZERO_COST' : 'POLICY_MISSING_OR_INVALID'));
  return Object.freeze({evaluateProvider,assertInferenceAllowed,runInference,assertActionAllowed});
}
function readJson(relative) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname,'..','..',relative),'utf8')); } catch { return null; }
}
const inventoryDocument = readJson('config/local-provider-eligibility.json');
const production = createSpendGuard({policy:readJson('config/open-source-only-policy.json'),
  inventory:inventoryDocument?.schemaVersion === 1 && inventoryDocument.policyId === POLICY_ID ? inventoryDocument.providers : null});

module.exports = Object.freeze({POLICY_ID,createSpendGuard,...production});
