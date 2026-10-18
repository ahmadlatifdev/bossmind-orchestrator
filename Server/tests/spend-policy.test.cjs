'use strict';

// Security boundary tests. No credentials, network, child processes, or models.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../../config/open-source-only-policy.json');
const {
  createSpendGuard,
  assertInferenceAllowed,
  runInference,
  assertActionAllowed,
} = require('../core/spendPolicy.cjs');

const NOW = Date.parse('2026-10-18T02:00:00.000Z');
const VERIFIED = '2026-10-17T02:00:00.000Z';
const EXPIRY = '2026-11-15T02:00:00.000Z';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const clone = (value) => structuredClone(value);

function license(spdx = 'MIT') {
  return {
    spdx,
    source: 'https://example.org/fixture/LICENSE',
    reviewedAt: VERIFIED,
    commercialUse: true,
    openSource: true,
  };
}

function eligible() {
  return {
    id: 'fixture-local',
    kind: 'local-ai',
    software: { id: 'ollama', version: 'fixture-pinned', digest: DIGEST, license: license() },
    model: { id: 'fixture:code', digest: DIGEST, codeLicense: license(), weightsLicense: license() },
    execution: {
      type: 'local',
      endpoint: 'http://127.0.0.1:11434',
      cloudDisabled: true,
      redirects: false,
      existingResources: true,
    },
    billing: { incrementalCharge: 0, meteredDependencies: false },
    verification: {
      verifiedAt: VERIFIED,
      expiresAt: EXPIRY,
      maintenance: 'maintained',
      quality: 'passed',
      security: 'passed',
      reference: 'https://example.org/fixture/verified-evidence',
    },
  };
}

function guardFor(entry = eligible(), selectedPolicy = clone(policy)) {
  return createSpendGuard({ policy: selectedPolicy, inventory: [entry], now: () => NOW });
}

function denied(fn) {
  assert.throws(fn, (error) => {
    assert.equal(error.code, 'COST_POLICY_BLOCKED');
    assert.equal(typeof error.details?.reason, 'string');
    assert.match(error.details.reason, /^[A-Z][A-Z0-9_]*$/);
    return true;
  });
}

function mutationsDenied(mutations) {
  for (const mutate of mutations) {
    const entry = eligible();
    mutate(entry);
    denied(() => guardFor(entry).assertInferenceAllowed(entry.id));
  }
}

test('production defaults block unreviewed local and hosted inference before callback execution', async () => {
  let calls = 0;
  for (const id of ['kimi', 'deepseek', 'gemini', 'cursor', 'codex-cli', 'openrouter', 'ollama', 'unknown']) {
    denied(() => assertInferenceAllowed(id));
    await assert.rejects(async () => runInference(id, () => { calls++; }), { code: 'COST_POLICY_BLOCKED' });
  }
  assert.equal(calls, 0);
});

test('existing cloud transport IDs cannot be approved by relabeling them as local catalog entries', () => {
  for (const id of ['openrouter', 'deepseek', 'kimi', 'codex-cli', 'gemini-cli', 'gemini-argon',
    'cursor', 'cursor-cli', 'google', 'google-ai', 'gemini', 'gemini-4-argon', 'moonshot',
    'deepseek-chat', 'codex', 'claude', 'anthropic-cli', 'openai', 'anthropic', 'grok', 'xai']) {
    const entry = eligible();
    entry.id = id;
    denied(() => guardFor(entry).assertInferenceAllowed(id));
  }
});

test('a complete reviewed local fixture returns an immutable exact model and transport binding', () => {
  const guard = guardFor();
  const decision = guard.evaluateProvider('fixture-local');
  assert.ok(Object.isFrozen(decision));
  const binding = guard.assertInferenceAllowed('fixture-local');
  assert.deepEqual(binding, {
    providerId: 'fixture-local',
    modelId: 'fixture:code',
    modelDigest: DIGEST,
    endpoint: 'http://127.0.0.1:11434',
    softwareDigest: DIGEST,
    policyId: 'BOSSMIND-OPEN-SOURCE-ONLY-1',
  });
  assert.ok(Object.isFrozen(binding));
  assert.throws(() => { binding.endpoint = 'https://metered.example.org'; }, TypeError);
});

test('eligible callback receives only the reviewed frozen binding and executes once', async () => {
  let calls = 0;
  const result = await guardFor().runInference('fixture-local', (binding) => {
    calls++;
    assert.ok(Object.isFrozen(binding));
    assert.equal(binding.modelDigest, DIGEST);
    return 'synthetic-result';
  });
  assert.equal(result, 'synthetic-result');
  assert.equal(calls, 1);
});

test('guard clones trusted inventory and policy so later mutation cannot approve a provider', () => {
  const entry = eligible();
  entry.billing.incrementalCharge = 10;
  const selectedPolicy = clone(policy);
  const inventory = [entry];
  const guard = createSpendGuard({ policy: selectedPolicy, inventory, now: () => NOW });
  entry.billing.incrementalCharge = 0;
  selectedPolicy.newAutonomousSpendLimit = 100;
  inventory.push({ ...eligible(), id: 'new-local' });
  denied(() => guard.assertInferenceAllowed('fixture-local'));
  denied(() => guard.assertInferenceAllowed('new-local'));
});

test('missing or unknown inventory identity remains blocked', () => {
  const guard = createSpendGuard({ policy: clone(policy), inventory: [], now: () => NOW });
  for (const id of [undefined, null, '', 'missing', '__proto__', 'constructor']) {
    denied(() => guard.assertInferenceAllowed(id));
  }
});

test('missing and malformed trusted catalogs fail closed', () => {
  const catalogs = [null, undefined, {}, [null], [{ ...eligible(), id: '' }],
    [{ ...eligible(), id: '__proto__' }], [{ ...eligible(), id: 'Fixture Local' }]];
  for (const inventory of catalogs) {
    denied(() => createSpendGuard({ policy: clone(policy), inventory, now: () => NOW })
      .assertInferenceAllowed('fixture-local'));
  }
});

test('production exports fail closed when fixed policy/catalog files are missing, malformed or mismatched', () => {
  const sourcePath = path.join(__dirname, '..', 'core', 'spendPolicy.cjs');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const validCatalog = JSON.stringify({ schemaVersion: 1, policyId: policy.policyId, providers: [eligible()] });
  const cases = [
    { policyText: undefined, catalogText: validCatalog },
    { policyText: '{invalid-json', catalogText: validCatalog },
    { policyText: JSON.stringify(policy), catalogText: undefined },
    { policyText: JSON.stringify(policy), catalogText: '{invalid-json' },
    { policyText: JSON.stringify(policy), catalogText: JSON.stringify({ schemaVersion: 1, providers: [eligible()] }) },
    { policyText: JSON.stringify(policy), catalogText: JSON.stringify({ schemaVersion: 1, policyId: 'OTHER', providers: [eligible()] }) },
  ];
  for (const { policyText, catalogText } of cases) {
    let unexpectedReads = 0;
    const context = {
      module: { exports: {} },
      __dirname: path.dirname(sourcePath),
      URL,
      require(id) {
        if (id === 'node:path') return path;
        if (id !== 'node:fs') throw new Error('unexpected module dependency');
        return { readFileSync(file) {
          let value;
          if (String(file).endsWith('/config/open-source-only-policy.json')) value = policyText;
          else if (String(file).endsWith('/config/local-provider-eligibility.json')) value = catalogText;
          else { unexpectedReads++; throw new Error('unexpected credential/file read'); }
          if (value === undefined) throw Object.assign(new Error('missing fixed config'), { code: 'ENOENT' });
          return value;
        } };
      },
    };
    vm.runInNewContext(source, context, { filename: sourcePath });
    denied(() => context.module.exports.assertInferenceAllowed('fixture-local'));
    assert.equal(unexpectedReads, 0);
  }
});

test('duplicate provider identities cannot select an arbitrary reviewed binding', () => {
  const first = eligible();
  const second = eligible();
  second.billing.incrementalCharge = 10;
  denied(() => createSpendGuard({ policy: clone(policy), inventory: [first, second], now: () => NOW })
    .assertInferenceAllowed('fixture-local'));
});

test('missing, malformed, or weakened policy cannot authorize inference', () => {
  const invalidPolicies = [null, {}, { ...clone(policy), schemaVersion: 2 },
    { ...clone(policy), policyId: 'OWNER-OVERRIDE' },
    { ...clone(policy), defaultDecision: 'ALLOW' },
    { ...clone(policy), newAutonomousSpendLimit: 1 },
    { ...clone(policy), olderApprovalsOverridePolicy: true }];
  const metered = clone(policy);
  metered.newWorkerRequirements.meteredDependenciesAllowed = true;
  invalidPolicies.push(metered);
  for (const selectedPolicy of invalidPolicies) denied(() => guardFor(eligible(), selectedPolicy).assertInferenceAllowed('fixture-local'));
});

test('owner grants, login and cost override environment variables cannot authorize hosted inference', () => {
  const names = ['BOSSMIND_ALLOW_PAID', 'BOSSMIND_PAID_PROVIDER_OVERRIDE', 'BOSSMIND_OWNER_APPROVED',
    'BOSSMIND_OPEN_SOURCE_ONLY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = name === 'BOSSMIND_OPEN_SOURCE_ONLY' ? '0' : 'fixture-not-a-credential';
    denied(() => assertInferenceAllowed('codex-cli'));
    const entry = eligible();
    entry.kind = 'cloud-ai';
    entry.ownerApproved = true;
    entry.authenticated = true;
    entry.freeTier = true;
    denied(() => guardFor(entry).assertInferenceAllowed(entry.id));
  } finally {
    for (const name of names) previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name];
  }
});

test('billing must be exactly zero and metered dependencies must be explicitly absent', () => {
  mutationsDenied([
    (entry) => { delete entry.billing; },
    (entry) => { entry.billing.incrementalCharge = undefined; },
    (entry) => { entry.billing.incrementalCharge = '0'; },
    (entry) => { entry.billing.incrementalCharge = 0.01; },
    (entry) => { entry.billing.incrementalCharge = -1; },
    (entry) => { entry.billing.incrementalCharge = NaN; },
    (entry) => { entry.billing.meteredDependencies = true; },
    (entry) => { delete entry.billing.meteredDependencies; },
  ]);
});

test('both model code and weights need separately reviewed commercially compatible open-source licenses', () => {
  mutationsDenied([
    (entry) => { delete entry.model.codeLicense; },
    (entry) => { delete entry.model.weightsLicense; },
    (entry) => { entry.model.weightsLicense.commercialUse = false; },
    (entry) => { entry.model.codeLicense.openSource = false; },
    (entry) => { entry.model.weightsLicense.spdx = 'LicenseRef-NonCommercial'; },
    (entry) => { entry.model.weightsLicense.spdx = 'UNKNOWN'; },
    (entry) => { entry.model.weightsLicense.spdx = 'MIT OR LicenseRef-Proprietary'; },
    (entry) => { delete entry.software.license; },
    (entry) => { entry.software.license.spdx = 'BUSL-1.1'; },
  ]);
});

test('license evidence needs a source and fresh review with no future date', () => {
  mutationsDenied([
    (entry) => { delete entry.model.weightsLicense.source; },
    (entry) => { entry.software.license.source = 'javascript:fixture'; },
    (entry) => { entry.model.codeLicense.reviewedAt = 'not-a-date'; },
    (entry) => { entry.model.codeLicense.reviewedAt = '2026-09-01T00:00:00Z'; },
    (entry) => { entry.model.weightsLicense.reviewedAt = '2026-10-19T00:00:00Z'; },
  ]);
});

test('software and model artifacts must be pinned', () => {
  mutationsDenied([
    (entry) => { delete entry.software.version; },
    (entry) => { entry.software.digest = 'latest'; },
    (entry) => { entry.model.digest = ''; },
    (entry) => { entry.model.digest = 'sha256:short'; },
    (entry) => { entry.model.digest = `sha256:${'g'.repeat(64)}`; },
    (entry) => { entry.software.version = 'latest'; },
  ]);
});

test('verification requires maintenance, security, demonstrated quality and a source reference', () => {
  mutationsDenied([
    (entry) => { delete entry.verification; },
    (entry) => { entry.verification.maintenance = 'unknown'; },
    (entry) => { entry.verification.security = 'pending'; },
    (entry) => { entry.verification.quality = 'claimed'; },
    (entry) => { delete entry.verification.reference; },
    (entry) => { entry.verification.reference = 'file:///untrusted/evidence'; },
  ]);
});

test('expired, excessively long, future or invalid evidence cannot enable a provider', () => {
  mutationsDenied([
    (entry) => { entry.verification.expiresAt = '2026-10-18T01:59:59Z'; },
    (entry) => { entry.verification.expiresAt = '2027-01-01T00:00:00Z'; },
    (entry) => { entry.verification.verifiedAt = '2026-10-19T00:00:00Z'; },
    (entry) => { entry.verification.verifiedAt = '2026-09-01T00:00:00Z'; },
    (entry) => { entry.verification.verifiedAt = 'invalid'; },
    (entry) => { delete entry.verification.expiresAt; },
  ]);
});

test('clock changes cannot keep previously eligible evidence authorized after expiry', () => {
  let timestamp = NOW;
  const guard = createSpendGuard({ policy: clone(policy), inventory: [eligible()], now: () => timestamp });
  assert.equal(guard.assertInferenceAllowed('fixture-local').providerId, 'fixture-local');
  timestamp = Date.parse('2026-11-16T02:00:00Z');
  denied(() => guard.assertInferenceAllowed('fixture-local'));
});

test('an unavailable or invalid verification clock fails closed', () => {
  for (const timestamp of [NaN, Infinity, 'invalid', undefined]) {
    denied(() => createSpendGuard({ policy: clone(policy), inventory: [eligible()], now: () => timestamp })
      .assertInferenceAllowed('fixture-local'));
  }
});

test('execution must use existing local resources with cloud and redirects explicitly disabled', () => {
  mutationsDenied([
    (entry) => { entry.execution.type = 'self-hosted-cloud'; },
    (entry) => { entry.execution.cloudDisabled = false; },
    (entry) => { delete entry.execution.cloudDisabled; },
    (entry) => { entry.execution.redirects = true; },
    (entry) => { delete entry.execution.redirects; },
    (entry) => { entry.execution.existingResources = false; },
    (entry) => { delete entry.execution.existingResources; },
  ]);
});

test('remote, DNS, credential-bearing and ambiguous endpoints are blocked', () => {
  const endpoints = ['https://api.example.org:443', 'http://localhost:11434', 'http://127.0.0.2:11434',
    'http://127.0.0.1', 'http://user:pass@127.0.0.1:11434', 'http://127.0.0.1:11434?cloud=1',
    'http://127.0.0.1:11434#fragment', 'file:///tmp/model', 'http://2130706433:11434',
    'http://127.1:11434', 'http://0x7f000001:11434', 'http://[::ffff:127.0.0.1]:11434'];
  for (const endpoint of endpoints) {
    const entry = eligible();
    entry.execution.endpoint = endpoint;
    denied(() => guardFor(entry).assertInferenceAllowed(entry.id));
  }
});

test('literal IPv6 loopback is eligible with all other reviews intact', () => {
  const entry = eligible();
  entry.execution.endpoint = 'http://[::1]:11434';
  assert.equal(guardFor(entry).assertInferenceAllowed(entry.id).endpoint, 'http://[::1]:11434');
});

test('cloud-model labels and ambiguous mutable aliases cannot masquerade as pinned local execution', () => {
  for (const modelId of ['fixture:cloud', 'fixture-cloud', 'fixture:CLOUD', 'fixture-CLOUD',
    'fixture_cloud', 'fixture.cloud', 'fixture:cloud_q4', 'fixture:cloud.q4',
    'fixture:latest', 'fixture_latest', 'fixture.auto']) {
    const entry = eligible();
    entry.model.id = modelId;
    denied(() => guardFor(entry).assertInferenceAllowed(entry.id));
  }
});

test('blocked request details never echo arbitrary provider identifiers or secrets', () => {
  const secret = 'fixture-api-key-DO-NOT-RETURN';
  const guard = guardFor();
  try {
    guard.assertInferenceAllowed(`https://${secret}@cloud.example.org`);
    assert.fail('must reject unknown provider');
  } catch (error) {
    assert.equal(error.code, 'COST_POLICY_BLOCKED');
    assert.ok(!`${error.message} ${JSON.stringify(error.details)}`.includes(secret));
  }
});

test('prohibited and unknown procurement actions cannot be authorized by generic owner flags', () => {
  for (const action of [...policy.prohibitedActions, 'unknown-action', 'customer-checkout']) {
    denied(() => assertActionAllowed(action, { owner: true, approved: true, freeTier: true }));
    denied(() => guardFor().assertActionAllowed(action));
  }
});

test('blocked provider never runs the supplied callback even when it would expose credentials', async () => {
  let credentialsRead = 0;
  let transportCalls = 0;
  const entry = eligible();
  entry.billing.meteredDependencies = true;
  await assert.rejects(async () => guardFor(entry).runInference(entry.id, () => {
    credentialsRead++;
    transportCalls++;
    throw new Error('credential-or-transport-sentinel');
  }), { code: 'COST_POLICY_BLOCKED' });
  assert.equal(credentialsRead, 0);
  assert.equal(transportCalls, 0);
});

test('an eligible callback failure is propagated without retry or fallback', async () => {
  let calls = 0;
  const failure = new Error('synthetic local failure');
  await assert.rejects(async () => guardFor().runInference('fixture-local', () => {
    calls++;
    throw failure;
  }), (error) => error === failure);
  assert.equal(calls, 1);
});
