"use strict";

// A bounded tool adapter. Call only inside the existing authorized DBOS/shared
// capacity/writer guard. This module creates no scheduler, grants, or event store.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const TOOLS = Object.freeze(['playwright', 'trivy', 'asvs', 'zap', 'k6']);
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_MS = 5 * 60 * 1000;
const MAX_DB_AGE_MS = 24 * 60 * 60 * 1000;
const toolPlans = new WeakSet();

function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const item of Object.values(value)) deepFreeze(item); Object.freeze(value); } return value; }
function blocked(tool, reason) { return Object.freeze({ tool, status: 'BLOCKED', reason }); }
function integer(value, fallback, min, max) {
  const n = value === undefined ? fallback : value;
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('INVALID_LIMIT');
  return n;
}
function canonicalUrl(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw new Error('INVALID_TARGET');
  return u.href;
}
function regularAbsolute(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('INVALID_FILE');
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink()) throw new Error('INVALID_FILE');
  return fs.realpathSync(file);
}
function approvedFile(profile, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw new Error('UNAPPROVED_FILE');
  if (!profile.approvedFiles?.includes(relative)) throw new Error('UNAPPROVED_FILE');
  const expected = profile.approvedFileHashes?.[relative];
  if (!/^[a-f0-9]{64}$/i.test(expected || '')) throw new Error('FILE_HASH_REQUIRED');
  const root = fs.realpathSync(profile.repositoryPath);
  const file = regularAbsolute(path.resolve(root, relative));
  if (!file.startsWith(root + path.sep)) throw new Error('UNAPPROVED_FILE');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('FILE_HASH_CHANGED');
  return { file, sha256: actual };
}
function authorizedTarget(profile, check, now) {
  const url = canonicalUrl(check.target);
  const target = profile.allowedTargets?.find(t => canonicalUrl(t.url) === url);
  if (!target) throw new Error('TARGET_NOT_ALLOWED');
  if (profile.environment === 'fixture') {
    const hostname = new URL(url).hostname;
    if (!profile.testPolicy?.allowLocalFixture || !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) throw new Error('FIXTURE_REQUIRES_LOOPBACK');
  } else {
    const a = target.authorization;
    if (!a?.approved || typeof a.reference !== 'string' || !a.reference.trim() || typeof a.approvedBy !== 'string' || !a.approvedBy.trim() || !Number.isFinite(Date.parse(a.expiresAt)) || Date.parse(a.expiresAt) <= now) throw new Error('TARGET_AUTHORIZATION_REQUIRED');
    if (new URL(url).protocol !== 'https:') throw new Error('STAGING_REQUIRES_HTTPS');
  }
  return url;
}
function databaseInfo(installed, now) {
  const cacheDirectory = fs.realpathSync(installed.cacheDirectory);
  const metadataPath = regularAbsolute(installed.dbMetadataPath);
  if (!metadataPath.startsWith(cacheDirectory + path.sep)) throw new Error('DB_METADATA_OUTSIDE_CACHE');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const updatedAt = Date.parse(metadata.UpdatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt > now + 300000 || now - updatedAt > MAX_DB_AGE_MS || metadata.Version !== 2) throw new Error('DB_STALE_OR_UNKNOWN');
  const databaseFile = regularAbsolute(path.join(path.dirname(metadataPath), 'trivy.db'));
  if (!fs.statSync(databaseFile).size) throw new Error('DB_MISSING');
  return { cacheDirectory, dbMetadataPath: metadataPath, dbUpdatedAt: new Date(updatedAt).toISOString(), dbVersion: metadata.Version };
}

function planTool(profile, check, installed = {}, options = {}) {
  const tool = check?.tool;
  if (!TOOLS.includes(tool)) return blocked(tool || 'unknown', 'UNSUPPORTED_TOOL');
  if (!profile || !['fixture', 'staging'].includes(profile.environment)) return blocked(tool, 'PRODUCTION_OR_UNKNOWN_ENVIRONMENT');
  if (profile.testPolicy?.syntheticOnly !== true) return blocked(tool, 'SYNTHETIC_DATA_POLICY_REQUIRED');
  if (tool === 'asvs') return blocked(tool, 'MANUAL_ASVS_REVIEW_REQUIRED');
  if (tool === 'zap' && check.mode !== 'passive-baseline') return blocked(tool, 'ACTIVE_ZAP_DISABLED');
  if ((tool === 'zap' || tool === 'k6') && profile.environment !== 'staging') return blocked(tool, 'PHASE_2_STAGING_ONLY');
  const descriptor = installed[tool] || (installed.tool === tool ? installed : null);
  if (!descriptor?.verified || typeof descriptor.version !== 'string' || !descriptor.version.trim()) return blocked(tool, 'TOOL_NOT_VERIFIED');
  try {
    const now = options.now ?? Date.now();
    const executable = regularAbsolute(descriptor.executable);
    const maxDurationMs = integer(profile.limits?.maxDurationMs, 60000, 100, MAX_DURATION_MS);
    const maxOutputBytes = integer(profile.limits?.maxOutputBytes, 1048576, 1024, MAX_OUTPUT_BYTES);
    const root = fs.realpathSync(profile.repositoryPath);
    const plan = { tool, status: 'READY', command: executable, args: [], cwd: root,
      limits: { maxDurationMs, maxOutputBytes }, metadata: { toolVersion: descriptor.version, projectId: profile.id, environment: profile.environment }, environment: {} };
    if (tool === 'playwright') {
      const suite = approvedFile(profile, check.suitePath);
      const cliPath = regularAbsolute(descriptor.cliPath);
      const browserExecutable = regularAbsolute(descriptor.browserExecutable);
      const target = authorizedTarget(profile, check, now);
      if (path.dirname(suite.file).split(path.sep).includes('node_modules')) throw new Error('UNAPPROVED_FILE');
      plan.args = [cliPath, 'test', '--config', '<generated-config>', '--reporter=json', '--workers=1', '--retries=0', '--max-failures=1', '--trace=off'];
      plan.configuration = { testDir: path.dirname(suite.file), testMatch: path.basename(suite.file), forbidOnly: true, fullyParallel: false, retries: 0, workers: 1,
        timeout: Math.min(maxDurationMs, 30000), use: { baseURL: target, browserName: 'chromium', headless: true, trace: 'off', screenshot: 'off', video: 'off',
          launchOptions: { executablePath: browserExecutable, args: descriptor.noSandbox === true ? ['--no-sandbox'] : [] } } };
      plan.suite = suite;
      plan.metadata.target = target;
      plan.authorizationExpiresAt = profile.environment === 'staging' ? Date.parse(profile.allowedTargets.find(t => canonicalUrl(t.url) === target).authorization.expiresAt) : null;
      plan.environment.BOSSMIND_READINESS_TARGET = target;
    } else if (tool === 'trivy') {
      const db = databaseInfo(descriptor, now);
      plan.metadata = { ...plan.metadata, dbUpdatedAt: db.dbUpdatedAt, dbVersion: db.dbVersion };
      plan.database = db;
      plan.args = ['fs', '--format=json', '--scanners=vuln,secret,misconfig', '--severity=UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL', '--exit-code=0', '--disable-telemetry', '--skip-version-check', '--offline-scan', '--skip-db-update', '--skip-java-db-update', '--skip-check-update', '--secret-config', '<generated-empty-config>', '--cache-dir', db.cacheDirectory,
        '--config', '<generated-empty-config>', '--ignorefile', '<generated-empty-ignore>', root];
    } else if (tool === 'zap') {
      const target = authorizedTarget(profile, check, now);
      const cliPath = regularAbsolute(descriptor.cliPath);
      plan.args = [cliPath, '-t', target, '-m', '1', '-T', String(Math.max(1, Math.ceil(maxDurationMs / 60000))), '-J', '<generated-zap-report>'];
      plan.metadata.target = target;
      plan.authorizationExpiresAt = Date.parse(profile.allowedTargets.find(t => canonicalUrl(t.url) === target).authorization.expiresAt);
      plan.reportFile = 'zap-report.json';
    } else if (tool === 'k6') {
      if (check.scriptPath) throw new Error('ARBITRARY_LOAD_SCRIPT_DISABLED');
      if (profile.testPolicy.allowLoadTest !== true || check.mode !== 'read-only') throw new Error('LOAD_TEST_APPROVAL_REQUIRED');
      const target = authorizedTarget(profile, check, now);
      const maxVus = integer(profile.limits?.maxVus, 1, 1, 2);
      const rate = integer(profile.limits?.maxRequestsPerSecond, 1, 1, 2);
      const maxP95Ms = integer(profile.limits?.maxP95Ms, 1000, 1, 10000);
      const seconds = Math.floor(Math.min(maxDurationMs, 30000) / 1000);
      if (seconds < 1) throw new Error('INVALID_LIMIT');
      plan.args = ['run', '--quiet', '--no-color', '-'];
      plan.environment.BOSSMIND_READINESS_TARGET = target;
      plan.authorizationExpiresAt = Date.parse(profile.allowedTargets.find(t => canonicalUrl(t.url) === target).authorization.expiresAt);
      plan.stdin = `import http from 'k6/http'; import {check} from 'k6';\nexport const options={scenarios:{bounded:{executor:'constant-arrival-rate',rate:${rate},timeUnit:'1s',duration:'${seconds}s',preAllocatedVUs:1,maxVUs:${maxVus},gracefulStop:'0s'}},thresholds:{checks:['rate==1'],http_req_failed:['rate==0'],http_req_duration:['p(95)<=${maxP95Ms}']},maxRedirects:0};\nexport default function(){const r=http.get(__ENV.BOSSMIND_READINESS_TARGET,{redirects:0,timeout:'5s'});check(r,{'GET returned 200':r=>r.status===200});}\nexport function handleSummary(data){return {stdout:JSON.stringify(data)};}\n`;
      plan.metadata = { ...plan.metadata, target, maxVus, requestsPerSecond: rate, durationSeconds: seconds, maxP95Ms };
    }
    Object.freeze(plan.args); Object.freeze(plan.environment); Object.freeze(plan.metadata); Object.freeze(plan.limits);
    deepFreeze(plan); toolPlans.add(plan); return plan;
  } catch (e) {
    const allowed = /^(INVALID_LIMIT|INVALID_FILE|UNAPPROVED_FILE|FILE_HASH_REQUIRED|FILE_HASH_CHANGED|INVALID_TARGET|TARGET_NOT_ALLOWED|FIXTURE_REQUIRES_LOOPBACK|TARGET_AUTHORIZATION_REQUIRED|STAGING_REQUIRES_HTTPS|DB_METADATA_OUTSIDE_CACHE|DB_STALE_OR_UNKNOWN|DB_MISSING|ARBITRARY_LOAD_SCRIPT_DISABLED|LOAD_TEST_APPROVAL_REQUIRED)$/;
    return blocked(tool, allowed.test(e.message) ? e.message : 'TOOL_PREREQUISITE_UNAVAILABLE');
  }
}

// Only essential noncredential process settings survive. No HOME, ADC, API keys,
// tokens, cookies, cloud config, or arbitrary profile-controlled environment.
function sanitizedEnvironment(extra = {}, platform = process.platform) {
  const env = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', NO_COLOR: '1', CI: '1' };
  for (const name of ['PATH', 'TMPDIR', 'TMP', 'TEMP', ...(platform === 'win32' ? ['SystemRoot', 'WINDIR', 'PATHEXT'] : [])]) {
    if (typeof process.env[name] === 'string') env[name] = process.env[name];
  }
  if (extra.BOSSMIND_READINESS_TARGET) env.BOSSMIND_READINESS_TARGET = extra.BOSSMIND_READINESS_TARGET;
  env.BOSSMIND_TEST_ISOLATION = '1';
  env.BOSSMIND_DBOS_ENABLED = '0';
  return env;
}
function defaultRunProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const started = Date.now(); let child; let done = false; let timedOut = false; let aborted = false; let outputLimited = false; let killing = false; let total = 0;
    const chunks = { stdout: [], stderr: [] }; let timeout; let hardKill; let termination = Promise.resolve();
    const cleanup = () => { clearTimeout(timeout); clearTimeout(hardKill); options.signal?.removeEventListener('abort', abort); };
    const kill = () => {
      if (!child || killing || done) return; killing = true;
      if (process.platform === 'win32') {
        const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
        termination = new Promise(finish => {
          const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, env: options.env, stdio: 'ignore' });
          killer.on('error', () => { try { child.kill('SIGKILL'); } catch {} finish(); });
          killer.on('close', finish);
        });
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
        termination = new Promise(finish => { hardKill = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} } finish(); }, 300); });
      }
    };
    const abort = () => { aborted = true; kill(); };
    if (options.signal?.aborted) return resolve({ exitCode: null, aborted: true, stdout: '', stderr: '', durationMs: 0 });
    try {
      child = spawn(command, args, { cwd: options.cwd, env: options.env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) { cleanup(); return reject(error); }
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', data => {
      const before = total; total += data.length;
      if (before < options.maxOutputBytes) chunks[stream].push(data.subarray(0, Math.max(0, options.maxOutputBytes - before)));
      if (total > options.maxOutputBytes) { outputLimited = true; kill(); }
    });
    child.on('error', error => { if (!done) { done = true; cleanup(); reject(error); } });
    child.on('close', async (exitCode, exitSignal) => {
      if (done) return; done = true; await termination; cleanup();
      if (process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
      resolve({ exitCode, exitSignal, aborted, timedOut, outputLimited, stdout: Buffer.concat(chunks.stdout).toString('utf8'), stderr: Buffer.concat(chunks.stderr).toString('utf8'), durationMs: Date.now() - started });
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    timeout = setTimeout(() => { timedOut = true; kill(); }, options.timeoutMs);
    child.stdin.on('error', () => {}); child.stdin.end(options.stdin || '');
  });
}
function parseJson(value) {
  if (typeof value !== 'string') throw new Error('INVALID_REPORT');
  return JSON.parse(value);
}
function safeIdentifier(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9@._+:/ -]{1,180}$/.test(value) ? value : '[redacted]';
}
function summarize(tool, raw, report, metadata) {
  if (tool === 'playwright') {
    const n = report.stats;
    if (!n || ![n.expected, n.unexpected, n.flaky, n.skipped].every(Number.isInteger)) throw new Error('INVALID_REPORT');
    const findings = { passed: n.expected, failed: n.unexpected, flaky: n.flaky, skipped: n.skipped, errors: Array.isArray(report.errors) ? report.errors.length : 0 };
    return { status: raw.exitCode === 0 && n.expected > 0 && !n.unexpected && !n.flaky && !n.skipped && !findings.errors ? 'PASS' : 'FAIL', findings };
  }
  if (tool === 'trivy') {
    if (report.SchemaVersion !== 2 || !Array.isArray(report.Results)) throw new Error('INVALID_REPORT');
    const vulnerabilities = []; const secrets = []; const misconfigurations = [];
    for (const result of report.Results) {
      for (const v of result.Vulnerabilities || []) vulnerabilities.push({ id: safeIdentifier(v.VulnerabilityID), severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(v.Severity) ? v.Severity : 'UNKNOWN', blocking: ['HIGH', 'CRITICAL'].includes(v.Severity), package: safeIdentifier(v.PkgName), installed: safeIdentifier(v.InstalledVersion), fixed: safeIdentifier(v.FixedVersion || 'unknown') });
      for (const s of result.Secrets || []) secrets.push({ ruleId: safeIdentifier(s.RuleID), severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(s.Severity) ? s.Severity : 'UNKNOWN' });
      for (const m of result.Misconfigurations || []) if (m.Status !== 'PASS') misconfigurations.push({ id: safeIdentifier(m.ID), severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(m.Severity) ? m.Severity : 'UNKNOWN' });
    }
    const count = vulnerabilities.filter(v => v.blocking).length + secrets.length + misconfigurations.length;
    return { status: raw.exitCode === 0 && count === 0 ? 'PASS' : 'FAIL', findings: { vulnerabilities, secrets, misconfigurations, count, nonblockingVulnerabilityCount: vulnerabilities.filter(v => !v.blocking).length } };
  }
  if (tool === 'k6') {
    const checks = report.metrics?.checks?.values; const requests = report.metrics?.http_reqs?.values; const p95Ms = report.metrics?.http_req_duration?.values?.['p(95)'];
    if (!checks || !requests || !Number.isFinite(checks.passes) || !Number.isFinite(checks.fails) || !Number.isFinite(requests.count) || !Number.isFinite(p95Ms)) throw new Error('INVALID_REPORT');
    return { status: raw.exitCode === 0 && checks.passes > 0 && checks.fails === 0 && requests.count > 0 && p95Ms <= metadata.maxP95Ms ? 'PASS' : 'FAIL', findings: { checksPassed: checks.passes, checksFailed: checks.fails, requests: requests.count, p95Ms, maxP95Ms: metadata.maxP95Ms } };
  }
  if (tool === 'zap') {
    if (!Array.isArray(report.site)) throw new Error('INVALID_REPORT');
    const alerts = report.site.flatMap(s => (s.alerts || []).map(a => ({ pluginId: safeIdentifier(String(a.pluginid || 'unknown')), risk: Number(a.riskcode) })));
    if (alerts.some(a => !Number.isInteger(a.risk) || a.risk < 0 || a.risk > 3)) throw new Error('INVALID_REPORT');
    return { status: raw.exitCode === 0 && alerts.length === 0 ? 'PASS' : alerts.some(a => a.risk >= 2) ? 'FAIL' : 'BLOCKED', findings: { alerts }, ...(alerts.length ? { reason: 'ZAP_FINDINGS_REQUIRE_REVIEW' } : {}) };
  }
  throw new Error('INVALID_REPORT');
}

async function runTool(plan, options = {}) {
  if (!plan || plan.status !== 'READY') return { status: 'BLOCKED', reason: plan?.reason || 'PLAN_NOT_READY', tool: plan?.tool || 'unknown' };
  if (!toolPlans.has(plan)) return { status: 'BLOCKED', reason: 'UNTRUSTED_TOOL_PLAN', tool: plan.tool };
  const started = Date.now(); let temporary;
  const base = { tool: plan.tool, toolVersion: plan.metadata.toolVersion, environment: plan.metadata.environment, ...(plan.metadata.dbUpdatedAt ? { dbUpdatedAt: plan.metadata.dbUpdatedAt } : {}) };
  const deadline = options.deadline instanceof Date ? options.deadline.getTime() : options.deadline;
  const timeoutMs = Math.min(plan.limits.maxDurationMs, deadline === undefined ? Infinity : deadline - started);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || options.signal?.aborted) return { ...base, status: 'BLOCKED', reason: options.signal?.aborted ? 'CANCELLED' : 'DEADLINE_EXPIRED', exitCode: null, durationMs: 0 };
  try {
    if (plan.authorizationExpiresAt && plan.authorizationExpiresAt <= started) return { ...base, status: 'BLOCKED', reason: 'TARGET_AUTHORIZATION_EXPIRED', exitCode: null, durationMs: 0 };
    // Revalidate mutable assets immediately before launching. A plan is neither
    // execution authority nor permission to run after its checked inputs change.
    if (plan.suite && crypto.createHash('sha256').update(fs.readFileSync(plan.suite.file)).digest('hex') !== plan.suite.sha256) throw new Error('INPUT_CHANGED');
    if (plan.database) {
      const current = databaseInfo(plan.database, started);
      if (current.dbUpdatedAt !== plan.metadata.dbUpdatedAt) throw new Error('INPUT_CHANGED');
    }
    temporary = await fsp.mkdtemp(path.join(options.temporaryRoot || os.tmpdir(), 'bossmind-readiness-'));
    const args = [...plan.args];
    const replace = (placeholder, file) => { for (let at = 0; at < args.length; at++) if (args[at] === placeholder) args[at] = file; };
    if (plan.configuration) {
      const configFile = path.join(temporary, 'playwright.config.cjs');
      await fsp.writeFile(configFile, 'module.exports = ' + JSON.stringify({ ...plan.configuration, outputDir: path.join(temporary, 'artifacts') }) + ';\n', { mode: 0o600 });
      replace('<generated-config>', configFile);
    }
    if (plan.tool === 'trivy') {
      const configFile = path.join(temporary, 'empty.yaml'); const ignoreFile = path.join(temporary, 'empty.ignore');
      await fsp.writeFile(configFile, '{}\n', { mode: 0o600 }); await fsp.writeFile(ignoreFile, '', { mode: 0o600 });
      replace('<generated-empty-config>', configFile); replace('<generated-empty-ignore>', ignoreFile);
    }
    if (plan.reportFile) replace('<generated-zap-report>', path.join(temporary, plan.reportFile));
    const raw = await (options.runProcess || defaultRunProcess)(plan.command, args, { cwd: plan.tool === 'zap' ? temporary : plan.cwd, env: sanitizedEnvironment(plan.environment), signal: options.signal, timeoutMs, maxOutputBytes: plan.limits.maxOutputBytes, stdin: plan.stdin });
    const resultBase = { ...base, exitCode: Number.isInteger(raw.exitCode) ? raw.exitCode : null, durationMs: Date.now() - started, stdoutBytes: Buffer.byteLength(raw.stdout || ''), stderrBytes: Buffer.byteLength(raw.stderr || '') };
    if (raw.aborted || options.signal?.aborted) return { ...resultBase, status: 'BLOCKED', reason: 'CANCELLED' };
    if (raw.timedOut) return { ...resultBase, status: 'FAIL', reason: 'TIMEOUT' };
    if (raw.outputLimited || resultBase.stdoutBytes + resultBase.stderrBytes > plan.limits.maxOutputBytes) return { ...resultBase, status: 'FAIL', reason: 'OUTPUT_LIMIT' };
    let json = raw.stdout;
    if (plan.reportFile) {
      const reportPath = path.join(temporary, plan.reportFile); const st = await fsp.lstat(reportPath);
      if (!st.isFile() || st.isSymbolicLink() || st.size > plan.limits.maxOutputBytes) throw new Error('INVALID_REPORT');
      json = await fsp.readFile(reportPath, 'utf8');
    }
    const summary = summarize(plan.tool, raw, parseJson(json), plan.metadata);
    return { ...resultBase, ...summary };
  } catch (error) {
    return { ...base, status: 'FAIL', reason: error.message === 'INPUT_CHANGED' ? 'INPUT_CHANGED' : error instanceof SyntaxError || error.message === 'INVALID_REPORT' ? 'INVALID_TOOL_REPORT' : 'TOOL_EXECUTION_FAILED', exitCode: null, durationMs: Date.now() - started };
  } finally {
    if (temporary) await fsp.rm(temporary, { recursive: true, force: true });
  }
}

module.exports = { TOOLS, planTool, runTool, sanitizedEnvironment, defaultRunProcess };
