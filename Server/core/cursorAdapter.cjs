'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// This scaffold has no verified headless Cursor transport. Environment flags and
// the editor executable must never turn it into an inference provider.
const BLOCKER = 'A supported, authenticated unattended Cursor transport has not been verified. Cursor remains disabled; account limits, charges, and reset times are unknown.';
const META = '.bossmind-cursor';

function error(message, code, status, classified) {
  return Object.assign(new Error(message), { code, status, classified });
}

function blocked() {
  return error(BLOCKER, 'CURSOR_HEADLESS_UNAVAILABLE', 503, 'BLOCKED');
}

function uncertain() {
  return error('Cursor completion or workspace effects require reconciliation before another attempt.', 'UNCERTAIN_EFFECT', 409, 'UNKNOWN_COMPLETION');
}

function editorCli(env = process.env) {
  if (!env.LOCALAPPDATA) return null;
  const base = path.join(env.LOCALAPPDATA, 'Programs', 'cursor');
  const exe = path.join(base, 'Cursor.exe');
  const cli = path.join(base, 'resources', 'app', 'out', 'cli.js');
  if (!fs.existsSync(exe) || !fs.existsSync(cli)) return null;
  return { exe, cli, version: null, capability: 'editor' };
}

function enabled() { return false; }

function providerRecord(env = process.env) {
  const model = String(env.BOSSMIND_CURSOR_MODEL || 'configured-default').trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
    throw error('Cursor model id is invalid.', 'UNSUPPORTED_MODEL', 400, 'CONFIGURATION');
  }
  return { name: 'cursor-cli', kind: 'cli', agent: 'cursor', model, timeoutMs: 120000, file: null, enabled: false, inferenceVerified: false };
}

function classifyFailure(cause) {
  if (cause?.code === 'UNCERTAIN_EFFECT') return uncertain();
  const status = cause?.status;
  // Do not copy provider error text: it can contain credentials or prompt data.
  if (status === 429) {
    const failure = error('Cursor quota is exhausted.', 'CURSOR_QUOTA', 429, 'QUOTA');
    const reset = typeof cause.resetAt === 'number' ? cause.resetAt :
      typeof cause.resetAt === 'string' ? Date.parse(cause.resetAt) : NaN;
    failure.resetAt = Number.isFinite(reset) && reset > 0 && reset <= 8640000000000000 ? reset : null;
    return failure;
  }
  if (status === 401 || status === 403) return error('Cursor authentication is unavailable.', 'CURSOR_AUTH', 401, 'AUTH_FAILED');
  if (status === 408 || cause?.name === 'AbortError' || cause?.name === 'TimeoutError') {
    return error('Cursor request was cancelled or timed out.', 'CURSOR_TIMEOUT', 408, 'TIMEOUT');
  }
  return error('Cursor request failed before a verified result.', 'CURSOR_FAILURE', 503, 'TRANSIENT');
}

function canonical(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object' || seen.has(value)) throw error('Cursor request settings must be finite JSON data.', 'INVALID_CURSOR_REQUEST', 400, 'CONFIGURATION');
  seen.add(value);
  let text;
  if (Array.isArray(value)) text = '[' + value.map(v => canonical(v, seen)).join(',') + ']';
  else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw error('Cursor request settings must be plain JSON data.', 'INVALID_CURSOR_REQUEST', 400, 'CONFIGURATION');
    }
    text = '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], seen)).join(',') + '}';
  }
  seen.delete(value);
  return text;
}

function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function scope(options) {
  const executionId = options.executionId;
  const step = typeof options.step === 'number' && Number.isFinite(options.step) ? String(options.step) : options.step;
  const valid = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(v);
  if (!valid(executionId) || !valid(step) || typeof options.workspace !== 'string' || !path.isAbsolute(options.workspace)) {
    throw error('An explicit execution id, durable step, and absolute workspace are required.', 'INVALID_CURSOR_SCOPE', 400, 'CONFIGURATION');
  }
  const workspace = fs.realpathSync(options.workspace);
  if (!fs.statSync(workspace).isDirectory()) throw error('Cursor workspace is not a directory.', 'INVALID_CURSOR_SCOPE', 400, 'CONFIGURATION');
  return { executionId, step, workspace };
}

function safeEntry(file, directory = false) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
      throw error('Cursor metadata path is unsafe.', 'CURSOR_PATH_UNSAFE', 409, 'BLOCKED');
    }
    return true;
  } catch (cause) {
    if (cause.code === 'ENOENT') return false;
    throw cause;
  }
}

function locations(current, create = false) {
  const dir = path.join(current.workspace, META);
  if (create) {
    try { fs.mkdirSync(dir, { mode: 0o700 }); }
    catch (cause) { if (cause.code !== 'EEXIST') throw cause; }
  }
  if (!safeEntry(dir, true)) return null;
  // Older scaffolds used raw id-step filenames and post-failure markers. Do
  // not silently ignore that history and dispatch work whose effects are unknown.
  if (fs.readdirSync(dir).some(name => !/^(?:[a-f0-9]{64}(?:\.claim)?\.json|[a-f0-9-]{36}\.tmp)$/.test(name))) throw uncertain();
  const key = digest([current.executionId, current.step]);
  return { dir, file: path.join(dir, key + '.json'), claim: path.join(dir, key + '.claim.json') };
}

function syncDirectory(dir) {
  let fd;
  try { fd = fs.openSync(dir, fs.constants.O_RDONLY); fs.fsyncSync(fd); }
  catch (cause) {
    // Windows does not support opening/fsyncing directories through this API.
    if (process.platform !== 'win32' || !['EINVAL', 'EPERM', 'EACCES', 'ENOTSUP', 'EISDIR'].includes(cause.code)) throw cause;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function durableCreate(file, value) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function readJson(file) {
  if (!safeEntry(file)) return null;
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    if (!fs.fstatSync(fd).isFile()) throw uncertain();
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } catch (cause) { if (cause.code === 'CURSOR_PATH_UNSAFE') throw cause; throw uncertain(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function savedAt(files, current, inputHash) {
  if (!files) return null;
  let claimed;
  let saved;
  try {
    claimed = safeEntry(files.claim);
    saved = readJson(files.file);
  } catch (cause) {
    // Once dispatch was claimed, even an unsafe/corrupt result path must not
    // become a new-provider fallback or another invocation of this step.
    if (claimed) throw uncertain();
    throw cause;
  }
  if (saved) {
    if (saved.schemaVersion !== 2 || saved.executionId !== current.executionId || saved.step !== current.step || saved.inputHash !== inputHash ||
        saved.result?.testOnly !== true || typeof saved.result?.choices?.[0]?.message?.content !== 'string' || !saved.result.choices[0].message.content.trim()) throw uncertain();
    return saved.result;
  }
  if (claimed) throw uncertain();
  return null;
}

function readSaved(workspace, executionId, step, inputHash) {
  const current = scope({ workspace, executionId, step });
  return savedAt(locations(current), current, inputHash);
}

function writeSaved(files, current, inputHash, result) {
  safeEntry(files.dir, true);
  safeEntry(files.file);
  const temp = path.join(files.dir, crypto.randomUUID() + '.tmp');
  try {
    durableCreate(temp, { schemaVersion: 2, executionId: current.executionId, step: current.step, inputHash, result });
    fs.renameSync(temp, files.file);
    syncDirectory(files.dir);
  } finally { try { fs.unlinkSync(temp); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; } }
}

function abortBeforeDispatch(signal) {
  if (signal?.aborted) throw error('Cursor task was cancelled before dispatch.', 'CURSOR_CANCELLED', 408, 'CANCELLED');
}

async function authorized(authorize, provider, options) {
  if (await authorize(provider, options) !== true) throw error('Cursor task scope is not authorized.', 'CURSOR_SCOPE_DENIED', 403, 'BLOCKED');
}

function usageCounts(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const counts = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'input_tokens', 'output_tokens', 'cached_input_tokens', 'total_tokens']) {
    if (Number.isSafeInteger(usage[key]) && usage[key] >= 0) counts[key] = usage[key];
  }
  return Object.keys(counts).length ? counts : null;
}

function changedFiles(outcome, workspace) {
  if (!Array.isArray(outcome.changedFiles)) return [];
  return outcome.changedFiles.map(file => {
    if (typeof file !== 'string' || file.includes('\0')) throw uncertain();
    const relative = path.relative(workspace, path.resolve(workspace, file));
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw uncertain();
    return relative;
  }).slice(0, 20);
}

async function executeTest(hooks, provider, messages, options = {}) {
  options = { ...options };
  const current = scope(options);
  // Hash and execute the same immutable request, including across lease waits.
  // Caller-owned objects must not be able to change an already-scoped task.
  const snapshot = freezeJson(JSON.parse(canonical({ provider, messages, settings: options.settings ?? {} })));
  provider = snapshot.provider;
  messages = snapshot.messages;
  const timeoutMs = provider?.timeoutMs ?? 120000;
  if (!provider || provider.name !== 'cursor-cli' || typeof provider.model !== 'string' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) {
    throw error('Cursor provider settings are invalid.', 'INVALID_CURSOR_REQUEST', 400, 'CONFIGURATION');
  }
  // All effective runner request settings belong in options.settings.
  const settings = snapshot.settings;
  const inputHash = digest({ workspace: current.workspace, request: snapshot });
  const scoped = { ...options, ...current, settings };
  abortBeforeDispatch(options.signal);
  await authorized(hooks.authorize, provider, scoped);
  let files = locations(current);
  let saved = savedAt(files, current, inputHash);
  if (saved) return { ...saved, reconciled: true, requestCount: 0 };
  let release, releaseWriter, result, failure, dispatched = false;
  let timer;
  const controller = new AbortController();
  const abort = () => controller.abort();
  try {
    release = await hooks.acquire({ provider: provider.name, signal: options.signal });
    if (typeof release !== 'function') throw new TypeError('Cursor capacity acquisition must return a release function.');
    abortBeforeDispatch(options.signal);
    await authorized(hooks.authorize, provider, scoped);
    releaseWriter = await hooks.claimWriter({ ...current, signal: options.signal });
    if (typeof releaseWriter !== 'function') throw new TypeError('Cursor writer claim must return a release function.');
    abortBeforeDispatch(options.signal);
    await authorized(hooks.authorize, provider, scoped);
    files = locations(current, true);
    saved = savedAt(files, current, inputHash);
    if (saved) result = { ...saved, reconciled: true, requestCount: 0 };
    else {
      try {
        durableCreate(files.claim, { schemaVersion: 2, ...current, inputHash, testOnly: true, status: 'processing' });
        syncDirectory(files.dir);
      } catch (cause) { if (cause.code === 'EEXIST') throw uncertain(); throw cause; }
      options.signal?.addEventListener('abort', abort, { once: true });
      abortBeforeDispatch(options.signal);
      timer = setTimeout(abort, timeoutMs);
      dispatched = true;
      // A runner must terminate its child and settle when its signal is aborted.
      // Leases remain held until it settles; an ignored abort cannot free a writer.
      const outcome = await hooks.run(provider, messages, { ...current, settings, signal: controller.signal });
      if (controller.signal.aborted || typeof outcome?.content !== 'string' || !outcome.content.trim()) throw uncertain();
      result = {
        choices: [{ message: { role: 'assistant', content: outcome.content } }],
        model: typeof outcome.model === 'string' ? outcome.model : provider.model,
        usage: usageCounts(outcome.usage),
        reconciled: false,
        requestCount: Number.isSafeInteger(outcome.requestCount) && outcome.requestCount >= 0 ? outcome.requestCount : null,
        testOnly: true,
        provenance: 'test',
        telemetryStatus: hooks.ledger ? 'pending' : 'not-configured',
        eventId: crypto.randomUUID(),
      };
      const changes = changedFiles(outcome, current.workspace);
      writeSaved(files, current, inputHash, result);
      if (hooks.ledger) {
        try {
          await hooks.ledger.recordEvent({ eventId: result.eventId, project: 'bossmind', executionId: current.executionId, step: current.step,
            source: 'cursor-adapter', type: 'cursor-job', status: 'completed', provenance: 'isolated-cursor-test',
            detail: { provider: 'cursor-cli', model: result.model, changedFiles: changes, requestCount: result.requestCount, testOnly: true } });
          const acknowledged = { ...result, telemetryStatus: 'recorded' };
          writeSaved(files, current, inputHash, acknowledged);
          result = acknowledged;
        } catch { /* Completion is durable. Report telemetry pending; never rerun. */ }
      }
    }
  } catch (cause) {
    if (dispatched) {
      failure = uncertain();
      const category = classifyFailure(cause);
      failure.causeClassification = category.classified;
      if (category.resetAt !== undefined) failure.resetAt = category.resetAt;
    } else failure = cause;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    let releaseFailed = false;
    for (const fn of [releaseWriter, release]) {
      if (typeof fn === 'function') { try { await fn(); } catch { releaseFailed = true; } }
    }
    if (releaseFailed) {
      if (failure) failure.leaseReleaseFailed = true;
      else if (result) result = { ...result, leaseReleaseStatus: 'pending' };
    }
  }
  if (failure) throw failure;
  return result;
}

// Dependency injection is explicitly confined to an isolated test harness.
// It does not establish CLI readiness, real shared leases, or inference success.
function createTestAdapter(hooks = {}) {
  for (const name of ['run', 'authorize', 'acquire', 'claimWriter']) {
    if (typeof hooks[name] !== 'function') throw new TypeError('Test adapter requires ' + name + '.');
  }
  if (hooks.ledger && typeof hooks.ledger.recordEvent !== 'function') throw new TypeError('Test ledger requires recordEvent.');
  const dependencies = Object.freeze({ ...hooks });
  return { testOnly: true, complete: (provider, messages, options) => executeTest(dependencies, provider, messages, options) };
}

async function health() { return { online: false, status: 'blocked', inferenceVerified: false, error: BLOCKER, limits: null }; }
async function complete() { throw blocked(); }

module.exports = { BLOCKER, editorCli, enabled, providerRecord, health, complete, classifyFailure, readSaved, createTestAdapter };
