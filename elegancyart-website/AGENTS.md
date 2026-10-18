# BossMind shared operating rule

Owner rule: **BOSSMIND-OPEN-SOURCE-ONLY-1** (2026-10-17).
Applies to this project and every nested system, agent, worker and automation.

- Never purchase, subscribe to, upgrade/manual-renew a paid plan, enroll in a
  trial, top up, add a payment method, buy credits/hardware/hosting, enable
  metered APIs, or provision resources that create new charges.
- Use reviewed, maintained open-source software and qualifying local models on
  existing resources with zero incremental charge and no metered dependencies.
  Verify software and model code/weight licenses separately for commercial use;
  pin versions/digests and verify security, compatibility and actual task quality.
- Unknown licensing/cost/execution means BLOCKED. No paid fallback, automatic
  upgrade, unverified free-tier assumption or invented zero price. Check before
  credentials or provider transport. Do not start new billable AI tasks.
- Existing approvals/logins do not override this rule. Only a later explicit
  user instruction changing the rule can authorize an exception.
- Preserve existing services, accounts, billing settings, customer checkout,
  credentials/data, approvals and in-flight work. Do not cancel subscriptions,
  disable infrastructure or migrate production automatically. Existing invoices
  and automatic renewals remain until separately addressed.
- Preserve DBOS/Neon/history, required secrets, security/grants/leases/writer
  protection, capacity limits, Resumora HOLD and disabled provider states.
- Keep evidence in existing inventory/recorder systems. Do not claim runtime
  enforcement or zero bills merely because these instructions were saved.

Canonical policy: `bossmind-orchestrator/docs/OPEN_SOURCE_ONLY.md` from the
BossMind workspace root; companion `config/open-source-only-policy.json` in
that repository. This self-contained rule still applies when the canonical
file is not present in a standalone checkout.
