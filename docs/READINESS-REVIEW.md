# Readiness review candidate

**Implementation available for review. Live integration BLOCKED; production unchanged.**

This is a focused extension based on `fb31c84093f8cf148696c7847a3201bfd3336946`.
The current Windows DBOS/auth/lease/dashboard sources are not in that snapshot.
No existing files were replaced. Disabled profiles and two explicit integration
flags prevent automatic activation. No AI provider was called.

## Results

| Verification | Result | Scope |
|---|---|---|
| Core readiness, grants, evidence, freshness | 34/34 PASS | Isolated host contracts; not actual DBOS/Neon integration |
| Tool policy, redaction and process guards | 21/21 PASS | Includes real subprocess timeout/cancel/output termination |
| Authenticated routes and evidence access | 16/16 PASS | Isolated route contracts |
| Actual Python Playwright/Chromium | 8/8 fixture + 6/6 dashboard PASS | Synthetic application and mocked dashboard API |
| Actual Node adapter -> Playwright -> Chromium | 1/1 PASS | Node 22, real CLI/browser, synthetic outcome and download |
| Trivy: older BossMind source snapshot | FAIL: 108 blocking dependency occurrences | 103 HIGH + 5 CRITICAL; 93 lower-severity dependency occurrences |
| Trivy: supplied Resumora edit package | FAIL: 1 HIGH dependency occurrence | `node-forge` 1.4.0, scanner ID `CVE-2026-85393`, no fixed version supplied; 2 MEDIUM occurrences |
| Current Windows DBOS/routing/scheduler/remote ledger | BLOCKED | Current source/runtime unavailable |
| Actual signup, test checkout, per-plan delivery | BLOCKED | No authorized staging target/account |
| Selected ASVS requirements | NOT TESTED | Manual review required |
| ZAP, k6 staging verification | BLOCKED | Neither installed nor live-verified; no approved target |
| Current container images | NOT TESTED | No approved image/digest |

Scanner findings are not confirmed exploitable live vulnerabilities. Counts are
occurrences across scanned manifests, not necessarily unique CVEs. No secret
matches or failing misconfiguration findings were reported in these scoped source
scans; that does not prove absence of every secret or security defect. Inline
suppressions, applicability and runtime exposure still need manual review.
The scanner exits 0 on a valid report; normalized security policy still returns
FAIL when blocking findings exist. Tool execution success is not project PASS.

Installed/verified here: Node 22.23.3, Node Playwright 1.64.1, optional Python
Playwright 1.62.0, system Chromium 154.0.8037.57, Trivy 0.76.0 with official
archive checksum and fresh DB. This does not inventory Windows installations.
ASVS is a checklist. DefectDojo remains deferred.

## Review artifacts

- [Integration, dashboard use, activation and rollback](readiness-integration.md)
- [Disabled project profiles](../config/readiness-profiles.example.json)
- [Consolidated report and tool states](readiness-evidence/REPORT.json)
- [Source findings, scanner configuration and hashes](readiness-evidence/trivy-source.json)
- [Unit/contract results](readiness-evidence/tests.json), with three adjacent TAP files
- [Actual browser evidence](readiness-evidence/browser-fixture.json)
- [Actual Node adapter invocation and evidence](readiness-evidence/playwright-adapter.json)
- [Accessible source inventory](readiness-evidence/inventory.json)

The source scans bind to content manifests of local source copies and identify
the older base; they do not purport to scan the current Windows deployment.
Browser evidence binds to exact harness, suite, adapter and UI hashes. Runtime
profiles require full commit/environment/configuration/scope binding before any
technical GO. The consolidated disabled profiles show NO-GO because all eight
critical checks per project are blocked pending integration/scope approval.

The next implementation step is to bind these components to the current Windows
DBOS, lease, grants, recorder and artifact services, then run the documented
integration acceptance. No safe turnkey activation is claimed before that work.
Resumora deployment stays HOLD, Cursor disabled, provider restrictions preserved,
and approvals untouched. Technical acceptance cannot guarantee income, legal
compliance, content quality or global launch readiness.
