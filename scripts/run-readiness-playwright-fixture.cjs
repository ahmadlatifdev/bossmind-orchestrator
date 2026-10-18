'use strict';

// Development-only adapter verification. This calls the actual bounded tool
// adapter with a hashed synthetic suite and the installed Playwright CLI.
// It intentionally does not claim existing DBOS/auth/shared-lease integration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { planTool, runTool } = require('../Server/core/readinessTools.cjs');
const root = path.resolve(__dirname, '..');
const toolRoot = path.join(root, 'tools', 'readiness');
const output = path.join(root, 'docs', 'readiness-evidence', 'playwright-adapter.json');
const suitePath = 'tools/readiness/tests/local.spec.cjs';
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = report => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
};

(async () => {
  const base = { schemaVersion: 1, scope: 'DEVELOPMENT_SYNTHETIC_ADAPTER_FIXTURE_ONLY',
    productionAcceptance: false, observedAt: new Date().toISOString(),
    integrationPath: 'Manual development call to planTool/runTool; no production host guards or DBOS workflow',
    limitations: ['No deployed application, real account, payment, model, staging target, or production authorization was tested.',
      'This proves the Node Playwright adapter executes and normalizes a trusted synthetic suite; existing host integration remains unverified.'],
    modelCalls: 0, realPayments: 0, externalBrowserRequestsAllowed: 0, screenshots: 0, traces: 0 };
  try {
    const cli = fs.realpathSync(require.resolve('@playwright/test/cli', { paths: [toolRoot] }));
    const packageFile = require.resolve('@playwright/test/package.json', { paths: [toolRoot] });
    const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
    const binary = fs.realpathSync(process.execPath);
    const cliOutput = execFileSync(binary, [cli, '--version'], { cwd: toolRoot, encoding: 'utf8', timeout: 10000 }).trim();
    if (version !== '1.64.1' || cliOutput !== 'Version ' + version) throw new Error('TOOL_VERSION_MISMATCH');
    const chromium = fs.realpathSync('/usr/bin/chromium');
    const browserVersion = execFileSync(chromium, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    const target = 'http://127.0.0.1:49301/';
    const suiteHash = digest(path.join(root, suitePath));
    const profile = { id: 'node-playwright-synthetic', repositoryPath: root, environment: 'fixture',
      allowedTargets: [{ url: target }], approvedFiles: [suitePath], approvedFileHashes: { [suitePath]: suiteHash },
      testPolicy: { syntheticOnly: true, allowLocalFixture: true }, limits: { maxDurationMs: 30000, maxOutputBytes: 1048576 } };
    const check = { id: 'synthetic-delivery', tool: 'playwright', suitePath, target };
    const installed = { playwright: { verified: true, version, executable: binary, cliPath: cli,
      browserExecutable: chromium, noSandbox: true } };
    const plan = planTool(profile, check, installed);
    const result = await runTool(plan, { deadline: Date.now() + 30000 });
    const report = { ...base, status: result.status, tools: { node: process.version, playwright: version, cliOutput, chromium: browserVersion },
      suite: { path: suitePath, sha256: suiteHash },
      sourceSha256: { adapter: digest(path.join(root, 'Server/core/readinessTools.cjs')), harness: digest(__filename),
        packageLock: digest(path.join(toolRoot, 'package-lock.json')) },
      plannedInvocation: plan.status === 'READY' ? { command: plan.command, args: plan.args, shell: false,
        target, maxDurationMs: plan.limits.maxDurationMs, maxOutputBytes: plan.limits.maxOutputBytes,
        workers: 1, retries: 0, trace: 'off', screenshot: 'off', video: 'off' } : { status: plan.status, reason: plan.reason }, result };
    write(report);
    console.log(JSON.stringify({ scope: report.scope, status: report.status, playwright: version, exitCode: result.exitCode,
      findings: result.findings || null, reason: result.reason || null, modelCalls: 0, realPayments: 0 }));
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    write({ ...base, status: 'BLOCKED', reason: 'NODE_PLAYWRIGHT_FIXTURE_UNAVAILABLE', errorCategory: error.name });
    console.log('BLOCKED: Node Playwright fixture prerequisites or execution unavailable');
    process.exitCode = 1;
  }
})();
