'use strict';

// Set before importing application modules. This file never imports DBOS/Neon.
process.env.BOSSMIND_DBOS_ENABLED = '0';
process.env.BOSSMIND_DBOS_INTEGRATION_TEST = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mountReadiness } = require('../routes/readiness.cjs');

function fixture(overrides = {}) {
  const handlers = new Map();
  const calls = { list: 0, enqueue: [], schedule: [] };
  const app = { get(route, handler) { handlers.set('GET ' + route, handler); }, post(route, handler) { handlers.set('POST ' + route, handler); } };
  const options = {
    enabled: true,
    service: { async list() { calls.list++; return { projects: [], tools: [] }; }, async enqueue(value) { calls.enqueue.push(value); return { status: 'QUEUED' }; } },
    requireReadSession: async req => req.authenticated === true,
    requireOwnerAndCsrf: async req => req.authenticated === true && req.role === 'owner' && req.csrf === true,
    ...overrides
  };
  mountReadiness(app, options);
  async function request(route, req = {}) {
    const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; this.headersSent = true; return this; }, type(value) { this.contentType = value; return this; }, send(value) { this.body = value; this.headersSent = true; return this; } };
    await handlers.get(route)({ params: { project: 'resumora' }, ...req }, response);
    return response;
  }
  return { request, calls, handlers, options };
}

test('missing existing authentication, service or CSRF hooks prevents mounting', () => {
  assert.throws(() => mountReadiness({ get() {}, post() {} }, {}), /required/);
  assert.throws(() => fixture({ requireOwnerAndCsrf: undefined }), /required/);
  assert.throws(() => fixture({ getSessionBootstrap: 'not-a-hook' }), /session hook/);
});

test('unauthenticated polling and page access are refused before service reads', async () => {
  const f = fixture();
  for (const route of ['GET /api/readiness', 'GET /admin/readiness']) {
    const result = await f.request(route);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.error.code, 'READINESS_SESSION_REQUIRED');
  }
  assert.equal(f.calls.list, 0);
  const anonymousWrite = await f.request('POST /api/readiness/:project/runs');
  assert.equal(anonymousWrite.statusCode, 401);
  assert.equal(f.calls.enqueue.length, 0);
});

test('ordinary authenticated polling only reads evidence, never enqueues work', async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) {
    const response = await f.request('GET /api/readiness', { authenticated: true });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
  assert.equal(f.calls.list, 3);
  assert.deepEqual(f.calls.enqueue, []);
});

test('disabled extension fails closed after authentication, with zero tool work', async () => {
  const f = fixture({ enabled: false });
  const response = await f.request('GET /api/readiness', { authenticated: true });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'READINESS_DISABLED');
  assert.equal(f.calls.list, 0);
  const mutation = await f.request('POST /api/readiness/:project/runs', { authenticated: true, role: 'owner', csrf: true, user: { id: 'owner-a' } });
  assert.equal(mutation.statusCode, 503);
  assert.equal(f.calls.enqueue.length, 0);
});

test('machine sessions, missing CSRF and missing authenticated identity cannot enqueue', async () => {
  const f = fixture();
  for (const request of [
    { authenticated: true, role: 'machine', csrf: true, user: { id: 'machine' } },
    { authenticated: true, role: 'owner', csrf: false, user: { id: 'owner-a' } },
    { authenticated: true, role: 'owner', csrf: true }
  ]) assert.equal((await f.request('POST /api/readiness/:project/runs', request)).statusCode, 403);
  assert.equal(f.calls.enqueue.length, 0);
});

test('owner-CSRF authorized run passes trusted session context to existing service', async () => {
  const f = fixture();
  const context = { grantId: 'existing-grant' };
  const response = await f.request('POST /api/readiness/:project/runs', { authenticated: true, role: 'owner', csrf: true, user: { uid: 'owner-a' }, readinessContext: context, body: {} });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(f.calls.enqueue, [{ projectId: 'resumora', actor: 'owner-a', context }]);
});

test('browser cannot choose a command, target, identity, grant or schedule frequency', async () => {
  const f = fixture();
  for (const body of [{ command: 'rm -rf /' }, { target: 'https://unapproved.invalid' }, { actor: 'owner' }, { grantId: 'forged' }, { interval: 1 }, ['ignored'], 'string']) {
    assert.equal((await f.request('POST /api/readiness/:project/runs', { authenticated: true, role: 'owner', csrf: true, user: { id: 'owner-a' }, body })).statusCode, 400);
  }
  const result = await f.request('POST /api/readiness/:project/runs', { authenticated: true, role: 'owner', csrf: true, user: 'owner-a', params: { project: '../../outside' } });
  assert.equal(result.statusCode, 400);
  assert.equal(f.calls.enqueue.length, 0);
});

test('schedules stay blocked without the existing approved schedule hook', async () => {
  const f = fixture();
  const result = await f.request('POST /api/readiness/:project/schedules', { authenticated: true, role: 'owner', csrf: true, user: 'owner-a' });
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error.code, 'READINESS_SCHEDULE_UNAVAILABLE');
});

test('HTML bootstrap is inert JSON, nonce bound and read-only without session bootstrap', async () => {
  const f = fixture();
  const result = await f.request('GET /admin/readiness', { authenticated: true });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /"canRun":false/);
  assert.match(result.headers['Content-Security-Policy'], /frame-ancestors 'self'/);
  const nonce = /script-src 'nonce-([^']+)'/.exec(result.headers['Content-Security-Policy'])[1];
  assert.ok(result.body.includes('nonce="' + nonce + '"'));
  assert.ok(!result.body.includes('__READINESS_NONCE__'));
  const evil = fixture({ getSessionBootstrap: async () => ({ csrfToken: '</script><script>alert(1)</script>', canRun: true }) });
  const html = (await evil.request('GET /admin/readiness', { authenticated: true })).body;
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  assert.ok(html.includes('\\u003c/script\\u003e'));
});

test('UI uses safe DOM APIs and disables controls when integration is unverified', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'ui', 'readiness.html'), 'utf8');
  assert.ok(!source.includes('innerHTML'));
  assert.match(source, /url\.origin === location\.origin/);
  assert.match(source, /!url\.username && !url\.password/);
  assert.match(source, /run\.disabled = !\(integrated && bootstrap\.canRun/);
  assert.ok(!source.includes('setInterval('));
});

test('service failures do not leak secrets or raw commands into HTTP responses', async () => {
  const f = fixture({ service: { async list() { throw new Error('Bearer credential-secret'); }, async enqueue() {} } });
  const result = await f.request('GET /api/readiness', { authenticated: true });
  assert.equal(result.statusCode, 500);
  assert.ok(!JSON.stringify(result.body).includes('credential-secret'));
});

test('evidence reader rejects anonymous access before calling the existing store', async () => {
  let reads = 0;
  const f = fixture({ service: { async list() {}, async enqueue() {}, async readEvidence() { reads++; } } });
  const response = await f.request('GET /api/readiness/evidence/:project/:execution/:check');
  assert.equal(response.statusCode, 401);
  assert.equal(reads, 0);
});

test('machine read capability retrieves JSON evidence through trusted grant context', async () => {
  let received;
  const value = { status: 'FAIL', findings: { title: '<script>never-executable</script>' } };
  const f = fixture({ service: { async list() {}, async enqueue() {}, async readEvidence(request) { received = request; return value; } } });
  const context = { grantId: 'existing-machine-read-grant' };
  const response = await f.request('GET /api/readiness/evidence/:project/:execution/:check', {
    authenticated: true, role: 'machine', user: { id: 'machine-a' }, readinessContext: context,
    params: { project: 'resumora', execution: '54da70b5-5bb2-4684-bda7-981940a03592', check: 'asvs.1.2' }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.deepEqual(response.body, value);
  assert.deepEqual(received, { projectId: 'resumora', executionId: '54da70b5-5bb2-4684-bda7-981940a03592', checkId: 'asvs.1.2', actor: 'machine-a', context });
});

test('evidence IDs reject path traversal and nonconfigured identifier shapes', async () => {
  let reads = 0;
  const f = fixture({ service: { async list() {}, async enqueue() {}, async readEvidence() { reads++; } } });
  for (const params of [
    { project: '../resumora', execution: 'execution-a', check: 'trivy' },
    { project: 'resumora', execution: '../../outside', check: 'trivy' },
    { project: 'resumora', execution: 'execution-a', check: '../trivy' },
    { project: 'resumora', execution: 'execution-a', check: 'tool..config' },
    { project: 'resumora', execution: 'execution-a', check: 'tool?target=external' }
  ]) {
    const response = await f.request('GET /api/readiness/evidence/:project/:execution/:check', { authenticated: true, user: 'reader-a', params });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(reads, 0);
});

test('evidence reads remain blocked without the existing redacted evidence hook', async () => {
  const f = fixture();
  const response = await f.request('GET /api/readiness/evidence/:project/:execution/:check', { authenticated: true, user: 'reader-a', params: { project: 'resumora', execution: 'execution-a', check: 'trivy' } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'READINESS_EVIDENCE_UNAVAILABLE');
  assert.equal(f.calls.enqueue.length, 0);
});

test('evidence service grant refusal is preserved without exposing raw report data', async () => {
  const f = fixture({ service: { async list() {}, async enqueue() {}, async readEvidence() { throw Object.assign(new Error('raw credential-secret'), { status: 403, code: 'READINESS_READ_GRANT_REQUIRED' }); } } });
  const response = await f.request('GET /api/readiness/evidence/:project/:execution/:check', { authenticated: true, user: 'reader-a', params: { project: 'resumora', execution: 'execution-a', check: 'trivy' } });
  assert.equal(response.statusCode, 403);
  assert.ok(!JSON.stringify(response.body).includes('credential-secret'));
});
