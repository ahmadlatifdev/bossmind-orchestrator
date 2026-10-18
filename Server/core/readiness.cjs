'use strict';

// Extension only: persistence, durable execution, authorization and leases belong
// to the host orchestrator. This module never initializes a database or provider.
const crypto = require('node:crypto');
const STATUSES = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT TESTED', 'OUTDATED', 'NOT APPLICABLE']);
const REQUIRED_HOOKS = Object.freeze(['enqueueJob', 'runStep', 'withLease', 'withWriterClaim', 'assertGrant', 'recordEvent', 'storeEvidence', 'listEvidence', 'runner']);
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
};
const digest = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fingerprint = profile => digest(profile);
function fail(code) {
  const error = new Error(code); error.code = code;
  error.status = /GRANT_DENIED/.test(code) ? 403 : /AUTH_REQUIRED/.test(code) ? 401 : /PROJECT_NOT_FOUND/.test(code) ? 404 : /CANCELLED|TIMEOUT/.test(code) ? 408 : /SCOPE_CHANGED|EVIDENCE_MISMATCH/.test(code) ? 409 : /BLOCKED|NOT_DURABLE/.test(code) ? 503 : /INVALID|REQUIRED|UNKNOWN|DUPLICATE/.test(code) ? 400 : 500;
  throw error;
}
function redact(value) {
  if (typeof value === 'string') return value
    .replace(/\b(?:Bearer\s+\S+|(?:sk|ghp|gho|github_pat|AIza)[-_A-Za-z0-9]{12,})/gi, '[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/((?:token|secret|password|api[_-]?key|cookie|authorization)\s*[=:]\s*)\S+/gi, '$1[REDACTED]')
    .slice(0, 4000);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !/^(stdout|stderr|raw|trace|screenshot|storageState|headers|cookies|Match|Code)$/i.test(k)).map(([k,v]) => [k, /secret|password|token|authorization|cookie/i.test(k) ? '[REDACTED]' : redact(v)]));
  return value;
}
function validateProfile(profile) {
  if (!profile || !/^[a-z][a-z0-9-]{1,63}$/.test(profile.id) || !['staging', 'fixture'].includes(profile.environment)) fail('INVALID_READINESS_PROFILE');
  if (!profile.repository || !Array.isArray(profile.checks) || !profile.checks.length || !profile.checks.some(c => c.critical === true) || profile.testPolicy?.syntheticOnly !== true) fail('INVALID_READINESS_PROFILE');
  if (!['plans','languages','browsers','markets'].every(k => Array.isArray(profile.scope?.[k]))) fail('INVALID_READINESS_SCOPE');
  if (!Number.isInteger(profile.limits?.maxDurationMs) || profile.limits.maxDurationMs < 1 || profile.limits.maxDurationMs > 300000 || !Number.isInteger(profile.limits.retentionDays) || profile.limits.retentionDays < 1 || profile.limits.retentionDays > 90) fail('INVALID_READINESS_LIMITS');
  const seen = new Set();
  for (const check of profile.checks) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(check.id) || check.id.includes('..') || seen.has(check.id) || !check.owner || !check.acceptance || typeof check.critical !== 'boolean') fail('INVALID_READINESS_CHECK');
    seen.add(check.id);
    if (!['playwright','trivy','asvs','zap','k6'].includes(check.tool)) fail('UNKNOWN_READINESS_TOOL');
    if (check.tool === 'asvs' && (!check.manual || !check.requirementId || !check.standardVersion)) fail('ASVS_REQUIRES_VERSIONED_MANUAL_REVIEW');
  }
  return profile;
}
function assertTestDatabase(name) {
  if (name !== 'dbos_bossmind_test') fail('READINESS_TEST_DATABASE_REQUIRED');
  return true;
}
function safeEvidenceUrl(url) {
  return typeof url === 'string' && /^\/api\/readiness\/evidence\/[a-zA-Z0-9._/-]+$/.test(url) && !url.includes('..') ? url : undefined;
}
function assess(profile, evidence = [], {now = Date.now(), integrationReady = true} = {}) {
  validateProfile(profile);
  const hash = fingerprint(profile);
  const checks = profile.checks.map(check => {
    const found = evidence.filter(e => e.checkId === check.id).sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
    let status = 'NOT TESTED', reason = 'No evidence recorded for this check.';
    if (!integrationReady || profile.blockedReason || !/^[a-f0-9]{40}$/.test(profile.commit || '')) {
      status = 'BLOCKED'; reason = profile.blockedReason || 'Current runtime integration or tested commit is unavailable.';
    } else if (found) {
      const observed = Date.parse(found.observedAt), expires = Date.parse(found.expiresAt);
      if (found.fingerprint !== hash || found.environment !== profile.environment || found.commit !== profile.commit || found.provenance?.kind !== profile.environment || !Number.isFinite(observed) || observed > now + 60000 || !Number.isFinite(expires) || expires <= now || expires > observed + profile.limits.retentionDays * 86400000) {
        status = 'OUTDATED'; reason = 'Evidence does not match the current version, scope or retention window.';
      } else if (!STATUSES.includes(found.status)) {
        status = 'BLOCKED'; reason = 'Evidence has an unknown status.';
      } else if (found.status === 'NOT APPLICABLE' && (!String(found.justification || '').trim() || !String(found.reviewedBy || '').trim())) {
        status = 'BLOCKED'; reason = 'Not applicable requires a reviewer and justification.';
      } else if (check.manual && found.status === 'PASS' && (!String(found.reviewedBy || '').trim() || !String(found.reviewReference || '').trim())) {
        status = 'NOT TESTED'; reason = 'A manual requirement needs attributed review evidence.';
      } else {
        status = found.status; reason = found.reason || found.justification || '';
      }
    }
    return {...check, status, reason: redact(reason), findings: found?.fingerprint === hash ? redact(found.findings || {}) : {}, evidence: found ? {url:safeEvidenceUrl(found.url),observedAt:found.observedAt,commit:found.commit,reportHash:found.reportHash,remotePublication:found.remotePublication || 'unknown'} : undefined};
  });
  const counts = Object.fromEntries(STATUSES.map(status => [status, checks.filter(c => c.status === status).length]));
  const blockers = checks.filter(c => c.critical && !['PASS','NOT APPLICABLE'].includes(c.status));
  return {id:profile.id,repository:profile.repository,commit:profile.commit,environment:profile.environment,fingerprint:hash,verdict:blockers.length ? 'NO-GO':'GO',qualification:'Defined technical scope only; not an income, legal or global-readiness guarantee.',counts,checks,criticalBlockers:blockers.map(c=>c.id)};
}
function createReadiness({enabled = false, profiles = [], tools = [], integrationVerified = false, ...hooks} = {}) {
  // Clone trusted server configuration so callers cannot alter scope after a grant.
  const configs = new Map(profiles.map(p => { const copy = JSON.parse(JSON.stringify(validateProfile(p))); return [copy.id, copy]; }));
  if (configs.size !== profiles.length) fail('DUPLICATE_READINESS_PROFILE');
  const missing = REQUIRED_HOOKS.filter(k => typeof hooks[k] !== 'function');
  const ready = enabled === true && integrationVerified === true && !missing.length;
  const authorize = async request => { if (await hooks.assertGrant(request) !== true) fail('READINESS_GRANT_DENIED'); };
  const integration = {status:ready?'VERIFIED':enabled && !missing.length?'CONFIGURED':'BLOCKED',missing,reason:!enabled?'READINESS_DISABLED':!integrationVerified?'READINESS_INTEGRATION_UNVERIFIED':missing.length?'READINESS_HOST_HOOKS_MISSING':'READINESS_INTEGRATION_VERIFIED'};
  const get = id => { const p = configs.get(id); if (!p) fail('READINESS_PROJECT_NOT_FOUND'); return p; };
  const checkRuntime = () => { if (!ready) fail('READINESS_INTEGRATION_BLOCKED'); };
  const validContext = context => {
    if (!context || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(context.executionId || '') || context.executionId.includes('..') || !context.actor || typeof context.signal?.aborted !== 'boolean' || typeof context.signal?.addEventListener !== 'function' || !Number.isFinite(context.deadline)) fail('READINESS_EXECUTION_CONTEXT_REQUIRED');
    if (context.integrationTest) assertTestDatabase(context.database);
    if (context.signal.aborted) fail('READINESS_CANCELLED');
    if (context.deadline <= Date.now()) fail('READINESS_TIMEOUT');
  };
  const service = {
    async list() {
      const projects = [];
      for (const p of configs.values()) projects.push(assess(p, ready ? await hooks.listEvidence(p.id) : [], {integrationReady:ready}));
      return {enabled, integration, projects, tools:redact(tools)};
    },
    async enqueue({projectId,actor,context = {}}) {
      checkRuntime(); const profile = get(projectId);
      if (profile.blockedReason || !/^[a-f0-9]{40}$/.test(profile.commit || '')) fail('READINESS_PROFILE_BLOCKED');
      if (!actor) fail('READINESS_AUTH_REQUIRED');
      await authorize({actor,context,action:'readiness:run',projectId});
      return hooks.enqueueJob({type:'readiness',projectId,fingerprint:fingerprint(profile)}, {...context,actor});
    },
    async execute(job,context) {
      checkRuntime(); validContext(context);
      const profile = get(job.projectId);
      if (profile.blockedReason || !/^[a-f0-9]{40}$/.test(profile.commit || '') || job.fingerprint !== fingerprint(profile)) fail('READINESS_SCOPE_CHANGED');
      const results = [];
      for (const check of profile.checks) {
        validContext(context);
        // Revalidate even when DBOS returns a previously completed step.
        await authorize({actor:context.actor,context,action:'readiness:run',projectId:profile.id});
        const step = `readiness:${check.id}:${job.fingerprint}`;
        const result = await hooks.runStep({...context,step}, async () => {
          validContext(context);
          await authorize({actor:context.actor,context,action:'readiness:run',projectId:profile.id});
          const eventId = digest({executionId:context.executionId,step});
          const event = (status,detail={}) => hooks.recordEvent(redact({eventId:digest({eventId,status}),executionId:context.executionId,step,project:profile.id,source:'readiness',timestamp:new Date().toISOString(),status,provenance:{kind:profile.environment,commit:profile.commit,fingerprint:job.fingerprint},...detail}));
          await event('queued');
          try {
            return await hooks.withLease({...context,step,capability:'testing',projectId:profile.id}, () => hooks.withWriterClaim({...context,step,path:`readiness/${profile.id}/${context.executionId}/${check.id}`}, async () => {
              validContext(context);
              await authorize({actor:context.actor,context,action:'readiness:run',projectId:profile.id});
              await event('running');
              const raw = check.manual ? {status:'NOT TESTED',reason:'Manual review required; no automated pass is assigned.'} : await hooks.runner(profile,check,{...context,step});
              validContext(context);
              await authorize({actor:context.actor,context,action:'readiness:record',projectId:profile.id});
              const observedAt = new Date().toISOString();
              // Keep a structured allowlist. Never retain stdout, traces, cookies or scanner matches.
              const report = redact({projectId:profile.id,checkId:check.id,status:['PASS','FAIL','BLOCKED','NOT TESTED'].includes(raw?.status)?raw.status:'BLOCKED',reason:raw?.reason || '',exitCode:raw?.exitCode ?? null,durationMs:raw?.durationMs ?? null,tool:check.tool,toolVersion:raw?.toolVersion || 'unknown',dbUpdatedAt:raw?.dbUpdatedAt || null,findings:raw?.findings || [],metrics:raw?.metrics || {},configuration:raw?.configuration || {},commit:profile.commit,environment:profile.environment,fingerprint:job.fingerprint,observedAt,expiresAt:new Date(Date.parse(observedAt)+profile.limits.retentionDays*86400000).toISOString(),provenance:{kind:profile.environment,executionId:context.executionId,step}});
              const reportHash = digest(report);
              const saved = await hooks.storeEvidence({...context,step,projectId:profile.id,eventId,reportHash,report,retentionDays:profile.limits.retentionDays});
              if (saved?.stored !== true || saved.reportHash !== reportHash) fail('READINESS_EVIDENCE_NOT_DURABLE');
              await event('recorded',{exitCode:report.exitCode,reportHash,remotePublication:redact(saved?.remotePublication || 'unknown')});
              return {...report,reportHash,url:safeEvidenceUrl(saved?.url),remotePublication:redact(saved?.remotePublication || 'unknown')};
            }));
          } catch(error) {
            await event(context.signal.aborted?'cancelled':context.deadline<=Date.now()?'timeout':'failed',{code:/^[A-Z_]{1,80}$/.test(error.code || '')?error.code:'READINESS_STEP_FAILED'});
            throw error;
          }
        });
        results.push(result);
      }
      return assess(profile,results);
    }
  };
  if (typeof hooks.readEvidence === 'function') service.readEvidence = async ({projectId,executionId,checkId,actor,context={}}) => {
    checkRuntime(); get(projectId);
    if (!actor || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(executionId || '') || executionId.includes('..') || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(checkId || '') || checkId.includes('..')) fail('READINESS_EVIDENCE_ID_INVALID');
    await authorize({actor,context,action:'readiness:read',projectId});
    const record = await hooks.readEvidence({projectId,executionId,checkId});
    if (!record?.report || record.reportHash !== digest(record.report) || record.report.projectId !== projectId || record.report.checkId !== checkId || record.report.provenance?.executionId !== executionId) fail('READINESS_EVIDENCE_MISMATCH');
    return {report:redact(record.report),reportHash:record.reportHash,remotePublication:redact(record.remotePublication || 'unknown')};
  };
  if (typeof hooks.scheduleApprovedJob === 'function') service.schedule = async ({projectId,actor,context={}}) => {
    checkRuntime(); const profile=get(projectId);
    if (profile.blockedReason) fail('READINESS_PROFILE_BLOCKED');
    await authorize({actor,context,action:'readiness:schedule',projectId});
    // The existing scheduler resolves an approved cadence; no browser-supplied cron.
    return hooks.scheduleApprovedJob({type:'readiness',projectId,fingerprint:fingerprint(profile)},{...context,actor});
  };
  return Object.freeze(service);
}
module.exports = {STATUSES,REQUIRED_HOOKS,canonical,digest,fingerprint,redact,validateProfile,assertTestDatabase,assess,createReadiness};
