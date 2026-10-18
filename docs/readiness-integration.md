# BossMind readiness extension — review candidate, disabled

This patch adds readiness components, not another orchestrator, auth service,
queue, database, approval system or memory store. It is **not installed in the
current Windows process**. The accessible repository is an older snapshot. Its
`server.js`, watchdog and static dashboard are not replacements for the current
Windows runtime. No existing application file or runtime setting was changed.

Resumora remains **HOLD / NO-GO**. Cursor remains disabled. DeepSeek's stored 402,
Gemini restrictions, required-secret configuration, DBOS/Neon, historical records,
and pending approvals were not accessed or changed. No purchase, billable model
call, cloud resource, IAM change, external publish, or customer deployment occurred.
Publishing this review branch is not production activation.

## Included components

- `Server/core/readiness.cjs`: versioned profile validation, scoped evidence,
  honest status assessment, critical gates, durable-job facade and grant checks.
- `Server/core/readinessTools.cjs`: fixed Playwright, Trivy, passive-baseline ZAP
  and bounded GET-only k6 adapters. ASVS remains a manual checklist.
- `Server/routes/readiness.cjs`, `Server/ui/readiness.html`: native authenticated
  dashboard extension. No listener is created and no route is mounted by default.
- `config/readiness-profiles.example.json`: disabled BossMind and Resumora staging
  profiles. No approved target, current tested commit or authorized account exists
  here, so they remain BLOCKED. EN/FR/ES and plan names reflect advertised scope,
  not verified delivery. Intended markets remain unconfirmed.
- Three isolated unit/contract suites, actual Chromium and Node Playwright fixture
  harnesses, pinned optional Node tooling, saved sanitized reports and inventory.

Tool states are recorded for **this Linux review environment**, not Windows.
They are testing/security capabilities, never AI providers. A failed readiness
scan can verify that a scanner executes correctly without passing the project.
ASVS 4.0.3 IDs 1.1.4, 1.4.1, 1.6.1 and 1.8.1 were checked against the official
versioned source. This selected checklist is not full ASVS coverage or certification.
The owner must decide applicability, document manual evidence, and consider the
current ASVS release when extending the profile. Keep version and ID together.

## Required host integration — currently BLOCKED

Wire into the **current** orchestrator, not this checkout's obsolete server.
`createReadiness` requires `enabled: true`, `integrationVerified: true`, trusted
profiles, and all hooks below. Missing hooks, a false flag, or missing commit
blocks direct API/worker execution as well as the UI. CONFIGURED is read-only;
VERIFIED is a host acceptance assertion, not inferred from function presence.
Only set that assertion after actual current-runtime integration acceptance.

| Hook | Must reuse the current implementation |
|---|---|
| `enqueueJob(payload, context)` | Existing authorized DBOS job admission. Preserve requesting actor/grant. The payload has only fixed type/project/fingerprint. |
| `runStep(context, fn)` | Existing durable step and result handling, keyed by execution, step and fingerprint. Return a saved completed result; reconcile an interrupted dispatch before replaying a potentially stateful browser test. Do not substitute an in-memory map. |
| `withLease(context, fn)` | Existing cross-process bounded worker capacity, cancellation and deadline. Testing work must count in total admission; it must not claim an AI provider slot or increase provider limits. Release nested parent capacity before waiting, as current missions do. |
| `withWriterClaim(context, fn)` | Existing artifact writer protection, held through scan, evidence write and recorded event. Claim keys include project/execution/check. |
| `assertGrant(request)` | Existing grant validation; **return true only on success**, otherwise false/throw. Enforce action, project, actor, expiry and revocation. Called on admission, durable replay, after waiting for capacity, and before saving. |
| `recordEvent(event)` | Existing redacting sequential ledger and Neon publisher. Deduplicate deterministic event IDs; preserve provenance, hash, exit code and actual remote-publication state. Never infer remote success from a local write. |
| `storeEvidence(record)` | Existing authenticated artifact store. Return `{stored:true, reportHash, url, remotePublication}` only after durable local save. Honor retentionDays; apply existing ACLs. URL format `/api/readiness/evidence/<project>/<execution>/<check>`. |
| `listEvidence(projectId)` | Existing saved reports with publication receipts merged into their metadata. Read only; no scanner, subprocess, model, or enqueue. |
| `runner(profile, check, context)` | Resolve current verified tool descriptors and build a fresh `planTool` **inside the durable step**, then `runTool(plan,{signal,deadline})`. Plans cannot be serialized or supplied by the browser. |
| `readEvidence(ids)` (optional; otherwise downloads BLOCKED) | Existing artifact read; return `{report,reportHash,remotePublication}`. Service rechecks the project read grant, IDs, attribution and hash. No filesystem path comes from HTTP. |
| `scheduleApprovedJob(payload, context)` (optional) | Existing approved schedule, cadence and resource policy. Absent hook means scheduling BLOCKED. Browser cannot provide cron, target, command or grant. |

`execute(job, context)` needs a safe execution ID, authenticated actor, actual
AbortSignal and absolute deadline. The host must propagate cancellation/revocation
while a scan runs, and wait for process-tree termination before releasing its
lease. Normalized cancellation, timeout and failed scans cannot become PASS.
The adapters enforce command duration/output limits; the host supplies existing
CPU, memory, filesystem and network restrictions. Trusted reviewed/hash-pinned
Playwright code is **not an OS sandbox**. Never run arbitrary customer test code
with the orchestrator's cloud credentials or unrestricted filesystem access.
No browser storage state, credentials, screenshots, video, traces, raw scanner
matches, raw stdout/stderr or unnecessary personal data is retained.

Mount `mountReadiness(existingApp,{service,enabled,requireReadSession,
requireOwnerAndCsrf,getSessionBootstrap})` behind existing authentication. Hooks
return true only after current checks succeed and set trusted req.user/session
and optional req.readinessContext. Mutations require session, owner and CSRF.
Bootstrap returns the existing `{csrfToken,canRun,canSchedule}`; no new token is
created. Retain existing project ACLs. A read-capable machine cannot run/schedule.

Integrate navigation in the current Master Admin dashboard to `/admin/readiness`
through its existing authenticated proxy. Do not expose port 5000 or mount an
unauthenticated iframe. The missing current dashboard/proxy source prevents an
honest navigation patch here. The standalone DBOS demo is not used.

## Staging scope and Phase 2

Before clearing a profile block, supply a full tested commit, repository path,
reviewed acceptance criteria, owners, confirmed plans/languages/browsers/markets,
synthetic-only data, current test accounts and explicitly authorized targets.
Changing any profile field changes its fingerprint and invalidates older evidence.
Evidence must also match commit, environment, provenance and retention window.
NOT APPLICABLE requires nonblank justification and reviewer. Manual PASS requires
reviewer and reference. Critical FAIL/BLOCKED/NOT TESTED/OUTDATED prevents GO.

For target authorization use `{url,authorization:{approved:true,reference,
approvedBy,expiresAt}}`. Approval must cover the staging application's discovered
resources and side effects. ZAP baseline uses a bounded spider; it is **not merely
one passive HTTP request** and must not reach payments, generation, communications,
or production links. Active ZAP is rejected. ZAP/k6 remain uninstalled and BLOCKED
here because there is no authorized staging scope. Do not register them AVAILABLE.

k6 additionally requires `testPolicy.allowLoadTest:true`, check mode `read-only`,
and a reviewed exact HTTPS GET endpoint proven free of billable or customer side
effects. Arbitrary scripts and redirects are refused. Limits are <=2 VUs,
<=2 requests/second, <=30 seconds, p95 <=1000 ms by default (configurable to at most
10000 ms), zero failed checks/requests. Profile maxDurationMs still bounds process
lifetime. ZAP mode is `passive-baseline`. The adapters are implemented and contract
tested; neither tool is represented as installed or live-verified. DefectDojo is deferred.

Trivy requires DB Version 2, a nonempty DB and UpdatedAt <=24 hours. Bootstrap DB
refresh is an explicit maintenance operation, not dashboard polling. Official
GHCR was used after the default mirror was unavailable. Telemetry, version notices,
DB/check updates and repo-local config/ignore/secret config are disabled for runs.
All severities are scanned: HIGH/CRITICAL dependencies, all exposed secrets and
all failed misconfigurations block; lower dependencies remain visible. A normal
scanner exit 0 can still mean readiness FAIL. Inline scanner suppressions and
applicability/exploitability need manual review. Container scanning is NOT TESTED:
no current approved image/digest was supplied. Source results are not container results.

## Verification and reproduction

Unit tests set isolation before imports and create no DBOS connection. Node 22:

```sh
node Server/tests/readiness.test.cjs
node Server/tests/readiness-tools.test.cjs
node Server/tests/readiness-routes.test.cjs
```

Actual browser harnesses (synthetic fixtures only):

```sh
python scripts/readiness-browser-fixture.py --dashboard Server/ui/readiness.html
cd tools/readiness
npm ci --ignore-scripts --no-audit --no-fund --cache /path/to/writable/task-cache
cd ../..
node scripts/run-readiness-playwright-fixture.cjs
```

The Node fixture uses the configured/system Chromium (default `/usr/bin/chromium`)
and pinned Node package; it does not require a browser CDN download. Python
Playwright is optional independent tooling. Fixture runners are explicit local
development verification, **not production worker entry points**. Never schedule
these scripts as customer automation in place of the guarded host service.

Before any current DBOS integration test initializes the SDK, require the explicit
integration-test flag and call `assertTestDatabase(selectedName)`; only
`dbos_bossmind_test` is accepted. Production dotenv/activation files must not
supply a fallback. The guard is tested with zero DB imports; current host DBOS
execution, routing/scheduler tests and remote ledger publication are BLOCKED here
because those components are absent. Contract fixtures do not prove them.

Integration acceptance still needs real tests for: two-process shared capacity,
writer contention, revoked grants/cancellation during a real child, restart and
saved-result reconciliation, evidence ACL/hash/retention, existing ledger+Neon
readback, current provider-routing regression suites, and genuine staging customer
journeys (signup, test checkout/webhooks, plan-specific delivery/downloads).
The supplied Resumora release and existing Windows test-isolation issue remain
separate; this patch neither deploys nor reopens them.

## Dashboard usage after verified integration

Open existing Master Admin -> Readiness. Choose the project and inspect critical
blockers, each check's result/owner, normalized findings and evidence timestamp,
commit and environment. Open evidence through the authenticated link. Refresh
reads saved evidence only. Owner-only **Run approved checks** enqueues the configured
job; it cannot select new targets. Approved schedules use the current scheduler
only. A disabled/CONFIGURED/blocked environment leaves controls unavailable.
Technical GO applies only to the defined scope. Legal/content/marketing quality,
truthful benefits, refunds, taxation, market demand and income need separate review.

## Activation and rollback — prepared, not executed

1. Review this focused branch in a clean integration worktree of the **current**
   Windows branch. Apply only its added readiness files; do not reset or replace
   current server, scheduler, ledger, credentials, dashboard, or watchdog.
2. Implement the host bindings above using current source. Keep both readiness
   flags false while running isolated unit and explicitly fenced DBOS tests.
   Register the fixed readiness workflow and testing capabilities in existing
   registries; create no second scheduler/store. Confirm all live acceptance
   items above, then record the integration's tested commit and owner decision.
3. Configure only approved staging profiles; keep Resumora production HOLD and
   blocked scopes blocked. Turn `enabled` and `integrationVerified` true in that
   reviewed host binding/profile configuration only after acceptance. No unused
   environment flag is presented as an activation switch.
4. Use existing checks to confirm **zero QUEUED, RUNNING and OPERATIONAL_RUNNING**
   in both current memory and durable storage. Leave WAITING_FOR_APPROVAL intact.
   Verify the current Windows watchdog uses the correct current path (the old
   snapshot has an obsolete hardcoded path and must not be copied). Then use the
   existing procedure:

```powershell
& 'D:\BossMind\Bossmind-orchestrator\Server\watchdog.ps1' -Mode stop
& 'D:\BossMind\Bossmind-orchestrator\Server\watchdog.ps1' -Mode start
```

5. Verify port 5000 health, unchanged required-secret/DBOS/capacity/provider holds,
   authenticated GET and denial cases, and one approved staging readiness run.
   Preserve both original and new reports. Do not claim success from health alone.

Rollback: set the host readiness enabled flag false; disable its approved schedules
through the existing owner controls without touching unrelated jobs. Drain or
cancel readiness work through existing authorized execution controls; verify the
same zero-active conditions, then use the two watchdog commands above. Remove
only readiness navigation/bindings if needed. Keep all evidence, mission history,
DBOS/Neon records, approvals and credential settings. No deletion or database reset.

There is **no safe turnkey activation command yet**: current host bindings and
runtime/staging acceptance are missing. This is an explicit integration blocker,
not a request to approve production deployment.

## Official sources

- Playwright: https://github.com/microsoft/playwright and pinned `@playwright/test`
  1.64.1 in the isolated package lock (Apache-2.0).
- Trivy 0.76.0: https://github.com/aquasecurity/trivy/releases/tag/v0.76.0
  (Apache-2.0). Archive checksum is in the retained scan report.
- Selected ASVS source: https://github.com/OWASP/ASVS/blob/v4.0.3/4.0/en/0x10-V1-Architecture.md
  (CC BY-SA 4.0); requirements summarized with attribution, not a certification.
- Deferred executable installations: https://github.com/zaproxy/zaproxy
  (Apache-2.0), https://github.com/grafana/k6 (AGPL-3.0).
- Deferred finding-management option: https://github.com/DefectDojo/django-DefectDojo
  (BSD-3-Clause). No service or subscription was registered.
