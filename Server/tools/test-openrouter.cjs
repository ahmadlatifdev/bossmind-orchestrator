"use strict";

// Legacy paid-provider probe is retired. No credentials, model call, or listener.
const { assertInferenceAllowed } = require("../core/spendPolicy.cjs");
try {
  assertInferenceAllowed("openrouter");
  // This historical cloud-only entry has no reviewed zero-charge local runner.
  console.error(JSON.stringify({ ok: false, code: "DIRECT_PROVIDER_BLOCKED" }));
  process.exitCode = 1;
} catch (err) {
  console.error(JSON.stringify({ ok: false, code: err.code, reason: err.reason }));
  process.exitCode = 1;
}
