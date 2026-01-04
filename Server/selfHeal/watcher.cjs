// Server/selfHeal/watcher.cjs
// Self-Heal Watcher for BossMind (Phase 3)
// - Runs inside the server process (interval tick)
// - Checks /health and state.json counters
// - Triggers ONE recovery action per failure (no loops)

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function readJson(filePath, fallbackObj) {
  try {
    if (!fs.existsSync(filePath)) return { ok: true, value: fallbackObj };
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = safeJsonParse(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, value: parsed.value };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function writeJsonAtomic(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith("https://") ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const parsed = safeJsonParse(data);
          if (!parsed.ok) {
            return resolve({
              ok: false,
              statusCode: res.statusCode || 0,
              error: new Error("health_invalid_json")
            });
          }
          resolve({ ok: true, statusCode: res.statusCode || 200, json: parsed.value });
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, statusCode: 0, error: new Error("health_timeout") });
      });

      req.on("error", () => {
        resolve({ ok: false, statusCode: 0, error: new Error("health_unreachable") });
      });
    } catch (e) {
      resolve({ ok: false, statusCode: 0, error: e });
    }
  });
}

function normalizeStatus(status) {
  if (status === "ok" || status === "degraded" || status === "critical") return status;
  return "degraded";
}

/**
 * createWatcher(opts) => { start(), stop(), tick(), statePath }
 */
function createWatcher(opts = {}) {
  const statePath =
    opts.statePath ||
    path.join(process.cwd(), "Server", "selfHeal", "runtime", "state.json");

  const baseUrl = opts.baseUrl || "http://127.0.0.1";
  const port = Number.isFinite(opts.port) ? opts.port : 5000;

  const intervalMs = Number.isFinite(opts.intervalMs) ? opts.intervalMs : 30_000;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 5_000;

  const recoveryPlan = opts.recoveryPlan;
  const onRecovery = typeof opts.onRecovery === "function" ? opts.onRecovery : null;

  let timer = null;
  let started = false;

  function loadState() {
    const base = {
      status: "ok",
      active_model: "openrouter",
      failures: 0,
      last_error: null,
      last_fix: null,
      last_restart: 0,
      restart_count_24h: 0,
      model_switches_5m: 0,
      lock: false
    };

    const read = readJson(statePath, base);
    if (!read.ok) return { ok: false, error: read.error };
    const s = Object.assign({}, base, read.value || {});
    s.status = normalizeStatus(s.status);
    return { ok: true, value: s };
  }

  function saveState(s) {
    writeJsonAtomic(statePath, s);
  }

  function setError(s, msg) {
    s.last_error = msg || "unknown_error";
    s.failures = (Number.isFinite(s.failures) ? s.failures : 0) + 1;

    if (s.failures >= 5) s.status = "critical";
    else if (s.failures >= 2) s.status = "degraded";
    else s.status = "ok";
  }

  function clearFailures(s) {
    s.failures = 0;
    s.last_error = null;
    s.status = "ok";
  }

  function canApplyFix(s, fixName) {
    if (s.lock === true) return false;
    if (!s.last_error) return true;
    if (!s.last_fix) return true;
    return !(String(s.last_fix) === String(fixName));
  }

  async function tick() {
    const st = loadState();
    if (!st.ok) return { ok: false, error: st.error };

    const s = st.value;

    const healthUrl = `${baseUrl}:${port}/health`;
    const health = await httpGetJson(healthUrl, timeoutMs);

    if (!health.ok || !health.json) {
      setError(s, health.error ? String(health.error.message || health.error) : "health_failed");
      saveState(s);

      if (s.failures >= 2 && recoveryPlan && typeof recoveryPlan.nextFix === "function") {
        const fix = recoveryPlan.nextFix(s);
        if (fix && fix.name && canApplyFix(s, fix.name)) {
          s.last_fix = fix.name;
          saveState(s);

          try {
            if (onRecovery) onRecovery({ fix: fix.name, reason: s.last_error });
            await recoveryPlan.applyFix(fix, s);
          } catch (e) {
            s.last_error = `fix_failed:${fix.name}`;
            s.status = "critical";
            saveState(s);
          }
        } else {
          s.lock = true;
          s.status = "critical";
          saveState(s);
        }
      }

      return { ok: true, health: "down", state: s };
    }

    const hs = health.json || {};
    const status = normalizeStatus(hs.status);

    if (status === "ok") {
      clearFailures(s);
      saveState(s);
      return { ok: true, health: "ok", state: s };
    }

    setError(s, typeof hs.last_error === "string" ? hs.last_error : "health_degraded");
    saveState(s);

    if (s.failures >= 2 && recoveryPlan && typeof recoveryPlan.nextFix === "function") {
      const fix = recoveryPlan.nextFix(s);
      if (fix && fix.name && canApplyFix(s, fix.name)) {
        s.last_fix = fix.name;
        saveState(s);

        try {
          if (onRecovery) onRecovery({ fix: fix.name, reason: s.last_error });
          await recoveryPlan.applyFix(fix, s);
        } catch (e) {
          s.last_error = `fix_failed:${fix.name}`;
          s.status = "critical";
          saveState(s);
        }
      } else {
        s.lock = true;
        s.status = "critical";
        saveState(s);
      }
    }

    return { ok: true, health: status, state: s };
  }

  function start() {
    if (started) return;
    started = true;
    timer = setInterval(() => {
      tick().catch(() => {});
    }, intervalMs);
  }

  function stop() {
    if (!started) return;
    started = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, tick, statePath };
}

module.exports = {
  createWatcher
};
