'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = /^[a-z][a-z0-9-]{0,63}$/i;
const EXECUTION_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const CHECK_ID = /^[a-z0-9][a-z0-9_.-]{0,99}$/i;

function sendError(res, status, code, message) {
  if (res.headersSent || res.writableEnded) return;
  res.status(status).json({ error: { code, message } });
}

function safeError(res, error) {
  const proposed = Number(error && (error.statusCode || error.status));
  const status = [400, 401, 403, 404, 408, 409, 429, 503].includes(proposed) ? proposed : 500;
  const code = error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code || '')
    ? error.code : 'READINESS_OPERATION_FAILED';
  sendError(res, status, code, status === 500
    ? 'The readiness operation could not complete. Inspect the existing redacted event log.'
    : 'The readiness operation is unavailable or was refused. Inspect the recorded status.');
}

function identity(req) {
  const user = req.user || (req.session && req.session.user);
  const value = typeof user === 'string' ? user
    : user && (user.id || user.uid || user.email);
  const fallback = req.session && req.session.userId;
  const actor = value || fallback;
  return typeof actor === 'string' && actor.trim() ? actor.slice(0, 256) : null;
}

function htmlJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026',
    '\u2028': '\\u2028', '\u2029': '\\u2029'
  })[character]);
}

/**
 * Mount into the existing authenticated application only. This module creates
 * no listener, login flow, token, grant, scheduler, queue, or evidence store.
 * Authorization hooks are async(req,res) => true after the existing controls
 * succeed, and set req.user/session plus optional req.readinessContext.
 * False/undefined/throw means refusal. Mutations additionally require identity.
 */
function mountReadiness(app, options = {}) {
  const { service, requireReadSession, requireOwnerAndCsrf,
    getSessionBootstrap, enabled = false } = options;
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
    throw new TypeError('An existing HTTP application is required.');
  }
  if (!service || typeof service.list !== 'function' || typeof service.enqueue !== 'function'
    || typeof requireReadSession !== 'function' || typeof requireOwnerAndCsrf !== 'function') {
    throw new TypeError('Existing readiness service and read/owner-CSRF hooks are required.');
  }
  if (getSessionBootstrap !== undefined && typeof getSessionBootstrap !== 'function') {
    throw new TypeError('getSessionBootstrap must be an existing authenticated session hook.');
  }

  const templatePath = path.join(__dirname, '..', 'ui', 'readiness.html');
  const authorized = async (req, res, write) => {
    try {
      // Authentication is checked before owner/CSRF authorization, including
      // mutation routes, so anonymous access is consistently a session refusal.
      const readAllowed = await requireReadSession(req, res);
      if (res.headersSent || res.writableEnded) return false;
      if (readAllowed !== true) {
        sendError(res, 401, 'READINESS_SESSION_REQUIRED',
          'Sign in through the existing administration session.');
        return false;
      }
      const allowed = write ? await requireOwnerAndCsrf(req, res) : true;
      if (res.headersSent || res.writableEnded) return false;
      if (allowed !== true) {
        sendError(res, write ? 403 : 401,
          write ? 'READINESS_OWNER_CSRF_REQUIRED' : 'READINESS_SESSION_REQUIRED',
          write ? 'An owner session and existing CSRF validation are required.'
            : 'Sign in through the existing administration session.');
        return false;
      }
      if (enabled !== true) {
        sendError(res, 503, 'READINESS_DISABLED',
          'The readiness extension is disabled pending integration verification.');
        return false;
      }
      return true;
    } catch (error) {
      const status = Number(error && (error.statusCode || error.status));
      sendError(res, status === 401 ? 401 : (write ? 403 : 401),
        write ? 'READINESS_OWNER_CSRF_REQUIRED' : 'READINESS_SESSION_REQUIRED',
        'The existing administration security check refused this request.');
      return false;
    }
  };
  const protect = handler => async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try { await handler(req, res); } catch (error) { safeError(res, error); }
  };

  app.get('/admin/readiness', protect(async (req, res) => {
    if (!await authorized(req, res, false)) return;
    const supplied = getSessionBootstrap ? await getSessionBootstrap(req) : {};
    const csrfToken = supplied && typeof supplied.csrfToken === 'string'
      && supplied.csrfToken.length <= 4096 ? supplied.csrfToken : '';
    // Missing integration/session metadata never enables a control.
    const bootstrap = {
      csrfToken,
      canRun: Boolean(csrfToken && supplied && supplied.canRun === true),
      canSchedule: Boolean(csrfToken && supplied && supplied.canSchedule === true
        && typeof service.schedule === 'function')
    };
    const nonce = crypto.randomBytes(18).toString('base64');
    res.setHeader('Content-Security-Policy', [
      "default-src 'none'", `script-src 'nonce-${nonce}'`, `style-src 'nonce-${nonce}'`,
      "connect-src 'self'", "img-src 'none'", "base-uri 'none'", "form-action 'none'",
      "frame-ancestors 'self'", "object-src 'none'"
    ].join('; '));
    const html = fs.readFileSync(templatePath, 'utf8')
      .replaceAll('__READINESS_NONCE__', nonce)
      .replace('__READINESS_BOOTSTRAP__', () => htmlJson(bootstrap));
    res.type('html').send(html);
  }));

  app.get('/api/readiness', protect(async (req, res) => {
    if (!await authorized(req, res, false)) return;
    // Reads existing records only. No scan, subprocess, inference, or enqueue.
    res.json(await service.list());
  }));

  app.get('/api/readiness/evidence/:project/:execution/:check', protect(async (req, res) => {
    if (!await authorized(req, res, false)) return;
    const params = req.params || {};
    if (typeof params.project !== 'string' || !PROJECT_ID.test(params.project)
      || typeof params.execution !== 'string' || !EXECUTION_ID.test(params.execution) || params.execution.includes('..')
      || typeof params.check !== 'string' || !CHECK_ID.test(params.check) || params.check.includes('..')) {
      sendError(res, 400, 'READINESS_EVIDENCE_ID_INVALID', 'Choose a saved readiness evidence record.');
      return;
    }
    const actor = identity(req);
    if (!actor) {
      sendError(res, 403, 'READINESS_IDENTITY_REQUIRED', 'The authenticated reader identity is missing.');
      return;
    }
    if (typeof service.readEvidence !== 'function') {
      sendError(res, 503, 'READINESS_EVIDENCE_UNAVAILABLE',
        'The existing evidence reader integration is not configured.');
      return;
    }
    const result = await service.readEvidence({
      projectId: params.project,
      executionId: params.execution,
      checkId: params.check,
      actor,
      context: req.readinessContext || {}
    });
    // The service must recheck the existing readiness:read grant and return
    // normalized/redacted evidence. Never serve tool HTML or raw trace files.
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result);
  }));

  const mutation = method => protect(async (req, res) => {
    if (!await authorized(req, res, true)) return;
    const actor = identity(req);
    if (!actor) {
      sendError(res, 403, 'READINESS_IDENTITY_REQUIRED', 'The authenticated owner identity is missing.');
      return;
    }
    if (!PROJECT_ID.test((req.params && req.params.project) || '')) {
      sendError(res, 400, 'READINESS_PROJECT_INVALID', 'Choose a configured project.');
      return;
    }
    // Targets, commands, frequency, grant IDs and identities come from trusted
    // profiles/session hooks, never from the browser request body.
    if (req.body !== undefined && req.body !== null
      && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
      sendError(res, 400, 'READINESS_BODY_REFUSED', 'This operation accepts only the configured project.');
      return;
    }
    if (typeof service[method] !== 'function') {
      sendError(res, 503, 'READINESS_SCHEDULE_UNAVAILABLE',
        'No existing approved schedule integration is configured.');
      return;
    }
    const result = await service[method]({
      projectId: req.params.project,
      actor,
      context: req.readinessContext || {}
    });
    res.status(202).json(result);
  });
  app.post('/api/readiness/:project/runs', mutation('enqueue'));
  app.post('/api/readiness/:project/schedules', mutation('schedule'));
  return { enabled: enabled === true };
}

module.exports = { mountReadiness };
