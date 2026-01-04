// Server/security/rateLimit.cjs
// BossMind Phase 5 — Simple in-memory rate limiter (CJS)
// Windows-safe, no dependencies, no background timers.

function nowMs() {
  return Date.now();
}

function getIp(req) {
  // Local-first, no proxy assumptions
  const xf = (req.headers && req.headers["x-forwarded-for"]) ? String(req.headers["x-forwarded-for"]) : "";
  const ip = xf.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  return String(ip);
}

function rateLimit(opts = {}) {
  const windowMs = Number.isFinite(opts.windowMs) ? opts.windowMs : 60_000; // 1 min
  const max = Number.isFinite(opts.max) ? opts.max : 60; // 60 req per window
  const protectPrefix = String(opts.protectPrefix || "/api/");

  // key -> { count, resetAt }
  const buckets = new Map();

  return function bossMindRateLimit(req, res, next) {
    const url = String(req.originalUrl || req.url || "");
    if (!url.startsWith(protectPrefix)) return next();

    const ip = getIp(req);
    const key = `${ip}:${protectPrefix}`;

    const t = nowMs();
    const b = buckets.get(key);

    if (!b || t >= b.resetAt) {
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - 1)));
      return next();
    }

    b.count += 1;
    const remaining = Math.max(0, max - b.count);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (b.count > max) {
      return res.status(429).json({ error: true, code: "RATE_LIMITED" });
    }

    return next();
  };
}

module.exports = { rateLimit };
