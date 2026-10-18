# Open-source-only runtime guard

Policy: BOSSMIND-OPEN-SOURCE-ONLY-1. This patch implements source-level admission
checks in the accessible older Linux checkout. It does not claim that the current
Windows orchestrator, other machines, browser sessions, cloud consoles or existing
subscriptions have been switched or stopped.

## Behavior

`Server/core/spendPolicy.cjs` loads only the fixed repository-owned policy and
`config/local-provider-eligibility.json`. There are no environment switches,
owner/grant flags, HTTP-supplied catalogs, free-tier assertions or credential
shortcuts that authorize a cloud call. Missing, malformed, mismatched or relaxed
policy data denies execution with `COST_POLICY_BLOCKED` / status 403.

The default reviewed local-provider inventory is **empty**. Therefore all actual
inference is blocked in these guarded source paths. No model was downloaded,
registered as verified or activated. Existing cloud transport IDs remain denied
even if a catalog tries to relabel them as local. Local DeepSeek or another
qualifying open-source model must use a distinct reviewed local adapter ID.

A future eligible local provider requires all of:

- Fixed software version and SHA-256 artifact digest; pinned model digest.
- Separately reviewed software, model-code and model-weight license evidence,
  permitted commercial use and a supported open-source license identifier.
- A literal loopback endpoint with explicit port, no credentials/query/redirect,
  local-only backend, disabled cloud access and existing resources.
- Zero incremental service charge and no metered dependency.
- Attributed evidence of maintenance, security and task quality, reviewed within
  30 days; an unexpired verification window no longer than 30 days.

Unknown or incomplete evidence remains BLOCKED. Model selectors containing cloud,
auto/latest aliases or mutable software-version labels are refused. Curated
license identifiers are a conservative supported subset; an unsupported SPDX
identifier requires policy review, not an invented open-source classification.
Evidence fields are trusted reviewed host configuration, not a license verifier
or proof produced by an AI response. Pinning and metadata must be checked against
actual installed artifacts and a real local task before adding an inventory row.
A loopback URL alone does not prove that a backend cannot proxy to a paid cloud.

Exports:

- `evaluateProvider(id)`: immutable decision with fixed, sanitized reasons.
- `assertInferenceAllowed(id)`: immutable endpoint/model/artifact binding or deny.
- `runInference(id, fn)`: checks admission before the callback; no retry/fallback.
- `assertActionAllowed(action)`: denies paid procurement and unreviewed actions.
- `createSpendGuard(...)`: trusted host/test factory only, never HTTP input.

A local adapter must use the returned exact endpoint, model and digest binding,
verify it immediately before dispatch, refuse redirects/cloud proxying, and run
under existing worker filesystem/network restrictions. This module is not an
OS sandbox, billing firewall or replacement for grants, leases and scheduling.
The procurement assertion is not a universal interceptor: only explicitly wired
callers are protected. Do not apply it to customer checkout or ordinary reads.

## Wired paths

| Existing source entry | Enforced behavior |
|---|---|
| `Server/core/openrouterClient.cjs` | Denies before environment key access or fetch |
| `Server/core/providers/openrouterClient.cjs` | Denies before key resolution, timer or transport |
| `Server/core/handleDeepseekChat.cjs` | Denies before optional provider imports; no fake successful fallback |
| `Server/routes/openrouter.chat.cjs` | Structured 403 before key-file/environment lookup, request-body inspection or retries |
| `Server/routes/openrouter.cjs` | Structured 403 before provider import or request dispatch |
| `Server/tools/test-openrouter.cjs` | Safe fixed denial and exit 1; no provider probe |
| `Server/tools/test-bossmind-openrouter.cjs` | Safe fixed denial and exit 1; no indirect inference |
| `server-test.js` | Retired provider test server; safe denial, no listener or dotenv |
| `test-api.js` | Retired provider probe; safe denial, no credential literal in new source |
| `bossmind-dashboard/src/services/deepseek.js` | Browser cloud methods deny before configuration/imports/transport; server enforcement remains authoritative |

The retired probe's inherited history may still contain old sensitive material.
No old payload is copied to evidence/new source, and no credential rotation, IAM,
billing change or secret-file read was performed. Review that history separately;
this guard does not make existing exposure or invoices disappear.

## Verification

Run with Node 22 or later:

```sh
node Server/tests/spend-policy.test.cjs
node Server/tests/spend-policy-entrypoints.test.cjs
```

The guard suite uses isolated, clearly synthetic positive eligibility evidence;
those fixtures do not register a real provider. Entry-point tests execute actual
source handlers with credential, optional-module and transport traps, not a real
provider. The browser service test evaluates its method bodies with only export
syntax transformed; it is not a production frontend build. Four standalone probes
were also run as actual Node processes, each exiting 1 with a fixed denial JSON.
See `docs/spend-policy-evidence/RESULT.json` and adjacent TAP files for counts,
commands, source hashes and limitations. All checks avoid provider credentials,
network/model calls and live DBOS/Neon databases.

## Current Windows integration still required

The modern `providerChain.cjs`, mission/DBOS workers, authenticated Codex/other CLI
adapters, supervisor, cross-process scheduler and installer/provisioning actions
are not in this available checkout. Their enforcement remains UNVERIFIED.
The other accessible repository snapshots had no matching direct cloud-provider
URL in the scoped source audit; that is not a complete dynamic bypass analysis.

Use the current Windows code, not the obsolete server/watchdog in this snapshot:

1. Wire the existing central router, API/CLI callers and manual/scheduled probes
   to this policy before credential resolution, health inference or transport.
   Filter disallowed providers before capacity acquisition where practical;
   recheck inside the lease immediately before dispatch. Stop on policy denial;
   do not retry it or count it as a new billing/authentication failure.
2. Preserve stored DeepSeek/Kimi state, Gemini/Cursor restrictions, owner grants,
   capacity total 2/per-provider 2, durable result recovery and existing history.
   Read-only health/status/result retrieval must stay inference-free. Previously
   completed results may still be read; the guard is for new dispatch.
3. Test every current entry point with a credential/transport trap and actual
   idle-safe smoke checks. Use only `dbos_bossmind_test` for explicit DBOS tests;
   reject live database selection before SDK initialization. No remote model
   call is needed to prove policy denial.
4. Build the current Master Admin bundle if needed for visible policy states.
   Preserve Resumora HOLD; deploy no customer application. Reload the orchestrator
   only through its current watchdog after both memory and durable storage show
   zero QUEUED, RUNNING or OPERATIONAL_RUNNING. Leave approval waits untouched.

No genuine local-generation acceptance is available yet. Hardware inventory,
license/artifact verification, local-only backend/network checks and one bounded
local task are still needed before adding a provider. Prefer maintained stable
software proven on that hardware; do not choose an unverified 'most advanced'
model or buy resources under the zero-new-spend policy.

Rollback of wiring must not silently restore paid dispatch. Keep the owner policy
and default-deny guard in place; revert only an incompatible caller integration
or disable the affected AI entry point. A later explicit owner policy amendment
is required to resume paid usage. Existing accounts, automatic renewals,
production infrastructure, customer payments and historical invoices are unchanged.
