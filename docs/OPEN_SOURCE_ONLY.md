# BossMind open-source-only and zero-new-spend policy

Policy ID: BOSSMIND-OPEN-SOURCE-ONLY-1
Effective owner instruction: 2026-10-17 (America/Toronto).
Scope: every current and future BossMind system, project, agent, worker,
automation, integration, scheduled job and development workflow. This includes
Resumora, ElegancyArt, AI Video Generator, TikTok AI and Global Stock.

## Mandatory rule

Do not purchase, subscribe to, upgrade to, manually renew, start a trial for,
top up, or enable a paid plan or paid product. Do not add payment methods,
purchase hardware/hosting/credits, enable metered APIs or provision resources
that can create new charges. A trial, promotional credit, proprietary free tier,
open-source client or self-hosted label is not proof of eligible software or
zero cost. Do not rely on a spending cap, automatic free allowance or an
unverified price of zero.

New autonomous AI work must use reviewed open-source software and qualifying
locally executed models on existing resources with no per-request/model/API
charge or metered dependency. Reject paid-cloud fallback and automatic quota
upgrades. Check eligibility before credential lookup or provider transport.
Unknown license, maintenance, execution path or incremental cost means BLOCKED;
report the reason and continue independent work that satisfies this policy.
Do not invent a free price or silently route a task to a paid provider.

Prefer maintained, stable, professionally suitable releases. Review official
license and project sources, security advisories, maintenance activity,
compatibility and demonstrated task quality; pin the selected version or
artifact digest. The newest version or an unverified 'most advanced' claim is
not sufficient evidence. Software needs a verified open-source license
compatible with intended commercial use. Review model code and weight licenses
separately. Merely open-weight, source-available, noncommercial, restricted or
unknown licenses do not establish open-source eligibility.

Record tool/model identity, version/digest, license evidence, verification date,
local execution path, absence of metered dependencies and test result through
existing inventory/evidence/recorder facilities. Do not introduce a second
approval system, scheduler, registry database or memory store.

Only a later explicit user instruction changing this rule can authorize an
exception. An older approval, generic owner grant, successful login, configured
credential or available balance does not authorize new paid usage.

## Existing services and customer operations

Do not cancel accounts, change billing, disable infrastructure, stop/replay
in-flight work, delete credentials/data, alter entitlements or migrate production
as an automatic consequence of this rule. Inventory existing services and
renewals and prepare a safe migration/cancellation proposal separately. Do not
start a new billable AI task while that migration is pending. Existing cloud
infrastructure, automatic renewals and previously incurred invoices can still
produce charges until addressed; a policy file does not remove those bills.
Zero-new-spend prohibits new paid product/service charges; it does not promise
that electricity, internet or existing infrastructure expenses are zero.

Customer checkout and collecting revenue are not the owner purchasing a tool.
Preserve existing Stripe/customer workflows, refunds, security and payment checks.
This policy does not authorize changing financial processing or promise that
payment processing/domain/hosting expenses disappear.

Preserve required-secret settings, DBOS/Neon/history, pending approvals,
Resumora production HOLD and disabled provider states. Keep existing capacity
limits, grant revalidation, cross-process leases, writer protection, cancellation
and durable recovery. Prefer an eligible verified local provider; if none is
available, return BLOCKED rather than weakening any of these controls.

## Deployment and enforcement status

Repository instructions make this rule effective for agents reading them.
The JSON companion declares the rule for runtime integration; it is not a
provider gate by itself. Runtime enforcement must be bound to the current
provider router and every API/CLI/worker/scheduler/installer entry point, checked
before credentials/network activity, and verified with zero paid transport calls.
No generic approval UI should bypass it. Polling must remain inference-free.

The current Windows orchestrator and cloud consoles are not accessible from
this Linux workspace. Their enforcement is UNVERIFIED. Do not claim that a
policy file disabled a provider, stopped an existing subscription, changed the
running process, or eliminated all bills. Keep runtime migration a named blocker.
