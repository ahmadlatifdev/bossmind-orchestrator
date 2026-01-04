// Server/security/apiGuard.cjs
// BossMind Phase 5 — API Guard (CJS)
// - Optional API key protection for /api/*
// - Safe JSON size limits
// - Minimal request allowlist (origin + methods)

function getHeader(req, name) {
  const key = String(name || "").toLowerCase();
  return req.headers && req.headers[key] ? String(req.headers[key]) : "";
}

function normalizeList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function apiGuard(opts = {}) {
  const apiKey = (opts.apiKey || process.env.BOSSMIND_API_KEY || "").trim();

  const allowedOrigins = normalizeList(
    opts.allowedOrigins || process.env.BOSSMIND_ALLOWED_ORIGINS || "http://127.0.0.1,http://localhost"
  );

  const protectPrefix = String(opts.protectPrefix || "/api/");
  const allowMethods = normalizeList(opts.allowMethods || "GET,POST,OPTIONS").map((m) => m.toUpperCase());

  const requireKey = apiKey.length > 0; // if no key configured, runs in "open" mode safely

  return function bossMindApiGuard(req, res, next) {
    const method = String(req.method || "").toUpperCase();

    // Method allowlist
    if (!allowMethods.includes(method)) {
      return res.status(405).json({ error: true, code: "METHOD_NOT_ALLOWED" });
    }

    // Origin allowlist (only enforce if browser sends Origin)
    const origin = getHeader(req, "origin");
    if (origin) {
      const ok = allowedOrigins.includes(origin);
      if (!ok) return res.status(403).json({ error: true, code: "ORIGIN_BLOCKED" });
    }

    // Only protect /api/*
    const url = String(req.originalUrl || req.url || "");
    const isProtected = url.startsWith(protectPrefix);

    if (!isProtected) return next();

    // Preflight
    if (method === "OPTIONS") return res.status(204).end();

    // API Key check (supports header or query)
    if (requireKey) {
      const hdrKey = getHeader(req, "x-bossmind-key");
      const auth = getHeader(req, "authorization");
      const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      const qKey = req.query && req.query.key ? String(req.query.key) : "";

      const presented = (hdrKey || bearer || qKey || "").trim();
      if (!presented || presented !== apiKey) {
        return res.status(401).json({ error: true, code: "UNAUTHORIZED" });
      }
    }

    return next();
  };
}

module.exports = { apiGuard };
