// Server/selfHeal/recoveryPlan.cjs
// Recovery Plan for BossMind Self-Heal (Phase 3)
// ONE action per failure, no loops.

const fs = require("fs");
const path = require("path");

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function readJsonSafe(filePath, fallbackObj) {
  try {
    if (!fs.existsSync(filePath)) return fallbackObj;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackObj;
  }
}

function writeJsonAtomic(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function bumpRestartCounters(statePath) {
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

  const s = Object.assign({}, base, readJsonSafe(statePath, base));
  const now = nowSec();

  if (s.last_restart && (now - s.last_restart) > 86400) {
    s.restart_count_24h = 0;
  }

  s.last_restart = now;
  s.restart_count_24h = (Number.isFinite(s.restart_count_24h) ? s.restart_count_24h : 0) + 1;

  writeJsonAtomic(statePath, s);
  return s;
}

function switchModel(statePath, target) {
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

  const s = Object.assign({}, base, readJsonSafe(statePath, base));
  const now = nowSec();

  if (s.last_restart && (now - s.last_restart) > 300) {
    s.model_switches_5m = 0;
  }

  s.active_model = target;
  s.model_switches_5m = (Number.isFinite(s.model_switches_5m) ? s.model_switches_5m : 0) + 1;

  writeJsonAtomic(statePath, s);
  return s;
}

function createRecoveryPlan(opts = {}) {
  const statePath =
    opts.statePath ||
    path.join(process.cwd(), "Server", "selfHeal", "runtime", "state.json");

  const hooks = opts.hooks || {};

  const FIXES = [
    {
      name: "graceful_restart",
      apply: async () => {
        bumpRestartCounters(statePath);
        if (typeof hooks.gracefulRestart === "function") {
          await hooks.gracefulRestart();
        }
      }
    },
    {
      name: "switch_model_deepseek",
      apply: async () => {
        switchModel(statePath, "deepseek");
      }
    },
    {
      name: "switch_model_openrouter",
      apply: async () => {
        switchModel(statePath, "openrouter");
      }
    },
    {
      name: "clear_caches",
      apply: async () => {
        if (typeof hooks.clearCaches === "function") {
          await hooks.clearCaches();
        }
      }
    },
    {
      name: "hard_restart",
      apply: async () => {
        bumpRestartCounters(statePath);
        if (typeof hooks.hardRestart === "function") {
          await hooks.hardRestart();
        }
      }
    }
  ];

  function nextFix(state) {
    const failures = Number.isFinite(state.failures) ? state.failures : 0;
    const lastError = typeof state.last_error === "string" ? state.last_error : "";

    if (failures >= 2 && failures <= 3) {
      if (lastError.includes("openrouter")) return FIXES.find((f) => f.name === "switch_model_deepseek");
      if (lastError.includes("deepseek")) return FIXES.find((f) => f.name === "switch_model_openrouter");
      if (lastError.includes("timeout")) return FIXES.find((f) => f.name === "switch_model_deepseek");
      return FIXES.find((f) => f.name === "graceful_restart");
    }

    if (failures === 4) return FIXES.find((f) => f.name === "clear_caches");
    if (failures >= 5) return FIXES.find((f) => f.name === "hard_restart");
    return null;
  }

  async function applyFix(fix, state) {
    if (!fix || !fix.name || typeof fix.apply !== "function") return;
    await fix.apply(state);
  }

  return {
    nextFix,
    applyFix,
    statePath
  };
}

module.exports = {
  createRecoveryPlan
};
