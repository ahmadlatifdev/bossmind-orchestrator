import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * BossMind Admin Dashboard (React JSX)
 * - ElegancyArt is FIRST project
 * - Polls BossMind Orchestrator: GET {API_BASE}/health
 * - Your backend mounts health route at "/health"
 */

// Safe env reader (works across CRA + Vite)
function getEnv(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && key in process.env) {
      return process.env[key];
    }
  } catch {}
  return undefined;
}

// ✅ Match your server defaults: process.env.PORT || 5000
const API_BASE =
  getEnv("VITE_BOSSMIND_API_BASE") ||
  getEnv("REACT_APP_BOSSMIND_API_BASE") ||
  "http://localhost:5000";

const POLL_MS = 30_000;

const PROJECTS = [
  {
    key: "elegancyart",
    title: "ElegancyArt Website",
    subtitle: "Hero • Store • Builder integration • Customer-facing",
    badge: "Primary",
  },
  {
    key: "bossmind-orchestrator",
    title: "BossMind Orchestrator",
    subtitle: "Automation engine • Policies • Self-healing control",
    badge: "Core",
  },
  {
    key: "ai-video-generator",
    title: "AI Video Generator",
    subtitle: "Queue • Render • Publish • Multilingual pipeline",
    badge: "Media",
  },
];

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "—";
  }
}

function levelTone(level) {
  if (level === "success") return "good";
  if (level === "warn") return "warn";
  if (level === "error") return "bad";
  return "neutral";
}

function ToneBadge({ tone, children }) {
  const cls =
    tone === "good"
      ? "bm-badge bm-good"
      : tone === "warn"
      ? "bm-badge bm-warn"
      : tone === "bad"
      ? "bm-badge bm-bad"
      : "bm-badge bm-neutral";
  return (
    <span className={cls}>
      <span className="bm-dot" />
      {children}
    </span>
  );
}

function Pill({ children }) {
  return <span className="bm-pill">{children}</span>;
}

function Icon({ name }) {
  const cls = "bm-ico";
  if (name === "pulse") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M4 12h4l2-6 4 12 2-6h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M19.4 15a7.9 7.9 0 0 0 .1-6l2-1.2-2-3.5-2.3.7a8 8 0 0 0-4.9-2.8L12 0 9 2l.2 2.4A8 8 0 0 0 4.3 7l-2.3-.7-2 3.5L2 11a7.9 7.9 0 0 0 .1 6L0 18.2l2 3.5 2.3-.7a8 8 0 0 0 4.9 2.8L12 24l3-2-.2-2.4a8 8 0 0 0 4.9-2.8l2.3.7 2-3.5-2.6-1.7z"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.7"
        />
      </svg>
    );
  }
  if (name === "log") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none">
        <path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      </svg>
    );
  }
  return null;
}

export default function Dashboard() {
  // ✅ ElegancyArt first + default active
  const [activeProject, setActiveProject] = useState("elegancyart");
  const [activeView, setActiveView] = useState("overview"); // overview | activity | controls | settings
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState(null);

  const [activity, setActivity] = useState(() => {
    const now = Date.now();
    const mk = (minsAgo, project, title, level, detail) => ({
      id: crypto.randomUUID(),
      timeISO: new Date(now - minsAgo * 60_000).toISOString(),
      project,
      title,
      level,
      detail,
    });
    return [
      mk(4, "bossmind-orchestrator", "Policy guard loaded", "success", "No-keys preference enforced"),
      mk(11, "ai-video-generator", "Queue watcher idle", "info", "Waiting for new rows"),
      mk(18, "elegancyart", "UI lock verified", "success", "Appearance stability maintained"),
      mk(26, "bossmind-orchestrator", "Health probe scheduled", "info", `Polling every ${POLL_MS / 1000}s`),
    ];
  });

  const timerRef = useRef(null);

  const activeMeta = useMemo(
    () => PROJECTS.find((p) => p.key === activeProject) || PROJECTS[0],
    [activeProject]
  );

  const derived = useMemo(() => {
    const proj = health?.projects?.[activeProject];
    const status = proj?.status || "offline";
    const tone = status === "online" ? "good" : status === "degraded" ? "warn" : "bad";
    const label = status === "online" ? "Online" : status === "degraded" ? "Degraded" : "Offline";

    const all = health?.projects ? Object.values(health.projects).map((x) => x.status) : [];
    const overall =
      all.includes("offline") ? { tone: "bad", text: "Incident" } :
      all.includes("degraded") ? { tone: "warn", text: "Degraded" } :
      all.length ? { tone: "good", text: "Healthy" } :
      { tone: "neutral", text: "No data" };

    return { tone, label, overall };
  }, [health, activeProject]);

  function pushActivity(project, title, level = "info", detail) {
    setActivity((prev) => {
      const next = [
        { id: crypto.randomUUID(), timeISO: new Date().toISOString(), project, title, level, detail },
        ...prev,
      ];
      return next.slice(0, 50);
    });
  }

  async function fetchHealth() {
    setLoading(true);
    setLastError(null);

    try {
      // ✅ Your backend mounts health route at "/health"
      const url = `${API_BASE.replace(/\/+$/, "")}/health`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Health HTTP ${res.status}`);

      const data = await res.json();
      const normalized = normalizeHealth(data);
      setHealth(normalized);

      pushActivity(
        "bossmind-orchestrator",
        normalized.ok ? "Health check OK" : "Health check failed",
        normalized.ok ? "success" : "error",
        normalized.ok ? "Orchestrator responded" : "Orchestrator returned ok=false"
      );
    } catch (e) {
      const msg = e?.message || "Health check error";
      setLastError(msg);
      pushActivity("bossmind-orchestrator", "Health check error", "error", msg);
    } finally {
      setLoading(false);
    }
  }

  function startPolling() {
    stopPolling();
    timerRef.current = setInterval(fetchHealth, POLL_MS);
  }
  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    fetchHealth();
    startPolling();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredActivity = useMemo(() => {
    if (activeView === "activity") return activity.filter((a) => a.project === activeProject).slice(0, 12);
    return activity.slice(0, 8);
  }, [activity, activeView, activeProject]);

  return (
    <div className="bm-root">
      <style>{STYLES}</style>

      <div className="bm-bg">
        <div className="bm-glow bm-glow-top" />
        <div className="bm-glow bm-glow-bottom" />
      </div>

      <div className="bm-wrap">
        <aside className="bm-sidebar">
          <div className="bm-card bm-sidebar-card">
            <div className="bm-head">
              <div>
                <div className="bm-kicker">BossMind</div>
                <div className="bm-title">Admin Dashboard</div>
              </div>
              <ToneBadge tone={derived.overall.tone}>{derived.overall.text}</ToneBadge>
            </div>

            <div className="bm-section">
              <div className="bm-section-title">Projects</div>

              <div className="bm-projects">
                {PROJECTS.map((p) => (
                  <button
                    key={p.key}
                    className={cx("bm-project", p.key === activeProject && "is-active")}
                    onClick={() => {
                      setActiveProject(p.key);
                      setActiveView("overview");
                      pushActivity(p.key, "Switched project", "info", p.title);
                    }}
                  >
                    <div className="bm-project-top">
                      <div className="bm-project-name">{p.title}</div>
                      <Pill>{p.badge}</Pill>
                    </div>
                    <div className="bm-project-sub">{p.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bm-section">
              <div className="bm-section-title">Navigation</div>

              <div className="bm-nav">
                <button className={cx("bm-nav-btn", activeView === "overview" && "is-active")} onClick={() => setActiveView("overview")}>
                  <Icon name="pulse" /> Overview
                </button>
                <button className={cx("bm-nav-btn", activeView === "activity" && "is-active")} onClick={() => setActiveView("activity")}>
                  <Icon name="log" /> Activity
                </button>
                <button className={cx("bm-nav-btn", activeView === "controls" && "is-active")} onClick={() => setActiveView("controls")}>
                  <Icon name="bolt" /> Controls
                </button>
                <button className={cx("bm-nav-btn", activeView === "settings" && "is-active")} onClick={() => setActiveView("settings")}>
                  <Icon name="settings" /> Settings
                </button>
              </div>
            </div>

            <div className="bm-section">
              <div className="bm-section-title">Safety & Stability</div>
              <div className="bm-muted">
                UI is code-locked. Dashboard calls Orchestrator APIs and stays stable.
              </div>
              <div className="bm-grid2">
                <button className="bm-small" onClick={() => pushActivity(activeProject, "Maintenance toggled", "warn", "Control request logged")}>
                  Toggle Maintenance
                </button>
                <button className="bm-small" onClick={() => pushActivity(activeProject, "Automation paused", "warn", "Emergency pause logged")}>
                  Pause Automation
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="bm-main">
          <div className="bm-card bm-topbar">
            <div className="bm-topbar-left">
              <div className="bm-kicker">Active Project</div>
              <div className="bm-row">
                <div className="bm-h1">{activeMeta.title}</div>
                <ToneBadge tone={derived.tone}>{derived.label}</ToneBadge>
              </div>
              <div className="bm-muted">{activeMeta.subtitle}</div>
            </div>

            <div className="bm-topbar-right">
              <button className="bm-action" onClick={() => pushActivity(activeProject, "Quick Diagnose", "info", "UI action logged")}>
                <Icon name="pulse" /> Quick Diagnose
              </button>
              <button className="bm-action" onClick={() => pushActivity(activeProject, "Trigger Job", "success", "Job request logged")}>
                <Icon name="bolt" /> Trigger Job
              </button>
              <button
                className="bm-action"
                onClick={() => {
                  fetchHealth();
                  pushActivity("bossmind-orchestrator", "Manual health refresh", "info", "User requested refresh");
                }}
              >
                <Icon name="log" /> Refresh
              </button>
            </div>

            <div className="bm-meta">
              <Pill>API: {API_BASE}</Pill>
              <Pill>Endpoint: /health</Pill>
              <Pill>Polling: {POLL_MS / 1000}s</Pill>
              <Pill>Last update: {health?.timeISO ? fmtTime(health.timeISO) : loading ? "Loading…" : "—"}</Pill>
              {lastError ? <span className="bm-errorpill">{lastError}</span> : null}
            </div>
          </div>

          {activeView === "overview" && (
            <div className="bm-grid">
              <Kpi title="System Reliability" value={derived.overall.text} hint="Aggregated health probe" icon="pulse" />
              <Kpi
                title="Last Project Check"
                value={health?.projects?.[activeProject]?.lastCheckISO ? fmtTime(health.projects[activeProject].lastCheckISO) : "—"}
                hint={health?.projects?.[activeProject]?.note || "No note"}
                icon="log"
              />
              <Kpi title="Automation State" value="Armed" hint="Guardrails enabled" icon="shield" />
              <Kpi title="UI Lock" value="Stable" hint="No random layout changes" icon="settings" />

              <div className="bm-card bm-panel">
                <div className="bm-panel-head">
                  <div className="bm-panel-title">Recent Activity</div>
                  <button className="bm-small" onClick={() => setActiveView("activity")}>
                    View All
                  </button>
                </div>

                <div className="bm-list">
                  {filteredActivity.map((a) => (
                    <ActivityRow key={a.id} item={a} />
                  ))}
                  {!filteredActivity.length && <div className="bm-muted">No activity.</div>}
                </div>
              </div>

              <div className="bm-card bm-panel">
                <div className="bm-panel-head">
                  <div className="bm-panel-title">Controls (Quick)</div>
                  <div className="bm-muted">Logs only — connect to backend actions when ready.</div>
                </div>

                <div className="bm-grid2">
                  <button className="bm-big" onClick={() => pushActivity(activeProject, "Run: Sync", "info", "Sync requested")}>
                    Run Sync
                  </button>
                  <button className="bm-big" onClick={() => pushActivity(activeProject, "Run: Backup", "success", "Backup requested")}>
                    Backup Now
                  </button>
                  <button className="bm-big" onClick={() => pushActivity(activeProject, "Run: Validate", "info", "Validation requested")}>
                    Validate
                  </button>
                  <button className="bm-big" onClick={() => pushActivity(activeProject, "Run: Publish", "success", "Publish requested")}>
                    Publish
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeView === "activity" && (
            <div className="bm-card bm-panel">
              <div className="bm-panel-head">
                <div>
                  <div className="bm-panel-title">Activity Feed</div>
                  <div className="bm-muted">Filtered to: {activeMeta.title}</div>
                </div>
                <button
                  className="bm-small"
                  onClick={() => {
                    setActivity((prev) => prev.filter((x) => x.project !== activeProject));
                    pushActivity(activeProject, "Activity cleared", "warn", "Only active project cleared");
                  }}
                >
                  Clear Active
                </button>
              </div>

              <div className="bm-list">
                {filteredActivity.map((a) => (
                  <ActivityRow key={a.id} item={a} />
                ))}
                {!filteredActivity.length && <div className="bm-muted">No activity for this project.</div>}
              </div>
            </div>
          )}

          {activeView === "controls" && (
            <div className="bm-card bm-panel">
              <div className="bm-panel-head">
                <div>
                  <div className="bm-panel-title">Controls</div>
                  <div className="bm-muted">UI controls. Wire to Orchestrator endpoints when ready.</div>
                </div>
                <button className="bm-small" onClick={() => { fetchHealth(); pushActivity("bossmind-orchestrator", "Controls: health refresh", "info", "Manual refresh"); }}>
                  Refresh Health
                </button>
              </div>

              <div className="bm-grid2">
                <button className="bm-big" onClick={() => pushActivity(activeProject, "Toggle Maintenance", "warn", "Request logged")}>
                  Toggle Maintenance
                </button>
                <button className="bm-big" onClick={() => pushActivity(activeProject, "Pause Automation", "warn", "Request logged")}>
                  Pause Automation
                </button>
                <button className="bm-big" onClick={() => pushActivity(activeProject, "Resume Automation", "success", "Request logged")}>
                  Resume Automation
                </button>
                <button className="bm-big" onClick={() => pushActivity(activeProject, "Run Diagnostics", "info", "Request logged")}>
                  Run Diagnostics
                </button>
              </div>
            </div>
          )}

          {activeView === "settings" && (
            <div className="bm-card bm-panel">
              <div className="bm-panel-head">
                <div>
                  <div className="bm-panel-title">Settings</div>
                  <div className="bm-muted">UI-only settings (stable).</div>
                </div>
              </div>

              <div className="bm-settings">
                <div className="bm-setting">
                  <div className="bm-setting-title">API Base</div>
                  <div className="bm-muted">Set via environment variable:</div>
                  <div className="bm-code">VITE_BOSSMIND_API_BASE or REACT_APP_BOSSMIND_API_BASE</div>
                  <div className="bm-muted">Current:</div>
                  <div className="bm-code">{API_BASE}</div>
                </div>

                <div className="bm-setting">
                  <div className="bm-setting-title">Polling Interval</div>
                  <div className="bm-code">{POLL_MS} ms</div>
                  <div className="bm-muted">Fixed for stability.</div>
                </div>

                <div className="bm-setting">
                  <div className="bm-setting-title">Connection Test</div>
                  <button
                    className="bm-big"
                    onClick={() => {
                      fetchHealth();
                      pushActivity("bossmind-orchestrator", "Settings: connection test", "info", "Health fetched");
                    }}
                  >
                    Test /health
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bm-foot">BossMind Admin Dashboard • Stable UI • Reactive status</div>
        </main>
      </div>
    </div>
  );
}

/** KPI Card */
function Kpi({ title, value, hint, icon }) {
  return (
    <div className="bm-card bm-kpi">
      <div className="bm-kpi-top">
        <div className="bm-kpi-title">{title}</div>
        <div className="bm-kpi-ico">
          <Icon name={icon} />
        </div>
      </div>
      <div className="bm-kpi-value">{value}</div>
      <div className="bm-muted">{hint}</div>
    </div>
  );
}

/** Activity row */
function ActivityRow({ item }) {
  const tone = levelTone(item.level);
  return (
    <div className="bm-activity">
      <div className="bm-activity-top">
        <div className="bm-activity-title">{item.title}</div>
        <ToneBadge tone={tone}>{String(item.level).toUpperCase()}</ToneBadge>
      </div>
      {item.detail ? <div className="bm-muted">{item.detail}</div> : null}
      <div className="bm-time">{fmtTime(item.timeISO)}</div>
    </div>
  );
}

/**
 * Normalize health response.
 * Your server mounts /health route, but its internal JSON shape may vary.
 * We accept many shapes and convert to a consistent format for the UI.
 */
function normalizeHealth(data) {
  const now = new Date().toISOString();

  // Already in our expected shape
  if (data && typeof data === "object" && data.timeISO && data.projects) return data;

  const timeISO = data?.timeISO || data?.ts || data?.time || data?.timestamp || now;

  const ok = typeof data?.ok === "boolean" ? data.ok : true;

  // Some backends return { status: "running" } or { service: "...", status: "running" }
  const serviceStatus = data?.status || (ok ? "running" : "error");

  // If backend provides no per-project details, we still show stable defaults
  const mk = (status, note) => ({
    status,
    note,
    lastCheckISO: timeISO,
  });

  return {
    ok,
    timeISO,
    env: data?.env || {},
    service: data?.service || "BossMind Orchestrator",
    status: serviceStatus,
    projects: {
      elegancyart: mk("online", "UI layer responding"),
      "bossmind-orchestrator": mk(ok ? "online" : "degraded", "Orchestrator /health responding"),
      "ai-video-generator": mk("degraded", "Wire queue/publish probes next"),
    },
  };
}

const STYLES = `
  :root{
    --bm-bg:#070A12;
    --bm-panel:rgba(255,255,255,0.04);
    --bm-panel2:rgba(255,255,255,0.03);
    --bm-stroke:rgba(255,255,255,0.10);
    --bm-stroke2:rgba(255,255,255,0.14);
    --bm-text:rgba(255,255,255,0.92);
    --bm-muted:rgba(255,255,255,0.62);
    --bm-muted2:rgba(255,255,255,0.45);

    --bm-good:rgba(34,197,94,0.22);
    --bm-good-t:rgba(187,247,208,0.95);
    --bm-good-r:rgba(34,197,94,0.35);

    --bm-warn:rgba(245,158,11,0.22);
    --bm-warn-t:rgba(254,243,199,0.95);
    --bm-warn-r:rgba(245,158,11,0.35);

    --bm-bad:rgba(244,63,94,0.22);
    --bm-bad-t:rgba(255,228,230,0.95);
    --bm-bad-r:rgba(244,63,94,0.35);
  }

  .bm-root{
    min-height:100vh;
    background:var(--bm-bg);
    color:var(--bm-text);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  }

  .bm-bg{ position:fixed; inset:0; pointer-events:none; opacity:0.45; }
  .bm-glow{ position:absolute; width:520px; height:520px; border-radius:999px; filter: blur(48px); background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06), transparent); }
  .bm-glow-top{ top:-200px; left:50%; transform:translateX(-50%); }
  .bm-glow-bottom{ bottom:-260px; right:-160px; }

  .bm-wrap{
    position:relative;
    max-width:1400px;
    margin:0 auto;
    padding:22px 18px;
    display:flex;
    gap:18px;
  }

  .bm-sidebar{ width:330px; flex: 0 0 auto; }
  @media (max-width: 1100px){
    .bm-sidebar{ display:none; }
  }

  .bm-main{ flex:1; min-width:0; }

  .bm-card{
    border:1px solid var(--bm-stroke);
    background:var(--bm-panel);
    border-radius:24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.55);
  }

  .bm-sidebar-card{ padding:18px; }
  .bm-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .bm-kicker{ font-size:12px; letter-spacing:0.08em; color:var(--bm-muted); font-weight:700; text-transform:uppercase; }
  .bm-title{ font-size:22px; font-weight:900; margin-top:4px; }

  .bm-section{ margin-top:16px; }
  .bm-section-title{ font-size:12px; color:var(--bm-muted); font-weight:800; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:10px; }

  .bm-projects{ display:flex; flex-direction:column; gap:10px; }
  .bm-project{
    width:100%;
    text-align:left;
    padding:12px 12px;
    border-radius:18px;
    border:1px solid var(--bm-stroke);
    background:var(--bm-panel2);
    cursor:pointer;
    transition: transform .08s ease, background .12s ease, border-color .12s ease;
  }
  .bm-project:hover{ background: rgba(255,255,255,0.06); }
  .bm-project:active{ transform: translateY(1px); }
  .bm-project.is-active{
    border-color:var(--bm-stroke2);
    background: rgba(255,255,255,0.09);
  }
  .bm-project-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .bm-project-name{ font-size:13px; font-weight:850; }
  .bm-project-sub{ margin-top:6px; font-size:12px; color:var(--bm-muted2); line-height:1.35; }

  .bm-nav{ display:flex; flex-direction:column; gap:8px; }
  .bm-nav-btn{
    display:flex; align-items:center; gap:10px;
    width:100%;
    padding:10px 12px;
    border-radius:16px;
    border:1px solid var(--bm-stroke);
    background: var(--bm-panel2);
    color:var(--bm-text);
    cursor:pointer;
    transition: background .12s ease, border-color .12s ease;
    font-weight:800;
    font-size:13px;
  }
  .bm-nav-btn:hover{ background: rgba(255,255,255,0.06); }
  .bm-nav-btn.is-active{ border-color:var(--bm-stroke2); background: rgba(255,255,255,0.09); }

  .bm-muted{ color:var(--bm-muted); font-size:12px; line-height:1.45; }
  .bm-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }

  .bm-small{
    padding:10px 10px;
    border-radius:14px;
    border:1px solid var(--bm-stroke);
    background: var(--bm-panel2);
    cursor:pointer;
    color:var(--bm-text);
    font-weight:850;
    font-size:12px;
    transition: background .12s ease;
  }
  .bm-small:hover{ background: rgba(255,255,255,0.06); }

  .bm-topbar{ padding:18px; }
  .bm-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .bm-h1{ font-size:22px; font-weight:950; }
  .bm-topbar-left{ min-width:0; }
  .bm-topbar-right{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
  .bm-action{
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 12px;
    border-radius:16px;
    border:1px solid var(--bm-stroke);
    background: var(--bm-panel2);
    cursor:pointer;
    color:var(--bm-text);
    font-weight:900;
    font-size:13px;
    transition: background .12s ease;
  }
  .bm-action:hover{ background: rgba(255,255,255,0.06); }

  .bm-meta{ margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; }
  .bm-pill{
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 10px;
    border-radius:999px;
    border:1px solid var(--bm-stroke);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.78);
    font-size:11px;
    font-weight:800;
  }
  .bm-errorpill{
    display:inline-flex;
    padding:6px 10px;
    border-radius:999px;
    border:1px solid var(--bm-bad-r);
    background: var(--bm-bad);
    color: var(--bm-bad-t);
    font-size:11px;
    font-weight:900;
  }

  .bm-grid{
    margin-top:18px;
    display:grid;
    gap:18px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 900px){
    .bm-grid{ grid-template-columns: 1fr; }
  }

  .bm-kpi{ padding:16px; }
  .bm-kpi-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .bm-kpi-title{ font-size:12px; color:var(--bm-muted); font-weight:900; letter-spacing:0.06em; text-transform:uppercase; }
  .bm-kpi-value{ margin-top:10px; font-size:22px; font-weight:950; }
  .bm-kpi-ico{
    width:42px; height:42px;
    border-radius:16px;
    background: rgba(255,255,255,0.10);
    border:1px solid var(--bm-stroke);
    display:flex; align-items:center; justify-content:center;
  }

  .bm-panel{ padding:16px; grid-column: span 2; }
  @media (max-width: 900px){
    .bm-panel{ grid-column: span 1; }
  }

  .bm-panel-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .bm-panel-title{ font-size:14px; font-weight:950; }

  .bm-list{ display:flex; flex-direction:column; gap:10px; }
  .bm-activity{
    border:1px solid var(--bm-stroke);
    background: var(--bm-panel2);
    border-radius:18px;
    padding:12px;
  }
  .bm-activity-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .bm-activity-title{ font-size:13px; font-weight:950; }
  .bm-time{ margin-top:8px; font-size:11px; color:var(--bm-muted2); }

  .bm-big{
    padding:12px 12px;
    border-radius:18px;
    border:1px solid var(--bm-stroke);
    background: rgba(255,255,255,0.06);
    cursor:pointer;
    color:var(--bm-text);
    font-weight:950;
    font-size:13px;
    transition: background .12s ease;
  }
  .bm-big:hover{ background: rgba(255,255,255,0.09); }

  .bm-badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:6px 10px;
    border-radius:999px;
    font-size:11px;
    font-weight:950;
    border:1px solid var(--bm-stroke);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.80);
    white-space:nowrap;
  }
  .bm-dot{ width:6px; height:6px; border-radius:999px; background: currentColor; opacity:0.85; }

  .bm-good{ background: var(--bm-good); border-color: var(--bm-good-r); color: var(--bm-good-t); }
  .bm-warn{ background: var(--bm-warn); border-color: var(--bm-warn-r); color: var(--bm-warn-t); }
  .bm-bad{ background: var(--bm-bad); border-color: var(--bm-bad-r); color: var(--bm-bad-t); }
  .bm-neutral{ background: rgba(255,255,255,0.08); border-color: var(--bm-stroke); color: rgba(255,255,255,0.85); }

  .bm-ico{ width:18px; height:18px; }

  .bm-settings{ display:grid; gap:12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 900px){ .bm-settings{ grid-template-columns: 1fr; } }
  .bm-setting{
    border:1px solid var(--bm-stroke);
    background: var(--bm-panel2);
    border-radius:18px;
    padding:14px;
  }
  .bm-setting-title{ font-weight:950; font-size:13px; margin-bottom:8px; }
  .bm-code{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New";
    font-size:12px;
    background: rgba(0,0,0,0.35);
    border:1px solid rgba(255,255,255,0.10);
    border-radius:12px;
    padding:10px;
    color: rgba(255,255,255,0.88);
    margin-top:8px;
    word-break: break-all;
  }

  .bm-foot{
    margin-top:16px;
    text-align:center;
    color: rgba(255,255,255,0.42);
    font-size:11px;
    font-weight:700;
    letter-spacing:0.04em;
  }
`;
