// Server/selfHeal/health.cjs
// Health endpoint logic for BossMind Self-Heal Phase 3
// CommonJS module (safe for Node/Express .cjs entrypoints)

const fs = require("fs");
const path = require("path");

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function readState(statePath) {
  try {
    if (!fs.existsSync(statePath)) {
      return { ok: false, error: new Error(`state.json not found at: ${statePath}`) };
    }
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = safeJsonParse(raw);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
      return { ok: false, error: new Error(`state.json invalid JSON at: ${statePath}`) };
    }
    return { ok: true, value: parsed.value };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function normalizeStatus(status) {
  if (status === "ok" || status === "degraded" || status === "critical") return status;
  return "degraded";
}

/**
 * Mounts GET /health on an existing Express app.
 */
function mountHealth(app, opts = {}) {
  if (!app || typeof app.get !== "function") {
    throw new Error("mountHealth(app): app must be an Express instance");
  }

  const statePath =
    opts.statePath ||
    path.join(process.cwd(), "Server", "selfHeal", "runtime", "state.json");

  const startedAtMs = typeof opts.startedAt === "number" ? opts.startedAt : Date.now();

  app.get("/health", (req, res) => {
    const uptimeSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));

    const state = readState(statePath);
    if (!state.ok) {
      return res.status(200).json({
        status: "critical",
        uptime_sec: uptimeSec,
        active_model: "unknown",
        last_error: state.error ? String(state.error.message || state.error) : "state_read_failed",
        restarts_24h: 0
      });
    }

    const s = state.value || {};
    const payload = {
      status: normalizeStatus(s.status),
      uptime_sec: uptimeSec,
      active_model: typeof s.active_model === "string" ? s.active_model : "unknown",
      last_error: s.last_error === null ? null : (typeof s.last_error === "string" ? s.last_error : String(s.last_error)),
      restarts_24h: Number.isFinite(s.restart_count_24h) ? s.restart_count_24h : 0
    };

    return res.status(200).json(payload);
  });

  return { statePath, startedAtMs };
}

module.exports = {
  mountHealth,
  readState,
  normalizeStatus,
  nowSec
};
