'use strict';

// Isolated callback tests. These do not authenticate or invoke a Cursor service.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ADAPTER_PATH = path.join(__dirname, '..', 'core', 'cursorAdapter.cjs');
const adapter = require(ADAPTER_PATH);
const PROVIDER = Object.freeze({ name: 'cursor-cli', model: 'fixture-model', timeoutMs: 5000 });
const MESSAGES = Object.freeze([{ role: 'user', content: 'An isolated fixture task.' }]);

function temporaryWorkspace(t) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-adapter-fixture-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  return workspace;
}

function options(workspace, extra = {}) {
  return { workspace, executionId: 'fixture-execution', step: 'step-1', ...extra };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides = {}) {
  const counts = { authorize: 0, acquire: 0, releaseCapacity: 0, writer: 0, releaseWriter: 0, run: 0 };
  const dependencies = {
    authorize: async () => { counts.authorize += 1; return true; },
    acquire: async () => {
      counts.acquire += 1;
      return async () => { counts.releaseCapacity += 1; };
    },
    claimWriter: async () => {
      counts.writer += 1;
      return async () => { counts.releaseWriter += 1; };
    },
    run: async () => {
      counts.run += 1;
      return { content: 'Fixture completed.', model: PROVIDER.model, requestCount: 1 };
    },
    ...overrides,
  };
  return { client: adapter.createTestAdapter(dependencies), counts, dependencies };
}

function isUnknown(error) {
  assert.equal(error.code, 'UNCERTAIN_EFFECT');
  assert.equal(error.classified, 'UNKNOWN_COMPLETION');
  return true;
}

function stateEntries(workspace) {
  return fs.readdirSync(path.join(workspace, '.bossmind-cursor'));
}

function committedFile(workspace) {
  const entries = stateEntries(workspace).filter(name => name.endsWith('.json') && !name.endsWith('.claim.json'));
  assert.equal(entries.length, 1, 'one committed result exists');
  return path.join(workspace, '.bossmind-cursor', entries[0]);
}

let childSpawnProbe;
function childProcessesAvailable(t) {
  childSpawnProbe ??= spawnSync(process.execPath, ['-e', 'process.exit(0)'], { encoding: 'utf8', timeout: 3000 });
  if (['EPERM', 'EACCES'].includes(childSpawnProbe.error?.code)) {
    t.skip('This execution sandbox denies child-process creation (' + childSpawnProbe.error.code + '); no crash or cross-process claim is inferred.');
    return false;
  }
  assert.equal(childSpawnProbe.error, undefined);
  assert.equal(childSpawnProbe.status, 0, childSpawnProbe.stderr);
  return true;
}

test('production remains disabled and cannot invoke an injected callback', async t => {
  const workspace = temporaryWorkspace(t);
  let calls = 0;
  assert.equal(adapter.enabled({ BOSSMIND_CURSOR_ENABLED: '1', BOSSMIND_CURSOR_HEADLESS: 'verified' }), false);
  const health = await adapter.health();
  assert.equal(health.status, 'blocked');
  assert.equal(health.inferenceVerified, false);
  await assert.rejects(adapter.complete(PROVIDER, MESSAGES, options(workspace, {
    run: async () => { calls += 1; return { content: 'Must not execute.' }; },
  })), error => error.code === 'CURSOR_HEADLESS_UNAVAILABLE');
  assert.equal(calls, 0);
});

test('the isolated factory requires every explicit capability callback', () => {
  const valid = { run() {}, authorize() {}, acquire() {}, claimWriter() {} };
  for (const key of Object.keys(valid)) {
    const dependencies = { ...valid };
    delete dependencies[key];
    assert.throws(() => adapter.createTestAdapter(dependencies), TypeError, key);
  }
});

test('missing or unsafe durable identifiers never reach capability callbacks', async t => {
  const workspace = temporaryWorkspace(t);
  const invalid = [
    { executionId: undefined }, { executionId: '' }, { executionId: '../escape' },
    { executionId: 'parent/child' }, { executionId: 'parent\\child' },
    { step: undefined }, { step: '' }, { step: '../escape' },
  ];
  for (const patch of invalid) {
    const h = harness();
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace, patch)),
      error => error.code === 'INVALID_CURSOR_SCOPE');
    assert.deepEqual(h.counts, { authorize: 0, acquire: 0, releaseCapacity: 0, writer: 0, releaseWriter: 0, run: 0 });
  }
});

test('relative, missing, or nonexistent workspaces cannot dispatch', async t => {
  const workspace = temporaryWorkspace(t);
  for (const candidate of [undefined, 'relative-workspace', path.join(workspace, 'absent')]) {
    const h = harness();
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(candidate)));
    assert.equal(h.counts.run, 0);
    assert.equal(h.counts.acquire, 0);
  }
});

test('authorization denial before capacity acquisition does not consume a slot', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness({ authorize: async () => false });
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), error => error.status === 403);
  assert.equal(h.counts.acquire, 0);
  assert.equal(h.counts.writer, 0);
  assert.equal(h.counts.run, 0);
});

test('authorization is checked again after the queued capacity wait', async t => {
  const workspace = temporaryWorkspace(t);
  let active = true;
  let authorizations = 0;
  let acquired = 0;
  let released = 0;
  let run = 0;
  let writerAcquired = 0;
  let writerReleased = 0;
  const client = adapter.createTestAdapter({
    authorize: async () => { authorizations += 1; return active; },
    acquire: async () => { acquired += 1; active = false; return async () => { released += 1; }; },
    claimWriter: async () => { writerAcquired += 1; return async () => { writerReleased += 1; }; },
    run: async () => { run += 1; return { content: 'Not permitted.' }; },
  });
  await assert.rejects(client.complete(PROVIDER, MESSAGES, options(workspace)), error => error.status === 403);
  assert.equal(authorizations, 2);
  assert.equal(acquired, 1);
  assert.equal(released, 1);
  assert.equal(writerReleased, writerAcquired);
  assert.equal(run, 0);
});

test('grant revocation while waiting for the writer prevents dispatch and releases both leases', async t => {
  const workspace = temporaryWorkspace(t);
  let active = true;
  let authorizations = 0;
  let capacityReleased = 0;
  let writerReleased = 0;
  let calls = 0;
  const client = adapter.createTestAdapter({
    authorize: async () => { authorizations += 1; return active; },
    acquire: async () => async () => { capacityReleased += 1; },
    claimWriter: async () => { active = false; return async () => { writerReleased += 1; }; },
    run: async () => { calls += 1; return { content: 'Must not execute after revocation.' }; },
  });
  await assert.rejects(client.complete(PROVIDER, MESSAGES, options(workspace)), error => error.status === 403);
  assert.ok(authorizations >= 3, 'authorization is rechecked after the writer wait');
  assert.equal(calls, 0);
  assert.equal(capacityReleased, 1);
  assert.equal(writerReleased, 1);
});

test('numeric durable step zero is explicit and shares its identity with string zero', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  await h.client.complete(PROVIDER, MESSAGES, options(workspace, { step: 0 }));
  const reused = await h.client.complete(PROVIDER, MESSAGES, options(workspace, { step: '0' }));
  assert.equal(reused.reconciled, true);
  assert.equal(h.counts.run, 1);
});

test('success is marked test-only, persists, reuses its result, and releases leases', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  const first = await h.client.complete(PROVIDER, MESSAGES, options(workspace));
  assert.equal(first.testOnly, true);
  assert.equal(first.provenance, 'test');
  assert.equal(first.choices[0].message.content, 'Fixture completed.');
  assert.equal(h.counts.run, 1);
  assert.equal(h.counts.releaseCapacity, h.counts.acquire);
  assert.equal(h.counts.releaseWriter, h.counts.writer);
  committedFile(workspace);
  const second = await h.client.complete(PROVIDER, MESSAGES, options(workspace));
  assert.equal(second.reconciled, true);
  assert.equal(second.requestCount, 0);
  assert.equal(second.testOnly, true);
  assert.equal(second.provenance, 'test');
  assert.equal(h.counts.run, 1);
  assert.equal(h.counts.releaseCapacity, h.counts.acquire);
  assert.equal(h.counts.releaseWriter, h.counts.writer);
});

test('identical text in distinct executions or durable steps is independent', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  for (const ids of [
    { executionId: 'execution-a', step: 'step-1' },
    { executionId: 'execution-b', step: 'step-1' },
    { executionId: 'execution-a', step: 'step-2' },
  ]) await h.client.complete(PROVIDER, MESSAGES, options(workspace, ids));
  assert.equal(h.counts.run, 3);
});

test('ambiguous hyphen-separated identifier pairs do not collide', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  await h.client.complete(PROVIDER, MESSAGES, options(workspace, { executionId: 'a-b', step: 'c' }));
  await h.client.complete(PROVIDER, MESSAGES, options(workspace, { executionId: 'a', step: 'b-c' }));
  assert.equal(h.counts.run, 2);
});

test('copied result metadata cannot authorize completion in another workspace', async t => {
  const firstWorkspace = temporaryWorkspace(t);
  const secondWorkspace = temporaryWorkspace(t);
  const h = harness();
  await h.client.complete(PROVIDER, MESSAGES, options(firstWorkspace));
  fs.cpSync(path.join(firstWorkspace, '.bossmind-cursor'), path.join(secondWorkspace, '.bossmind-cursor'), { recursive: true });
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(secondWorkspace)), isUnknown);
  assert.equal(h.counts.run, 1);
});

test('model, settings, timeout, or input changes cannot reuse a completed durable step', async t => {
  const cases = [
    { provider: { ...PROVIDER, model: 'different-fixture' } },
    { provider: { ...PROVIDER, timeoutMs: 1234 } },
    { settings: { thinking: 'high', maxOutputTokens: 100 } },
    { messages: [{ role: 'user', content: 'A different request.' }] },
  ];
  for (const change of cases) {
    const workspace = temporaryWorkspace(t);
    const h = harness();
    await h.client.complete(PROVIDER, MESSAGES, options(workspace, { settings: { thinking: 'medium', maxOutputTokens: 100 } }));
    await assert.rejects(h.client.complete(change.provider || PROVIDER, change.messages || MESSAGES,
      options(workspace, { settings: change.settings || { thinking: 'medium', maxOutputTokens: 100 } })), isUnknown);
    assert.equal(h.counts.run, 1);
  }
});

test('caller mutations during the capacity wait cannot change the dispatched request or its reuse identity', { timeout: 10000 }, async t => {
  const workspace = temporaryWorkspace(t);
  const entered = deferred();
  const allowAcquisition = deferred();
  const mutableProvider = { ...PROVIDER, settings: { temperature: 0.2 } };
  const mutableMessages = [{ role: 'user', content: 'Original stable request.' }];
  const mutableSettings = { thinking: 'medium', tools: [{ name: 'fixture-tool', allowed: true }] };
  const original = JSON.parse(JSON.stringify({ provider: mutableProvider, messages: mutableMessages, settings: mutableSettings }));
  let calls = 0;
  let released = 0;
  const h = harness({
    acquire: async () => {
      entered.resolve();
      await allowAcquisition.promise;
      return async () => { released += 1; };
    },
    run: async (provider, messages, context) => {
      calls += 1;
      assert.deepEqual(provider, original.provider);
      assert.deepEqual(messages, original.messages);
      assert.deepEqual(context.settings, original.settings);
      return { content: 'The original request completed.' };
    },
  });
  const running = h.client.complete(mutableProvider, mutableMessages, options(workspace, { settings: mutableSettings }));
  await entered.promise;
  mutableProvider.model = 'changed-while-waiting';
  mutableProvider.settings.temperature = 0.9;
  mutableMessages[0].content = 'Changed while waiting.';
  mutableMessages.push({ role: 'user', content: 'An extra caller-side message.' });
  mutableSettings.thinking = 'high';
  mutableSettings.tools[0].allowed = false;
  allowAcquisition.resolve();
  await running;
  assert.equal(released, 1);
  const reused = await h.client.complete(original.provider, original.messages, options(workspace, { settings: original.settings }));
  assert.equal(reused.reconciled, true);
  assert.equal(calls, 1);
  await assert.rejects(h.client.complete(mutableProvider, mutableMessages, options(workspace, { settings: mutableSettings })), isUnknown);
  assert.equal(calls, 1);
});

test('legacy raw-name completed files and uncertainty markers block silent redispatch', async t => {
  for (const extension of ['.json', '.uncertain']) {
    const workspace = temporaryWorkspace(t);
    const dir = path.join(workspace, '.bossmind-cursor');
    fs.mkdirSync(dir);
    const legacyFile = path.join(dir, 'fixture-execution-step-1' + extension);
    const legacyBody = extension === '.uncertain' ? 'uncertain' : JSON.stringify({
      executionId: 'fixture-execution', step: 'step-1', inputHash: 'legacy-unverified-fingerprint',
      result: { choices: [{ message: { role: 'assistant', content: 'A legacy result with unknown request identity.' } }] },
    });
    fs.writeFileSync(legacyFile, legacyBody);
    const h = harness();
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    assert.equal(h.counts.acquire, 0);
    assert.equal(h.counts.writer, 0);
    assert.equal(h.counts.run, 0);
    assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacyBody, 'legacy evidence remains available for reconciliation');
  }
});

test('all post-dispatch rejection categories and empty output stay uncertain', async t => {
  const outcomes = [
    async () => { throw new Error('Fixture dispatch failed.'); },
    async () => { throw Object.assign(new Error('Fixture quota rejection.'), { status: 429 }); },
    async () => { throw Object.assign(new Error('Fixture authentication rejection.'), { status: 401 }); },
    async () => { throw Object.assign(new Error('Fixture abort.'), { name: 'AbortError' }); },
    async () => ({ content: '   ' }),
  ];
  for (const outcome of outcomes) {
    const workspace = temporaryWorkspace(t);
    let calls = 0;
    const h = harness({ run: async () => { calls += 1; return outcome(); } });
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    assert.equal(stateEntries(workspace).filter(name => name.endsWith('.claim.json')).length, 1);
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    assert.equal(calls, 1);
    assert.equal(h.counts.releaseCapacity, h.counts.acquire);
    assert.equal(h.counts.releaseWriter, h.counts.writer);
  }
});

test('quota classification redacts provider prose and accepts only structured valid reset times', () => {
  const privateFixture = 'FIXTURE_ONLY_PRIVATE_ERROR_TEXT';
  const expectedReset = Date.parse('2031-01-02T03:04:05.000Z');
  const quota = adapter.classifyFailure(Object.assign(new Error(privateFixture + ' resetAt=2040-01-01T00:00:00Z'), {
    status: 429,
    resetAt: '2031-01-02T03:04:05.000Z',
  }));
  assert.equal(quota.status, 429);
  assert.equal(quota.classified, 'QUOTA');
  assert.equal(quota.resetAt, expectedReset);
  assert.equal(quota.message.includes(privateFixture), false);
  assert.equal(quota.message.includes('2040-01-01'), false);
  for (const resetAt of ['invalid-reset', -1, Infinity, 8640000000000001, undefined]) {
    const failure = adapter.classifyFailure(Object.assign(new Error(privateFixture), { status: 429, resetAt }));
    assert.equal(failure.classified, 'QUOTA');
    assert.equal(failure.resetAt, null);
    assert.equal(failure.message.includes(privateFixture), false);
  }
  const proseOnly = adapter.classifyFailure(new Error('A fixture says quota exhausted resetAt=2031-01-02T03:04:05Z'));
  assert.notEqual(proseOnly.classified, 'QUOTA', 'unstructured prose cannot manufacture a quota hold');
});

test('a result-commit failure after dispatch blocks replay', async t => {
  const workspace = temporaryWorkspace(t);
  let calls = 0;
  const h = harness({ run: async () => {
    calls += 1;
    const claim = stateEntries(workspace).find(name => name.endsWith('.claim.json'));
    assert.ok(claim, 'the durable claim exists before the callback starts');
    // A directory at the final filename makes an atomic file commit fail.
    fs.mkdirSync(path.join(workspace, '.bossmind-cursor', claim.replace(/\.claim\.json$/, '.json')));
    return { content: 'Effects occurred, but this result cannot be committed.' };
  } });
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
  assert.equal(calls, 1);
  assert.equal(h.counts.releaseCapacity, h.counts.acquire);
  assert.equal(h.counts.releaseWriter, h.counts.writer);
});

test('corrupt completed state fails closed without a second dispatch', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  await h.client.complete(PROVIDER, MESSAGES, options(workspace));
  fs.writeFileSync(committedFile(workspace), '{ malformed fixture state');
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
  assert.equal(h.counts.run, 1);
});

test('same-key concurrent callers dispatch once', { timeout: 10000 }, async t => {
  const workspace = temporaryWorkspace(t);
  const entered = deferred();
  const finish = deferred();
  let calls = 0;
  const h = harness({ run: async () => { calls += 1; entered.resolve(); await finish.promise; return { content: 'One writer.' }; } });
  const first = h.client.complete(PROVIDER, MESSAGES, options(workspace));
  await entered.promise;
  try {
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    assert.equal(calls, 1);
  } finally {
    finish.resolve();
    await first;
  }
  assert.equal(h.counts.releaseCapacity, h.counts.acquire);
  assert.equal(h.counts.releaseWriter, h.counts.writer);
});

test('pre-aborted requests do not dispatch or leave a durable execution claim', async t => {
  const workspace = temporaryWorkspace(t);
  const h = harness();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace, { signal: controller.signal })), error => {
    assert.equal(error.status, 408);
    assert.equal(error.classified, 'CANCELLED');
    return true;
  });
  assert.equal(h.counts.run, 0);
  const stateDir = path.join(workspace, '.bossmind-cursor');
  if (fs.existsSync(stateDir)) assert.equal(stateEntries(workspace).filter(name => name.endsWith('.claim.json')).length, 0);
});

test('abort during the callback is uncertain and releases acquired capabilities', { timeout: 10000 }, async t => {
  const workspace = temporaryWorkspace(t);
  const entered = deferred();
  const controller = new AbortController();
  let calls = 0;
  const h = harness({ run: async (_provider, _messages, context) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      context.signal.addEventListener('abort', () => reject(Object.assign(new Error('Fixture cancellation.'), { name: 'AbortError' })), { once: true });
      entered.resolve();
    });
  } });
  const running = h.client.complete(PROVIDER, MESSAGES, options(workspace, { signal: controller.signal }));
  await entered.promise;
  controller.abort();
  await assert.rejects(running, isUnknown);
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
  assert.equal(calls, 1);
  assert.equal(h.counts.releaseCapacity, h.counts.acquire);
  assert.equal(h.counts.releaseWriter, h.counts.writer);
});

test('a cooperative runner observes the deadline and holds leases until it settles', { timeout: 5000 }, async t => {
  const workspace = temporaryWorkspace(t);
  let calls = 0;
  let observedAbort = false;
  const h = harness({ run: async (_provider, _messages, context) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      context.signal.addEventListener('abort', () => {
        observedAbort = true;
        assert.equal(h.counts.releaseCapacity, 0);
        assert.equal(h.counts.releaseWriter, 0);
        reject(Object.assign(new Error('Fixture cooperative deadline.'), { name: 'TimeoutError' }));
      }, { once: true });
    });
  } });
  const shortProvider = { ...PROVIDER, timeoutMs: 20 };
  await assert.rejects(h.client.complete(shortProvider, MESSAGES, options(workspace)), isUnknown);
  assert.equal(observedAbort, true);
  assert.equal(h.counts.releaseCapacity, 1);
  assert.equal(h.counts.releaseWriter, 1);
  await assert.rejects(h.client.complete(shortProvider, MESSAGES, options(workspace)), isUnknown);
  assert.equal(calls, 1);
});

test('symlinked state directory cannot redirect persistence outside the workspace', async t => {
  const workspace = temporaryWorkspace(t);
  const outside = temporaryWorkspace(t);
  try {
    fs.symlinkSync(outside, path.join(workspace, '.bossmind-cursor'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('Creating test directory links is not permitted.'); return; }
    throw error;
  }
  const h = harness();
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), error => error.code === 'CURSOR_PATH_UNSAFE');
  assert.equal(h.counts.run, 0);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('self-reported changes outside the workspace cannot become a completed artifact', async t => {
  for (const reported of [['../outside-fixture.txt'], Array.from({ length: 20 }, (_, i) => 'fixture-' + i + '.txt').concat('../outside-after-display-cap.txt')]) {
    const workspace = temporaryWorkspace(t);
    let calls = 0;
    const h = harness({ run: async () => {
      calls += 1;
      return { content: 'A fixture reported untrusted paths.', changedFiles: reported };
    } });
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
    assert.equal(calls, 1);
  }
});

test('telemetry failure preserves completion and cannot replay generation', async t => {
  const workspace = temporaryWorkspace(t);
  let events = 0;
  const h = harness({ ledger: { recordEvent: async () => { events += 1; throw new Error('Fixture ledger unavailable.'); } } });
  const first = await h.client.complete(PROVIDER, MESSAGES, options(workspace));
  assert.equal(first.telemetryStatus, 'pending');
  assert.equal(first.choices[0].message.content, 'Fixture completed.');
  const second = await h.client.complete(PROVIDER, MESSAGES, options(workspace));
  assert.equal(second.reconciled, true);
  assert.equal(h.counts.run, 1);
  assert.ok(events >= 1);
});

test('a worker process crash during dispatch leaves a durable replay barrier', async t => {
  if (!childProcessesAvailable(t)) return;
  const workspace = temporaryWorkspace(t);
  const childScript = `
    const fs = require('node:fs');
    const path = require('node:path');
    const { createTestAdapter } = require(process.argv[1]);
    const workspace = process.argv[2];
    const client = createTestAdapter({
      authorize: async () => true,
      acquire: async () => () => {},
      claimWriter: async () => () => {},
      run: async () => {
        fs.appendFileSync(path.join(workspace, 'dispatch-count.txt'), 'dispatch\\n');
        process.exit(7);
      }
    });
    client.complete({ name: 'cursor-cli', model: 'fixture-model', timeoutMs: 5000 },
      [{ role: 'user', content: 'An isolated fixture task.' }],
      { workspace, executionId: 'fixture-execution', step: 'step-1' })
      .catch(error => { console.error(error.code); process.exitCode = 91; });
  `;
  const child = spawnSync(process.execPath, ['-e', childScript, ADAPTER_PATH, workspace], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 7, child.stderr);
  assert.equal(fs.readFileSync(path.join(workspace, 'dispatch-count.txt'), 'utf8'), 'dispatch\n');
  const h = harness();
  await assert.rejects(h.client.complete(PROVIDER, MESSAGES, options(workspace)), isUnknown);
  assert.equal(h.counts.run, 0);
});

test('separate processes cannot dispatch the same durable key concurrently', { timeout: 15000 }, async t => {
  if (!childProcessesAvailable(t)) return;
  const workspace = temporaryWorkspace(t);
  const childScript = `
    const fs = require('node:fs');
    const path = require('node:path');
    const { createTestAdapter } = require(process.argv[1]);
    const workspace = process.argv[2];
    const mode = process.argv[3];
    const client = createTestAdapter({
      authorize: async () => true,
      acquire: async () => () => {},
      claimWriter: async () => () => {},
      run: async () => {
        fs.appendFileSync(path.join(workspace, 'dispatch-count.txt'), 'dispatch\\n');
        if (mode === 'hold') {
          process.stdout.write('DISPATCHED\\n');
          while (!fs.existsSync(path.join(workspace, 'release-fixture'))) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        return { content: 'One isolated process completed.' };
      }
    });
    client.complete({ name: 'cursor-cli', model: 'fixture-model', timeoutMs: 5000 },
      [{ role: 'user', content: 'An isolated fixture task.' }],
      { workspace, executionId: 'fixture-execution', step: 'step-1' })
      .then(result => process.stdout.write(JSON.stringify({ result: !!result }) + '\\n'))
      .catch(error => process.stdout.write(JSON.stringify({ code: error.code, classified: error.classified }) + '\\n'));
  `;
  const first = spawn(process.execPath, ['-e', childScript, ADAPTER_PATH, workspace, 'hold'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  first.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const exit = new Promise(resolve => first.once('close', (code, signal) => resolve({ code, signal })));
  try {
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Fixture child did not enter dispatch: ' + stderr)), 5000);
      first.stdout.on('data', chunk => {
        output += chunk.toString();
        if (output.includes('DISPATCHED\n')) { clearTimeout(timer); resolve(); }
      });
      first.once('error', error => { clearTimeout(timer); reject(error); });
      first.once('close', code => { clearTimeout(timer); reject(new Error('Fixture child exited early: ' + code + ' ' + stderr)); });
    });
    const second = spawnSync(process.execPath, ['-e', childScript, ADAPTER_PATH, workspace, 'compete'], { encoding: 'utf8', timeout: 5000 });
    assert.equal(second.error, undefined);
    assert.equal(second.status, 0, second.stderr);
    const rejection = JSON.parse(second.stdout.trim());
    assert.equal(rejection.code, 'UNCERTAIN_EFFECT');
    assert.equal(rejection.classified, 'UNKNOWN_COMPLETION');
    assert.equal(fs.readFileSync(path.join(workspace, 'dispatch-count.txt'), 'utf8'), 'dispatch\n');
    fs.writeFileSync(path.join(workspace, 'release-fixture'), 'release');
    const completed = await exit;
    assert.equal(completed.code, 0, stderr);
  } finally {
    if (first.exitCode == null && first.signalCode == null) first.kill('SIGKILL');
    await exit;
  }
});
