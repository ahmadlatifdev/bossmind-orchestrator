// bossmind-automation.js
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import cron from "node-cron";

console.log("🤖 BOSSMIND AUTOMATION ENGINE");
console.log("=".repeat(60));

class BossMindAutomation {
  constructor() {
    this.supabase = null;

    // Prevent overlapping runs
    this.jobLocks = {
      healthCheck: false,
      syncProducts: false,
    };

    // Optional in-memory status
    this.lastRun = {
      healthCheck: null,
      syncProducts: null,
    };

    // Config (env-based)
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseServiceKey:
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_KEY ||
        "",
      healthCron: process.env.BOSSMIND_HEALTH_CRON || "*/5 * * * *", // every 5 minutes
      syncCron: process.env.BOSSMIND_SYNC_CRON || "0 * * * *", // every hour

      // Guardian controls (code-defaults; safe even if DB only stores booleans)
      guardianDefaultEnabled: true,
      guardianMaxFailures: Number(process.env.BOSSMIND_GUARDIAN_MAX_FAILURES || 3),
    };

    // Tables
    this.LOG_TABLE = "bossmind_job_runs";
    this.SWITCH_TABLE = "system_switches";
  }

  // ---------- Bootstrap ----------
  async init() {
    this.validateEnv();

    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "bossmind-automation" } },
    });

    console.log(`✅ Connected to: ${this.config.supabaseUrl}`);
    console.log("✅ BossMind Automation Initialized\n");
  }

  validateEnv() {
    if (!this.config.supabaseUrl) {
      throw new Error(
        "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). Add it to your environment variables."
      );
    }
    if (!this.config.supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY (recommended). Add it to your environment variables."
      );
    }
  }

  // ---------- Switch helpers (Supabase: system_switches.key/value (boolean)) ----------
  async getSwitchBool(key, fallback = false) {
    try {
      const { data, error } = await this.supabase
        .from(this.SWITCH_TABLE)
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (error) throw error;
      if (!data) return fallback;

      // value is expected boolean in your table
      return Boolean(data.value);
    } catch (e) {
      console.error(`⚠️ Switch read failed (${key}):`, e?.message || e);
      return fallback;
    }
  }

  async setSwitchBool(key, valueBool) {
    try {
      const payload = { key, value: Boolean(valueBool) };
      const { error } = await this.supabase.from(this.SWITCH_TABLE).upsert(payload, {
        onConflict: "key",
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`⚠️ Switch write failed (${key}):`, e?.message || e);
      return false;
    }
  }

  // ---------- Guardian ----------
  pauseKey(jobName) {
    // system_switches key names used to pause jobs
    return `guardian_pause_${jobName}`;
  }

  resumeKey(jobName) {
    // manual resume (one-shot) per job
    return `guardian_resume_${jobName}`;
  }

  async isGuardianEnabled() {
    // If key exists, respect it. If not, fallback to code default.
    const enabled = await this.getSwitchBool("guardian_enabled", this.config.guardianDefaultEnabled);
    return enabled;
  }

  async isJobPaused(jobName) {
    return await this.getSwitchBool(this.pauseKey(jobName), false);
  }

  async pauseJob(jobName, reason = "") {
    const ok = await this.setSwitchBool(this.pauseKey(jobName), true);
    if (ok) {
      console.log(`🛑 GUARDIAN: Paused job "${jobName}" ${reason ? `— ${reason}` : ""}`);
    }
  }

  async unpauseJob(jobName) {
    const ok = await this.setSwitchBool(this.pauseKey(jobName), false);
    if (ok) {
      console.log(`🟢 GUARDIAN: Unpaused job "${jobName}"`);
    }
  }

  // NEW: Manual override / resume logic (safe one-shot switches)
  // - guardian_resume_all = true  → unpause both jobs once, then auto-resets to false
  // - guardian_resume_healthCheck = true → unpause healthCheck once, then auto-resets
  // - guardian_resume_syncProducts = true → unpause syncProducts once, then auto-resets
  async processManualResumeSignals() {
    // Resume all
    const resumeAll = await this.getSwitchBool("guardian_resume_all", false);
    if (resumeAll) {
      await this.unpauseJob("healthCheck");
      await this.unpauseJob("syncProducts");
      await this.setSwitchBool("guardian_resume_all", false);
      console.log("🟢 GUARDIAN: Manual resume ALL applied (auto-reset)");
      // continue to check per-job too (harmless)
    }

    // Per-job resume
    for (const jobName of ["healthCheck", "syncProducts"]) {
      const key = this.resumeKey(jobName);
      const resumeOne = await this.getSwitchBool(key, false);
      if (resumeOne) {
        await this.unpauseJob(jobName);
        await this.setSwitchBool(key, false);
        console.log(`🟢 GUARDIAN: Manual resume applied for ${jobName} (auto-reset)`);
      }
    }
  }

  async consecutiveFailures(jobName, maxLookback = 10) {
    try {
      const { data, error } = await this.supabase
        .from(this.LOG_TABLE)
        .select("status, started_at")
        .eq("job_name", jobName)
        .order("started_at", { ascending: false })
        .limit(Math.max(1, maxLookback));

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      let count = 0;
      for (const row of data) {
        if (row.status === "failed") count += 1;
        else if (row.status === "success") break;
        // ignore "started"
      }
      return count;
    } catch (e) {
      console.error(`⚠️ Guardian read runs failed (${jobName}):`, e?.message || e);
      return 0;
    }
  }

  async guardianCheckAndMaybePause(jobName) {
    const enabled = await this.isGuardianEnabled();
    if (!enabled) return;

    const paused = await this.isJobPaused(jobName);
    if (paused) return;

    const maxFailures = Number.isFinite(this.config.guardianMaxFailures)
      ? Math.max(1, this.config.guardianMaxFailures)
      : 3;

    const failures = await this.consecutiveFailures(jobName, maxFailures + 3);

    if (failures >= maxFailures) {
      await this.pauseJob(
        jobName,
        `reached ${failures} consecutive failures (threshold ${maxFailures})`
      );
    }
  }

  // ---------- Logging helpers ----------
  async logRunStart(jobName, details = {}) {
    const payload = {
      job_name: jobName,
      status: "started",
      details,
    };

    const { data, error } = await this.supabase
      .from(this.LOG_TABLE)
      .insert(payload)
      .select("run_id, started_at")
      .single();

    if (error) {
      console.error(`⚠️ Log start failed for ${jobName}:`, error.message || error);
      return { run_id: null, started_at: null };
    }

    return data;
  }

  async logRunFinish(jobName, runId, status, startedAt, details = {}, errorText = null) {
    if (!runId) return;

    const finishedAt = new Date();
    let durationMs = null;

    try {
      if (startedAt) {
        const s = new Date(startedAt).getTime();
        durationMs = Number.isFinite(s) ? Math.max(0, finishedAt.getTime() - s) : null;
      }
    } catch {
      durationMs = null;
    }

    const update = {
      status,
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      details,
      error_text: errorText,
    };

    const { error } = await this.supabase.from(this.LOG_TABLE).update(update).eq("run_id", runId);

    if (error) {
      console.error(`⚠️ Log finish failed for ${jobName}:`, error.message || error);
    }
  }

  // ---------- Safe job wrapper (non-overlapping + logging + guardian) ----------
  async runJob(jobName, fn, details = {}) {
    // NEW: apply manual resume switches (safe, idempotent, auto-reset)
    await this.processManualResumeSignals();

    // 1) Guardian pause check
    if (await this.isJobPaused(jobName)) {
      console.log(`🛑 GUARDIAN: Skipped ${jobName} (paused)`);
      return;
    }

    // 2) Job-level lock (prevents overlaps per job)
    if (this.jobLocks[jobName]) {
      console.log(`⏭️ Skipped ${jobName} (already running)`);
      return;
    }

    this.jobLocks[jobName] = true;

    const started = await this.logRunStart(jobName, {
      ...details,
      guardian_enabled: await this.isGuardianEnabled(),
      guardian_max_failures: this.config.guardianMaxFailures,
    });

    const runId = started?.run_id || null;
    const startedAt = started?.started_at || null;

    try {
      await fn();
      this.lastRun[jobName] = new Date().toISOString();

      await this.logRunFinish(jobName, runId, "success", startedAt, {
        ...details,
        lastRun: this.lastRun[jobName],
      });

      console.log(`✅ ${jobName} finished`);
    } catch (err) {
      const msg =
        (err && (err.stack || err.message)) || (typeof err === "string" ? err : "Unknown error");

      await this.logRunFinish(jobName, runId, "failed", startedAt, details, msg);
      console.error(`❌ ${jobName} failed:`, msg);

      // 3) Guardian evaluates AFTER failure is written to DB
      await this.guardianCheckAndMaybePause(jobName);
    } finally {
      this.jobLocks[jobName] = false;
    }
  }

  // ---------- Jobs ----------
  async healthCheck() {
    const { error } = await this.supabase.from(this.LOG_TABLE).select("id").limit(1);
    if (error) throw new Error(`Supabase health check failed: ${error.message || error}`);
  }

  async syncProducts() {
    const cachePath = process.env.BOSSMIND_PRODUCTS_CACHE || "./bossmind-products-cache.json";

    try {
      await fs.access(cachePath);
    } catch {
      await fs.writeFile(cachePath, JSON.stringify({ createdAt: new Date().toISOString() }, null, 2));
    }

    return;
  }

  // ---------- Scheduler ----------
  start() {
    console.log("🚀 STARTING AUTOMATION JOBS:");
    console.log(`✅ Health checks: Every 5 minutes`);
    console.log(`✅ Product sync: Every hour`);
    console.log(
      `🛡️ DevOps Guardian: ${this.config.guardianMaxFailures} consecutive failures → auto-pause job`
    );
    console.log(
      `🟢 Manual Resume Switches: guardian_resume_all / guardian_resume_healthCheck / guardian_resume_syncProducts\n`
    );

    cron.schedule(this.config.healthCron, async () => {
      await this.runJob("healthCheck", async () => {
        await this.healthCheck();
      });
    });

    cron.schedule(this.config.syncCron, async () => {
      await this.runJob("syncProducts", async () => {
        await this.syncProducts();
      });
    });

    console.log("📌 BossMind Automation is running in the background...\n");
  }
}

// ---------- Run ----------
(async () => {
  try {
    const engine = new BossMindAutomation();
    await engine.init();
    engine.start();
  } catch (e) {
    console.error("❌ BossMind failed to start:", e?.stack || e?.message || e);
    process.exit(1);
  }
})();
