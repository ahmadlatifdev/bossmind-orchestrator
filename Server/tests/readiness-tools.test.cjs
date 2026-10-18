"use strict";
process.env.BOSSMIND_DBOS_ENABLED = '0';
process.env.BOSSMIND_DBOS_INTEGRATION_TEST = '0';
process.env.BOSSMIND_TEST_ISOLATION = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { planTool, runTool, sanitizedEnvironment, defaultRunProcess } = require('../core/readinessTools.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-tool-tests-'));
const executable = path.join(root, 'tool'); fs.writeFileSync(executable, '# fixture, not an executable scanner');
const suite = 'journey.spec.cjs'; const suitePath = path.join(root, suite); fs.writeFileSync(suitePath, '/* trusted synthetic fixture */');
const suiteHash = () => crypto.createHash('sha256').update(fs.readFileSync(suitePath)).digest('hex');
const cache = path.join(root, 'cache'); fs.mkdirSync(path.join(cache, 'db'), { recursive: true });
const metadata = path.join(cache, 'db', 'metadata.json');
fs.writeFileSync(path.join(cache, 'db', 'trivy.db'), 'fixture database identity; never a real scan');
const writeMetadata = time => fs.writeFileSync(metadata, JSON.stringify({ Version: 2, UpdatedAt: new Date(time).toISOString() }));
writeMetadata(Date.now());
const profile = overrides => ({ id: 'synthetic', repositoryPath: root, environment: 'fixture',
  testPolicy: { syntheticOnly: true, allowLocalFixture: true },
  allowedTargets: [{ url: 'http://127.0.0.1:18765/' }], approvedFiles: [suite], approvedFileHashes: { [suite]: suiteHash() },
  limits: { maxDurationMs: 5000, maxOutputBytes: 4096 }, ...overrides });
const installed = { playwright: { verified: true, version: 'fixture', executable, cliPath: executable, browserExecutable: executable },
  trivy: { verified: true, version: 'fixture', executable, cacheDirectory: cache, dbMetadataPath: metadata },
  zap: { verified: true, version: 'fixture', executable, cliPath: executable }, k6: { verified: true, version: 'fixture', executable } };
const check = overrides => ({ id: 'journey', tool: 'playwright', suitePath: suite, target: 'http://127.0.0.1:18765/', ...overrides });
const goodReport = JSON.stringify({ stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] });
const fakeProcess = (stdout = goodReport, extra = {}) => async () => ({ exitCode: 0, stdout, stderr: '', ...extra });
const staging = overrides => profile({ environment: 'staging', allowedTargets: [{ url: 'https://staging.example.invalid/health', authorization: { approved: true, reference: 'approval-fixture', approvedBy: 'test-owner', expiresAt: new Date(Date.now() + 60000).toISOString() } }], ...overrides });
const stagingCheck = overrides => check({ target: 'https://staging.example.invalid/health', ...overrides });
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

test('production, unknown tools, and missing synthetic data policy fail closed', () => {
  assert.equal(planTool(profile({ environment: 'production' }), check(), installed).reason, 'PRODUCTION_OR_UNKNOWN_ENVIRONMENT');
  assert.equal(planTool(profile(), check({ tool: 'curl' }), installed).reason, 'UNSUPPORTED_TOOL');
  assert.equal(planTool(profile({ testPolicy: {} }), check(), installed).reason, 'SYNTHETIC_DATA_POLICY_REQUIRED');
  assert.equal(planTool(profile(), check(), {}).reason, 'TOOL_NOT_VERIFIED');
});
test('ASVS remains a manual standard; active ZAP and fixture load scans stay disabled', () => {
  assert.equal(planTool(profile(), check({ tool: 'asvs' }), installed).reason, 'MANUAL_ASVS_REVIEW_REQUIRED');
  assert.equal(planTool(staging(), stagingCheck({ tool: 'zap', mode: 'active' }), installed).reason, 'ACTIVE_ZAP_DISABLED');
  assert.equal(planTool(profile(), check({ tool: 'k6' }), installed).reason, 'PHASE_2_STAGING_ONLY');
});
test('only explicitly pinned approved Playwright suite runs', () => {
  assert.equal(planTool(profile({ approvedFileHashes: {} }), check(), installed).reason, 'FILE_HASH_REQUIRED');
  assert.equal(planTool(profile({ approvedFileHashes: { [suite]: 'a'.repeat(64) } }), check(), installed).reason, 'FILE_HASH_CHANGED');
  assert.equal(planTool(profile(), check({ suitePath: '../escape.spec.cjs' }), installed).reason, 'UNAPPROVED_FILE');
  const plan = planTool(profile(), check(), installed);
  assert.equal(plan.status, 'READY'); assert.ok(plan.args.includes('--trace=off')); assert.equal(plan.configuration.use.video, 'off');
  assert.throws(() => { plan.configuration.use.trace = 'on'; }, TypeError);
});
test('fixture targets are loopback only and staging authorization is exact and current', () => {
  assert.equal(planTool(profile({ allowedTargets: [{ url: 'https://example.invalid/' }] }), check({ target: 'https://example.invalid/' }), installed).reason, 'FIXTURE_REQUIRES_LOOPBACK');
  assert.equal(planTool(staging({ allowedTargets: [{ url: 'https://staging.example.invalid/health' }] }), stagingCheck(), installed).reason, 'TARGET_AUTHORIZATION_REQUIRED');
  assert.equal(planTool(staging(), stagingCheck({ target: 'https://staging.example.invalid/other' }), installed).reason, 'TARGET_NOT_ALLOWED');
  assert.equal(planTool(staging(), stagingCheck({ target: 'https://user:secret@staging.example.invalid/health' }), installed).reason, 'INVALID_TARGET');
  assert.equal(planTool(staging(), stagingCheck({ target: 'https://staging.example.invalid/health?token=secret' }), installed).reason, 'INVALID_TARGET');
});
test('credential environment and cloud identity are never inherited', () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'do-not-expose';
  try {
    const env = sanitizedEnvironment({ GEMINI_API_KEY: 'also-hidden', GOOGLE_APPLICATION_CREDENTIALS: 'hidden', BOSSMIND_READINESS_TARGET: 'http://127.0.0.1/' });
    assert.equal(env.GEMINI_API_KEY, undefined); assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, undefined); assert.equal(env.HOME, undefined);
    assert.equal(env.BOSSMIND_DBOS_ENABLED, '0'); assert.equal(env.BOSSMIND_READINESS_TARGET, 'http://127.0.0.1/');
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});
test('forged or deserialized plans cannot launch a process', async () => {
  let calls = 0;
  const forged = JSON.parse(JSON.stringify(planTool(profile(), check(), installed)));
  const result = await runTool(forged, { runProcess: async () => { calls++; return {}; } });
  assert.equal(result.reason, 'UNTRUSTED_TOOL_PLAN'); assert.equal(calls, 0);
});
test('successful Playwright report emits only counts and deletes temporary artifacts', async () => {
  let temporary;
  const result = await runTool(planTool(profile(), check(), installed), { runProcess: async (command, args, options) => {
    assert.equal(command, executable); const config = args[args.indexOf('--config') + 1]; temporary = path.dirname(config);
    const configText = fs.readFileSync(config, 'utf8'); assert.match(configText, /screenshot.*off/); assert.equal(options.env.GEMINI_API_KEY, undefined);
    return { exitCode: 0, stdout: goodReport, stderr: 'secret-stdout-is-not-returned' };
  } });
  assert.equal(result.status, 'PASS'); assert.deepEqual(result.findings, { passed: 2, failed: 0, flaky: 0, skipped: 0, errors: 0 });
  assert.equal(fs.existsSync(temporary), false); assert.doesNotMatch(JSON.stringify(result), /secret-stdout-is-not-returned/);
});
test('a skipped, flaky, absent, or failed journey cannot pass', async () => {
  for (const stats of [{ expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, { expected: 1, unexpected: 0, flaky: 0, skipped: 1 }, { expected: 1, unexpected: 0, flaky: 1, skipped: 0 }, { expected: 1, unexpected: 1, flaky: 0, skipped: 0 }]) {
    const result = await runTool(planTool(profile(), check(), installed), { runProcess: fakeProcess(JSON.stringify({ stats })) }); assert.equal(result.status, 'FAIL');
  }
});
test('suite change after planning prevents any launch', async () => {
  const plan = planTool(profile(), check(), installed); const old = fs.readFileSync(suitePath); fs.writeFileSync(suitePath, 'changed'); let calls = 0;
  try { const result = await runTool(plan, { runProcess: async () => { calls++; } }); assert.equal(result.reason, 'INPUT_CHANGED'); assert.equal(calls, 0); }
  finally { fs.writeFileSync(suitePath, old); }
});
test('expired deadlines and pre-cancelled work do not launch', async () => {
  let calls = 0; const runProcess = async () => { calls++; };
  assert.equal((await runTool(planTool(profile(), check(), installed), { deadline: Date.now() - 1, runProcess })).reason, 'DEADLINE_EXPIRED');
  const controller = new AbortController(); controller.abort();
  assert.equal((await runTool(planTool(profile(), check(), installed), { signal: controller.signal, runProcess })).reason, 'CANCELLED'); assert.equal(calls, 0);
});
test('timeout, cancellation, output caps, invalid reports and process errors never pass or leak diagnostics', async () => {
  const cases = [[{ timedOut: true }, 'TIMEOUT'], [{ aborted: true }, 'CANCELLED'], [{ outputLimited: true }, 'OUTPUT_LIMIT'], [{ stdout: 'super-secret-invalid-json' }, 'INVALID_TOOL_REPORT']];
  for (const [extra, reason] of cases) {
    const result = await runTool(planTool(profile(), check(), installed), { runProcess: fakeProcess(goodReport, extra) }); assert.equal(result.reason, reason); assert.notEqual(result.status, 'PASS'); assert.doesNotMatch(JSON.stringify(result), /super-secret/);
  }
  const result = await runTool(planTool(profile(), check(), installed), { runProcess: async () => { throw new Error('private token=secret'); } });
  assert.equal(result.reason, 'TOOL_EXECUTION_FAILED'); assert.doesNotMatch(JSON.stringify(result), /private|token|secret/);
});
test('Trivy cannot run with absent, stale or unknown database metadata', () => {
  const desc = { ...installed, trivy: { ...installed.trivy, dbMetadataPath: path.join(root, 'missing.json') } };
  assert.equal(planTool(profile(), check({ tool: 'trivy' }), desc).status, 'BLOCKED');
  writeMetadata(Date.now() - 25 * 3600000);
  try { assert.equal(planTool(profile(), check({ tool: 'trivy' }), installed).reason, 'DB_STALE_OR_UNKNOWN'); }
  finally { writeMetadata(Date.now()); }
});
test('Trivy records DB timestamp and strips Match, Code, target paths and secret content', async () => {
  const plan = planTool(profile(), check({ tool: 'trivy' }), installed); assert.equal(plan.status, 'READY'); assert.ok(plan.args.includes('--offline-scan'));
  const report = { SchemaVersion: 2, Results: [{ Target: '/private/home/customer.env', Secrets: [{ RuleID: 'generic-api-key', Severity: 'HIGH', Match: 'PRIVATE_API_KEY=credential-content', Code: { Lines: [{ Content: 'credential-content' }] } }], Vulnerabilities: [{ VulnerabilityID: 'CVE-2026-1234', Severity: 'CRITICAL', PkgName: 'example', InstalledVersion: '1.0.0', FixedVersion: '2.0.0', Description: 'private description' }] }] };
  const result = await runTool(plan, { runProcess: fakeProcess(JSON.stringify(report), { exitCode: 1 }) });
  assert.equal(result.status, 'FAIL'); assert.equal(result.findings.count, 2); assert.ok(result.dbUpdatedAt);
  assert.doesNotMatch(JSON.stringify(result), /credential-content|customer\.env|private description|Match|Content/);
});
test('Trivy clean report requires actual valid report and exit zero', async () => {
  const plan = planTool(profile(), check({ tool: 'trivy' }), installed);
  assert.equal((await runTool(plan, { runProcess: fakeProcess(JSON.stringify({ SchemaVersion: 2, Results: [] })) })).status, 'PASS');
  assert.equal((await runTool(plan, { runProcess: fakeProcess(JSON.stringify({ SchemaVersion: 2, Results: [] }), { exitCode: 2 }) })).status, 'FAIL');
  assert.equal((await runTool(plan, { runProcess: fakeProcess('{}') })).reason, 'INVALID_TOOL_REPORT');
});
test('k6 needs staging approval, refuses scripts, and generates bounded GET-only traffic', async () => {
  assert.equal(planTool(staging(), stagingCheck({ tool: 'k6', mode: 'read-only' }), installed).reason, 'LOAD_TEST_APPROVAL_REQUIRED');
  const p = staging({ testPolicy: { syntheticOnly: true, allowLoadTest: true }, limits: { maxDurationMs: 30000, maxOutputBytes: 4096, maxVus: 2, maxRequestsPerSecond: 2 } });
  assert.equal(planTool(p, stagingCheck({ tool: 'k6', scriptPath: 'anything.js' }), installed).reason, 'ARBITRARY_LOAD_SCRIPT_DISABLED');
  const plan = planTool(p, stagingCheck({ tool: 'k6', mode: 'read-only' }), installed);
  assert.equal(plan.status, 'READY'); assert.match(plan.stdin, /http\.get/); assert.doesNotMatch(plan.stdin, /http\.post|http\.put|http\.del/); assert.match(plan.stdin, /redirects:0/); assert.match(plan.stdin, /maxVUs:2/); assert.match(plan.stdin, /duration:'30s'/);
  assert.equal(planTool({ ...p, limits: { ...p.limits, maxRequestsPerSecond: 3 } }, stagingCheck({ tool: 'k6', mode: 'read-only' }), installed).reason, 'INVALID_LIMIT');
  const result = await runTool(plan, { runProcess: fakeProcess(JSON.stringify({ metrics: { checks: { values: { passes: 4, fails: 0 } }, http_reqs: { values: { count: 4 } }, http_req_duration: { values: { 'p(95)': 50 } } } })) }); assert.equal(result.status, 'PASS');
});
test('passive ZAP is staging-only and has no active scan switch', () => {
  const plan = planTool(staging(), stagingCheck({ tool: 'zap', mode: 'passive-baseline' }), installed);
  assert.equal(plan.status, 'READY'); assert.ok(plan.args.includes('-m')); assert.equal(plan.args.includes('-a'), false);
});

test('approval expires before queued launch and no process starts', async () => {
  const expired = Date.now() - 1000;
  const p = staging({ allowedTargets: [{ url: 'https://staging.example.invalid/health', authorization: { approved: true, reference: 'queued-approval', approvedBy: 'owner', expiresAt: new Date(expired).toISOString() } }] });
  const plan = planTool(p, stagingCheck(), installed, { now: expired - 1000 });
  assert.equal(plan.status, 'READY'); let calls = 0;
  const result = await runTool(plan, { runProcess: async () => { calls++; } });
  assert.equal(result.reason, 'TARGET_AUTHORIZATION_EXPIRED'); assert.equal(calls, 0);
});
test('k6 cannot pass a latency failure hidden behind process exit zero', async () => {
  const p = staging({ testPolicy: { syntheticOnly: true, allowLoadTest: true }, limits: { maxDurationMs: 5000, maxOutputBytes: 4096, maxP95Ms: 250 } });
  const plan = planTool(p, stagingCheck({ tool: 'k6', mode: 'read-only' }), installed);
  const report = { metrics: { checks: { values: { passes: 2, fails: 0 } }, http_reqs: { values: { count: 2 } }, http_req_duration: { values: { 'p(95)': 500 } } } };
  const result = await runTool(plan, { runProcess: fakeProcess(JSON.stringify(report)) });
  assert.equal(result.status, 'FAIL'); assert.equal(result.findings.p95Ms, 500); assert.equal(result.findings.maxP95Ms, 250);
});
test('real process timeout awaits termination; sandbox restrictions are reported as skip', async t => {
  try {
    const result = await defaultRunProcess(process.execPath, ['-e', 'setInterval(()=>{},10000)'], { cwd: root, env: sanitizedEnvironment(), timeoutMs: 100, maxOutputBytes: 1024 });
    assert.equal(result.timedOut, true); assert.equal(result.durationMs < 3000, true);
  } catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) t.skip('Execution environment disallows child process launch; termination not verified here'); else throw error; }
});

test('real cancellation and output bounds await process termination', async t => {
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 70);
    const cancelled = await defaultRunProcess(process.execPath, ['-e', 'setInterval(()=>{},10000)'], { cwd: root, env: sanitizedEnvironment(), signal: controller.signal, timeoutMs: 3000, maxOutputBytes: 1024 });
    clearTimeout(timer); assert.equal(cancelled.aborted, true); assert.equal(cancelled.durationMs < 2000, true);
    const limited = await defaultRunProcess(process.execPath, ['-e', 'require("node:fs").writeSync(1,"x".repeat(65536));setInterval(()=>{},10000)'], { cwd: root, env: sanitizedEnvironment(), timeoutMs: 3000, maxOutputBytes: 1024 });
    assert.equal(limited.outputLimited, true); assert.ok(Buffer.byteLength(limited.stdout) <= 1024);
  } catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) t.skip('Execution environment disallows child process launch; process bounds not verified here'); else throw error; }
});

test('Trivy scans every severity, disables telemetry/version calls, and blocks low-severity secrets', async () => {
  const plan = planTool(profile(), check({ tool: 'trivy' }), installed);
  assert.ok(plan.args.includes('--severity=UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL'));
  assert.ok(plan.args.includes('--disable-telemetry')); assert.ok(plan.args.includes('--skip-version-check'));
  assert.ok(plan.args.includes('--exit-code=0'));
  const report = { SchemaVersion: 2, Results: [{ Secrets: [{ RuleID: 'generic-api-key', Severity: 'LOW', Match: 'must-not-surface' }], Vulnerabilities: [{ VulnerabilityID: 'CVE-2026-1111', Severity: 'LOW', PkgName: 'example', InstalledVersion: '1.0' }] }] };
  const result = await runTool(plan, { runProcess: fakeProcess(JSON.stringify(report)) });
  assert.equal(result.status, 'FAIL'); assert.equal(result.findings.secrets[0].severity, 'LOW');
  assert.doesNotMatch(JSON.stringify(result), /must-not-surface/);
  const dependencyOnly = { SchemaVersion: 2, Results: [{ Vulnerabilities: report.Results[0].Vulnerabilities }] };
  const nonfatal = await runTool(plan, { runProcess: fakeProcess(JSON.stringify(dependencyOnly)) });
  assert.equal(nonfatal.status, 'PASS'); assert.equal(nonfatal.findings.vulnerabilities[0].severity, 'LOW'); assert.equal(nonfatal.findings.vulnerabilities[0].blocking, false); assert.equal(nonfatal.findings.nonblockingVulnerabilityCount, 1);
  const failed = await runTool(plan, { runProcess: fakeProcess(JSON.stringify(dependencyOnly), { exitCode: 2 }) });
  assert.equal(failed.status, 'FAIL');
});
