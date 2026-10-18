'use strict';

// Contract tests only. No DBOS SDK, cloud database, model or live scheduler is
// loaded; production activation cannot be established by these fixture hooks.
process.env.BOSSMIND_DBOS_ENABLED = '0';
process.env.BOSSMIND_DBOS_INTEGRATION_TEST = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createReadiness, assess, fingerprint, digest, redact, validateProfile,
  assertTestDatabase, REQUIRED_HOOKS
} = require('../core/readiness.cjs');

function profile(overrides = {}) {
  return {
    id: 'synthetic-app', repository: 'local/synthetic-app', commit: 'a'.repeat(40),
    environment: 'fixture', testPolicy: {syntheticOnly: true},
    scope: {plans: ['fixture'], languages: ['en'], browsers: ['chromium'], markets: ['fixture']},
    limits: {maxDurationMs: 1000, retentionDays: 1},
    checks: [{id: 'journey', tool: 'playwright', critical: true, owner: 'qa', acceptance: 'Synthetic result is saved.'}],
    ...overrides
  };
}
function context(overrides = {}) {
  return {executionId: 'fixture-execution-1', actor: 'fixture-owner',
    signal: new AbortController().signal, deadline: Date.now() + 10000, ...overrides};
}
function job(p) { return {projectId: p.id, fingerprint: fingerprint(p)}; }
function evidence(p, overrides = {}) {
  const now = Date.now();
  return {checkId: p.checks[0].id, fingerprint: fingerprint(p), commit: p.commit,
    environment: p.environment, provenance: {kind: p.environment}, status: 'PASS',
    observedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(),
    reportHash: 'f'.repeat(64), url: '/api/readiness/evidence/fixture/report.json', ...overrides};
}
function fixture(p = profile(), overrides = {}) {
  const state = {calls: [], evidence: [], events: [], lease: false, writer: false, completed: new Map()};
  const hooks = {
    async enqueueJob(payload, ctx) { state.calls.push(['enqueue', payload, ctx]); return {accepted: true}; },
    async runStep(ctx, fn) {
      state.calls.push(['step', ctx]);
      const key = `${ctx.executionId}:${ctx.step}`;
      if (state.completed.has(key)) return state.completed.get(key);
      const result = await fn(); state.completed.set(key, result); return result;
    },
    async withLease(ctx, fn) {
      state.calls.push(['lease', ctx]); assert.equal(state.lease, false);
      state.lease = true; try { return await fn(); } finally { state.lease = false; }
    },
    async withWriterClaim(ctx, fn) {
      state.calls.push(['writer', ctx]); assert.equal(state.lease, true);
      state.writer = true; try { return await fn(); } finally { state.writer = false; }
    },
    async assertGrant(request) { state.calls.push(['grant', request]); return true; },
    async recordEvent(event) { state.calls.push(['event', event.status]); state.events.push(event); },
    async storeEvidence(record) {
      assert.equal(state.lease, true, 'evidence write must remain inside the shared host lease');
      assert.equal(state.writer, true, 'evidence write must remain inside the host writer claim');
      state.calls.push(['store']); state.evidence.push(record);
      return {stored: true, reportHash: record.reportHash,
        url: '/api/readiness/evidence/fixture/report.json', remotePublication: 'pending'};
    },
    async listEvidence() { state.calls.push(['list']); return state.evidence.map(e => e.report); },
    async runner(_p, _check, _ctx) {
      assert.equal(state.lease, true); assert.equal(state.writer, true);
      state.calls.push(['runner']); return {status: 'PASS', exitCode: 0, toolVersion: 'fixture', durationMs: 1};
    },
    ...overrides
  };
  return {state, hooks, service: createReadiness({enabled: true, integrationVerified: true, profiles: [p], ...hooks})};
}
const calls = (state, name) => state.calls.filter(c => c[0] === name);
const code = expected => error => error.code === expected;

test('disabled extension refuses dispatch even with complete host hooks', async () => {
  const p = profile(); const f = fixture(p);
  const service = createReadiness({profiles: [p], ...f.hooks});
  assert.equal((await service.list()).integration.reason, 'READINESS_DISABLED');
  await assert.rejects(service.enqueue({projectId: p.id, actor: 'owner'}), code('READINESS_INTEGRATION_BLOCKED'));
  assert.equal(calls(f.state, 'enqueue').length, 0);
  assert.equal(calls(f.state, 'runner').length, 0);
});

test('each absent required host hook blocks the integration', async () => {
  for (const name of REQUIRED_HOOKS) {
    const p = profile(); const f = fixture(p); delete f.hooks[name];
    const service = createReadiness({enabled: true, integrationVerified: true, profiles: [p], ...f.hooks});
    const view = await service.list();
    assert.equal(view.integration.status, 'BLOCKED', name);
    assert.ok(view.integration.missing.includes(name));
    assert.equal(view.projects[0].verdict, 'NO-GO');
    await assert.rejects(service.enqueue({projectId: p.id, actor: 'owner'}), code('READINESS_INTEGRATION_BLOCKED'));
  }
});

test('status polling reads evidence without dispatch, tools, model calls or writes', async () => {
  const {service, state} = fixture();
  await service.list(); await service.list();
  assert.deepEqual(state.calls.map(c => c[0]), ['list', 'list']);
  assert.equal(state.events.length, 0);
  assert.equal(state.evidence.length, 0);
});

test('configured hooks without verified host integration remain read-only', async () => {
  const p = profile(); const {hooks, state} = fixture(p);
  const service = createReadiness({enabled: true, profiles: [p], ...hooks});
  const view = await service.list();
  assert.equal(view.integration.status, 'CONFIGURED');
  assert.equal(view.projects[0].verdict, 'NO-GO');
  await assert.rejects(service.enqueue({projectId: p.id, actor: 'owner'}), code('READINESS_INTEGRATION_BLOCKED'));
  await assert.rejects(service.execute(job(p), context()), code('READINESS_INTEGRATION_BLOCKED'));
  assert.equal(calls(state, 'enqueue').length, 0); assert.equal(calls(state, 'runner').length, 0);
});

test('enqueue requires an actor and an affirmative current grant', async () => {
  const p = profile(); const {service, state} = fixture(p, {assertGrant: async () => false});
  await assert.rejects(service.enqueue({projectId: p.id}), code('READINESS_AUTH_REQUIRED'));
  await assert.rejects(service.enqueue({projectId: p.id, actor: 'owner'}), code('READINESS_GRANT_DENIED'));
  assert.equal(calls(state, 'enqueue').length, 0);
});

test('queued actor is taken from authenticated argument, not overridable context', async () => {
  const p = profile(); const {service, state} = fixture(p);
  await service.enqueue({projectId: p.id, actor: 'trusted-owner', context: {actor: 'untrusted'}});
  const queued = calls(state, 'enqueue')[0];
  assert.equal(queued[2].actor, 'trusted-owner');
  assert.deepEqual(queued[1], {type: 'readiness', projectId: p.id, fingerprint: fingerprint(p)});
});

test('schedule uses the host cadence hook and denies a false grant', async () => {
  const p = profile(); let schedules = 0;
  const {service} = fixture(p, {assertGrant: async () => false,
    scheduleApprovedJob: async () => { schedules++; }});
  await assert.rejects(service.schedule({projectId: p.id, actor: 'owner'}), code('READINESS_GRANT_DENIED'));
  assert.equal(schedules, 0);
});

test('worker rejects absent execution context, cancellation and deadline before hooks', async () => {
  const p = profile(); const {service, state} = fixture(p); const aborted = new AbortController(); aborted.abort();
  await assert.rejects(service.execute(job(p)), code('READINESS_EXECUTION_CONTEXT_REQUIRED'));
  await assert.rejects(service.execute(job(p), context({signal: aborted.signal})), code('READINESS_CANCELLED'));
  await assert.rejects(service.execute(job(p), context({deadline: Date.now() - 1})), code('READINESS_TIMEOUT'));
  assert.equal(state.calls.length, 0);
});

test('unsafe execution identifiers, absent actor and counterfeit abort signals are rejected', async () => {
  const p = profile(); const {service, state} = fixture(p);
  for (const patch of [{executionId: '../outside'}, {executionId: 'a/b'},
    {executionId: '.'}, {actor: undefined}, {signal: {aborted: false}}]) {
    await assert.rejects(service.execute(job(p), context(patch)), code('READINESS_EXECUTION_CONTEXT_REQUIRED'));
  }
  assert.equal(state.calls.length, 0);
});

test('integration test rejects live database before any SDK or host work', async () => {
  const p = profile(); const {service, state} = fixture(p);
  await assert.rejects(service.execute(job(p), context({integrationTest: true, database: 'dbos_bossmind_local'})),
    code('READINESS_TEST_DATABASE_REQUIRED'));
  assert.equal(state.calls.length, 0);
  assert.equal(assertTestDatabase('dbos_bossmind_test'), true);
  assert.throws(() => assertTestDatabase('dbos_bossmind_test_typo'), code('READINESS_TEST_DATABASE_REQUIRED'));
});

test('grant revoked while waiting for shared lease prevents tool and evidence write', async () => {
  const p = profile(); let revoked = false;
  const f = fixture(p, {assertGrant: async () => !revoked});
  const originalLease = f.hooks.withLease;
  f.hooks.withLease = async (ctx, fn) => { revoked = true; return originalLease(ctx, fn); };
  const {state} = f;
  const service = createReadiness({enabled: true, integrationVerified: true, profiles: [p], ...f.hooks});
  await assert.rejects(service.execute(job(p), context()), code('READINESS_GRANT_DENIED'));
  assert.equal(calls(state, 'lease').length, 1);
  assert.equal(calls(state, 'runner').length, 0);
  assert.equal(state.evidence.length, 0);
  assert.equal(state.lease, false); assert.equal(state.writer, false);
});

test('tool, evidence write and recorded event are wrapped by the shared lease and writer', async () => {
  const p = profile(); const f = fixture(p);
  f.hooks.recordEvent = async event => {
    if (event.status === 'recorded') {
      assert.equal(f.state.lease, true); assert.equal(f.state.writer, true);
    }
    f.state.events.push(event);
  };
  const service = createReadiness({enabled: true, integrationVerified: true, profiles: [p], ...f.hooks});
  const result = await service.execute(job(p), context());
  assert.equal(result.verdict, 'GO');
  assert.equal(f.state.lease, false); assert.equal(f.state.writer, false);
  assert.deepEqual(f.state.events.map(e => e.status), ['queued', 'running', 'recorded']);
  assert.match(f.state.events[0].eventId, /^[a-f0-9]{64}$/);
  assert.equal(f.state.events[2].reportHash, digest(f.state.evidence[0].report));
  assert.equal(f.state.evidence[0].report.provenance.kind, 'fixture');
});

test('host durable-step replay reuses completed step without a second tool or evidence write', async () => {
  const p = profile(); const {service, state} = fixture(p); const ctx = context();
  const first = await service.execute(job(p), ctx);
  const again = await service.execute(job(p), ctx);
  assert.equal(first.verdict, 'GO'); assert.deepEqual(again, first);
  assert.equal(calls(state, 'runner').length, 1); assert.equal(state.evidence.length, 1);
  await service.execute(job(p), context({executionId: 'independent-execution'}));
  assert.equal(calls(state, 'runner').length, 2, 'a distinct execution remains independent');
});

test('a completed durable step is still protected after its execution grant is revoked', async () => {
  const p = profile(); let allowed = true;
  const {service, state} = fixture(p, {assertGrant: async () => allowed}); const ctx = context();
  await service.execute(job(p), ctx);
  allowed = false;
  await assert.rejects(service.execute(job(p), ctx), code('READINESS_GRANT_DENIED'));
  assert.equal(calls(state, 'runner').length, 1);
});

test('failed evidence persistence aborts the step and never records a successful status', async () => {
  const p = profile(); const disk = Object.assign(new Error('disk unavailable'), {code: 'DISK_UNAVAILABLE'});
  const {service, state} = fixture(p, {storeEvidence: async () => { throw disk; }});
  await assert.rejects(service.execute(job(p), context()), error => error === disk);
  assert.equal(state.completed.size, 0); assert.equal(state.evidence.length, 0);
  assert.deepEqual(state.events.map(e => e.status), ['queued', 'running', 'failed']);
  assert.equal(state.lease, false); assert.equal(state.writer, false);
});

test('missing or mismatched durable persistence receipts cannot become a PASS', async () => {
  const p = profile();
  for (const receipt of [undefined, {}, {stored: true, reportHash: 'wrong'}, {stored: false, reportHash: 'f'.repeat(64)}]) {
    const {service, state} = fixture(p, {storeEvidence: async () => receipt});
    await assert.rejects(service.execute(job(p), context()), code('READINESS_EVIDENCE_NOT_DURABLE'));
    assert.equal(state.completed.size, 0);
    assert.equal(state.events.some(e => e.status === 'recorded'), false);
  }
});

test('cancellation during runner releases capacity without recording completed evidence', async () => {
  const p = profile(); const controller = new AbortController();
  const {service, state} = fixture(p, {runner: async () => { controller.abort(); return {status: 'PASS'}; }});
  await assert.rejects(service.execute(job(p), context({signal: controller.signal})), code('READINESS_CANCELLED'));
  assert.equal(state.evidence.length, 0); assert.equal(state.completed.size, 0);
  assert.equal(state.events.at(-1).status, 'cancelled');
  assert.equal(state.lease, false); assert.equal(state.writer, false);
});

test('a deadline that expires during the tool prevents persistence and releases capacity', async () => {
  const p = profile(); const ctx = context();
  const {service, state} = fixture(p, {runner: async () => { ctx.deadline = Date.now() - 1; return {status: 'PASS'}; }});
  await assert.rejects(service.execute(job(p), ctx), code('READINESS_TIMEOUT'));
  assert.equal(state.evidence.length, 0); assert.equal(state.events.at(-1).status, 'timeout');
  assert.equal(state.lease, false); assert.equal(state.writer, false);
});

test('redaction happens before the existing evidence and event sinks receive data', async () => {
  const p = profile(); const key = 'sk_1234567890abcdefghijklmnop';
  const {service, state} = fixture(p, {runner: async () => ({status: 'FAIL', exitCode: 1,
    reason: `owner@example.test Bearer abcdefghijklmnop api_key=${key}`,
    stdout: key, stderr: key, trace: key, screenshot: key,
    findings: [{id: 'F1', password: key, raw: key, Match: key, detail: `contact owner@example.test`}],
    configuration: {headers: {Authorization: key}, token: key}})});
  await service.execute(job(p), context());
  const stored = JSON.stringify(state.evidence);
  assert.equal(stored.includes(key), false); assert.equal(stored.includes('owner@example.test'), false);
  assert.equal(stored.includes('abcdefghijklmnop'), false);
  assert.match(stored, /REDACTED/);
  assert.equal(Object.hasOwn(state.evidence[0].report, 'stdout'), false);
  assert.equal(Object.hasOwn(state.evidence[0].report.findings[0], 'Match'), false);
});

test('profile configuration is cloned and a queued fingerprint cannot silently change scope', async () => {
  const p = profile(); const {service, state} = fixture(p); const original = job(p);
  p.scope.languages.push('fr'); p.commit = 'b'.repeat(40);
  await service.execute(original, context());
  assert.equal(state.evidence[0].report.commit, 'a'.repeat(40));
  await assert.rejects(service.execute(job(p), context({executionId: 'new-execution'})), code('READINESS_SCOPE_CHANGED'));
});

test('evidence becomes OUTDATED for commit, environment, scope, provenance or expiry changes', () => {
  const p = profile(); const valid = evidence(p);
  assert.equal(assess(p, [valid]).checks[0].status, 'PASS');
  const variants = [
    {...valid, commit: 'b'.repeat(40)}, {...valid, environment: 'staging'},
    {...valid, fingerprint: 'f'.repeat(64)}, {...valid, provenance: {kind: 'staging'}},
    {...valid, expiresAt: new Date(Date.now() - 1).toISOString()},
    {...valid, observedAt: new Date(Date.now() + 120000).toISOString()},
    {...valid, expiresAt: new Date(Date.now() + 3 * 86400000).toISOString()}
  ];
  for (const stale of variants) assert.equal(assess(p, [stale]).checks[0].status, 'OUTDATED');
  const rescoped = structuredClone(p); rescoped.scope.markets.push('new-market');
  assert.equal(assess(rescoped, [valid]).checks[0].status, 'OUTDATED');
});

test('the most recent failing observation supersedes an earlier pass', () => {
  const p = profile(); const now = Date.now();
  const old = evidence(p, {observedAt: new Date(now - 2000).toISOString()});
  const latest = evidence(p, {status: 'FAIL', observedAt: new Date(now - 1000).toISOString()});
  const result = assess(p, [latest, old]);
  assert.equal(result.checks[0].status, 'FAIL'); assert.equal(result.verdict, 'NO-GO');
});

test('manual ASVS checks require an attributed reviewer and evidence reference for PASS', () => {
  const p = profile({checks: [{id: 'asvs-auth', tool: 'asvs', critical: true, owner: 'security',
    acceptance: 'Authorization verified manually.', manual: true, requirementId: 'v5.0.0-4.1.1', standardVersion: '5.0.0'}]});
  const result = assess(p, [evidence(p)]);
  assert.equal(result.checks[0].status, 'NOT TESTED'); assert.equal(result.verdict, 'NO-GO');
  const reviewed = assess(p, [evidence(p, {reviewedBy: 'fixture-reviewer', reviewReference: 'review/ASVS-001'})]);
  assert.equal(reviewed.checks[0].status, 'PASS'); assert.equal(reviewed.verdict, 'GO');
});

test('automated execution never converts a manual ASVS requirement into a pass', async () => {
  const p = profile({checks: [{id: 'asvs-auth', tool: 'asvs', critical: true, owner: 'security',
    acceptance: 'Manual evidence reviewed.', manual: true, requirementId: 'v5.0.0-4.1.1', standardVersion: '5.0.0'}]});
  const {service, state} = fixture(p);
  const result = await service.execute(job(p), context());
  assert.equal(result.checks[0].status, 'NOT TESTED'); assert.equal(result.verdict, 'NO-GO');
  assert.equal(calls(state, 'runner').length, 0);
});

test('N/A requires an attributed, substantive applicability rationale', () => {
  const p = profile();
  for (const extra of [{}, {justification: 'No password login exists.'}, {reviewedBy: 'reviewer'},
    {justification: '   ', reviewedBy: 'reviewer'}, {justification: 'No login.', reviewedBy: '   '}]) {
    assert.equal(assess(p, [evidence(p, {status: 'NOT APPLICABLE', ...extra})]).checks[0].status, 'BLOCKED');
  }
  const scoped = assess(p, [evidence(p, {status: 'NOT APPLICABLE',
    reviewedBy: 'reviewer', justification: 'This fixture has no password authentication surface.'})]);
  assert.equal(scoped.checks[0].status, 'NOT APPLICABLE'); assert.equal(scoped.verdict, 'GO');
});

test('every critical non-pass or unreviewed N/A prevents a technical GO', () => {
  const p = profile();
  for (const status of ['FAIL', 'BLOCKED', 'NOT TESTED', 'OUTDATED', 'NOT APPLICABLE']) {
    const result = assess(p, [evidence(p, {status})]);
    assert.equal(result.verdict, 'NO-GO', status);
    assert.deepEqual(result.criticalBlockers, ['journey']);
  }
  assert.equal(assess(p, []).verdict, 'NO-GO');
  assert.match(assess(p, []).qualification, /not an income, legal or global-readiness guarantee/);
});

test('an externally blocked profile cannot be queued or made GO by supplied pass evidence', async () => {
  const p = profile({blockedReason: 'No authorized staging target or runtime connection.'});
  const {service, state} = fixture(p);
  await assert.rejects(service.enqueue({projectId: p.id, actor: 'owner'}), code('READINESS_PROFILE_BLOCKED'));
  assert.equal(assess(p, [evidence(p)]).checks[0].status, 'BLOCKED');
  assert.equal(calls(state, 'enqueue').length, 0);
});

test('direct worker delivery cannot bypass a missing tested commit', async () => {
  const p = profile({commit: null}); const {service, state} = fixture(p);
  await assert.rejects(service.execute(job(p), context()), error =>
    ['READINESS_PROFILE_BLOCKED', 'READINESS_SCOPE_CHANGED'].includes(error.code));
  assert.equal(state.calls.length, 0);
});

test('invalid profile scope, duplicate checks and unversioned ASVS requirements are rejected', () => {
  const p = profile();
  assert.throws(() => validateProfile({...p, environment: 'production'}), code('INVALID_READINESS_PROFILE'));
  assert.throws(() => validateProfile({...p, testPolicy: {syntheticOnly: false}}), code('INVALID_READINESS_PROFILE'));
  assert.throws(() => validateProfile({...p, testPolicy: {syntheticOnly: 'false'}}), code('INVALID_READINESS_PROFILE'));
  assert.throws(() => validateProfile({...p, checks: [{...p.checks[0], critical: false}]}), code('INVALID_READINESS_PROFILE'));
  assert.throws(() => validateProfile({...p, scope: {...p.scope, markets: null}}), code('INVALID_READINESS_SCOPE'));
  assert.throws(() => validateProfile({...p, checks: [p.checks[0], p.checks[0]]}), code('INVALID_READINESS_CHECK'));
  for (const id of ['.', '..', 'check..name']) {
    assert.throws(() => validateProfile({...p, checks: [{...p.checks[0], id}]}), code('INVALID_READINESS_CHECK'));
  }
  assert.throws(() => validateProfile({...p, checks: [{...p.checks[0], tool: 'asvs'}]}), code('ASVS_REQUIRES_VERSIONED_MANUAL_REVIEW'));
  assert.throws(() => createReadiness({profiles: [p, p]}), code('DUPLICATE_READINESS_PROFILE'));
});

test('unsafe artifact links and raw scanner details are not reflected to the dashboard', () => {
  const p = profile();
  for (const url of ['https://evil.test/token', 'javascript:alert(1)', '/api/readiness/evidence/../../secret']) {
    assert.equal(assess(p, [evidence(p, {url})]).checks[0].evidence.url, undefined);
  }
  assert.deepEqual(redact({raw: 'secret', headers: {Authorization: 'secret'}, label: 'safe'}), {label: 'safe'});
});

test('evidence retrieval uses a read-only grant and validates its scoped content hash', async () => {
  const p = profile(); const executionId = 'saved-execution'; let reads = 0;
  const report = {...evidence(p), projectId: p.id, provenance: {kind: p.environment, executionId},
    reason: 'Synthetic acceptance evidence.'};
  const record = {report, reportHash: digest(report), remotePublication: 'committed'};
  const {service, state} = fixture(p, {readEvidence: async ids => {
    reads++; assert.deepEqual(ids, {projectId: p.id, executionId, checkId: 'journey'}); return record;
  }});
  const result = await service.readEvidence({projectId: p.id, executionId, checkId: 'journey', actor: 'read-only-user'});
  assert.deepEqual(result, record); assert.equal(reads, 1);
  assert.equal(calls(state, 'grant')[0][1].action, 'readiness:read');
  assert.equal(calls(state, 'runner').length, 0); assert.equal(calls(state, 'enqueue').length, 0);
});

test('evidence retrieval denies a revoked read grant before querying host storage', async () => {
  const p = profile(); let reads = 0;
  const {service} = fixture(p, {assertGrant: async () => false, readEvidence: async () => { reads++; }});
  await assert.rejects(service.readEvidence({projectId: p.id, executionId: 'saved-execution',
    checkId: 'journey', actor: 'revoked-user'}), code('READINESS_GRANT_DENIED'));
  assert.equal(reads, 0);
});

test('evidence retrieval rejects a changed digest or cross-project, execution or check record', async () => {
  const p = profile(); const executionId = 'saved-execution';
  const base = {...evidence(p), projectId: p.id, provenance: {kind: p.environment, executionId}};
  const request = {projectId: p.id, executionId, checkId: 'journey', actor: 'owner'};
  const variants = [
    {report: base, reportHash: 'f'.repeat(64)},
    ...[{...base, projectId: 'another-project'}, {...base, checkId: 'another-check'},
      {...base, provenance: {kind: p.environment, executionId: 'another-execution'}}]
      .map(report => ({report, reportHash: digest(report)}))
  ];
  for (const record of variants) {
    const {service} = fixture(p, {readEvidence: async () => record});
    await assert.rejects(service.readEvidence(request), code('READINESS_EVIDENCE_MISMATCH'));
  }
});

test('invalid evidence identifiers and missing identity never reach the artifact store', async () => {
  const p = profile(); let reads = 0;
  const {service, state} = fixture(p, {readEvidence: async () => { reads++; }});
  const request = {projectId: p.id, executionId: 'saved-execution', checkId: 'journey', actor: 'owner'};
  for (const patch of [{actor: undefined}, {executionId: '../outside'}, {executionId: 'a/b'},
    {checkId: '..'}, {checkId: 'a/secret'}]) {
    await assert.rejects(service.readEvidence({...request, ...patch}), code('READINESS_EVIDENCE_ID_INVALID'));
  }
  assert.equal(reads, 0); assert.equal(calls(state, 'grant').length, 0);
});
