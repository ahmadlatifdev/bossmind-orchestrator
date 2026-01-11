/*  BossMind HeroPage / Admin Dashboard — Dashboard.jsx (FULL FILE)
    - Luxury dark UI (Header / Footer / Sidebar)
    - Categories → Subcategories → Products (dynamic if API available, built-in safe fallback)
    - Live wiring panels:
        Queue:   /queue/health , /queue/run
        Worker:  /worker/health
        Jobs:    /jobs (list), /jobs/:id (optional)
    - Admin gate (optional): ADMIN_EMAIL in env OR window config
    - No extra libraries required (React only)
*/

import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   CONFIG (safe in any host)
========================= */
function readEnv(key, fallback = "") {
  // Vite / CRA / Next (client) / plain window injection
  try {
    if (typeof import !== "undefined" && typeof import.meta !== "undefined" && import.meta.env) {
      const v = import.meta.env[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
  } catch (_) {}

  try {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      const v = process.env[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
  } catch (_) {}

  try {
    if (typeof window !== "undefined" && window.__BOSSMIND__ && window.__BOSSMIND__[key]) {
      const v = window.__BOSSMIND__[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
  } catch (_) {}

  return fallback;
}

const CONFIG = {
  // You can set these in your deployment env or inject window.__BOSSMIND__ = { ... }
  QUEUE_BASE_URL: readEnv("VITE_QUEUE_BASE_URL", readEnv("QUEUE_BASE_URL", "")), // ex: https://queue.yourdomain.com
  WORKER_BASE_URL: readEnv("VITE_WORKER_BASE_URL", readEnv("WORKER_BASE_URL", "")), // ex: https://worker.yourdomain.com
  API_BASE_URL: readEnv("VITE_API_BASE_URL", readEnv("API_BASE_URL", "")), // optional unified API (if you have)
  ADMIN_EMAIL: readEnv("VITE_ADMIN_EMAIL", readEnv("ADMIN_EMAIL", "")), // optional gate
  DASH_TITLE: readEnv("VITE_DASH_TITLE", readEnv("DASH_TITLE", "BossMind HeroPage")),
};

/* =========================
   SAFE FETCH HELPERS
========================= */
async function safeFetchJSON(url, options = {}) {
  if (!url) return { ok: false, error: "Missing URL" };
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");
    const data = isJSON ? await res.json() : await res.text();

    if (!res.ok) {
      const err = typeof data === "string" ? data : data?.error || data?.message || `HTTP ${res.status}`;
      return { ok: false, error: String(err) };
    }

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message ? String(e.message) : "Network error" };
  }
}

function joinUrl(base, path) {
  const b = (base || "").trim().replace(/\/+$/, "");
  const p = (path || "").trim();
  if (!b && p.startsWith("/")) return p; // allow relative
  if (!b) return p;
  if (!p) return b;
  return `${b}${p.startsWith("/") ? "" : "/"}${p}`;
}

/* =========================
   DEFAULT CATALOG (fallback)
   - Used ONLY if API not available
========================= */
const FALLBACK_CATALOG = [
  {
    id: "cat_elegancyart",
    name: "ElegancyArt Store",
    icon: "🛍️",
    subcategories: [
      {
        id: "sub_jewelry",
        name: "Jewelry",
        products: [
          { id: "p_ring01", name: "Luxury Ring", price: 49.99, badge: "Top", stock: "In Stock" },
          { id: "p_neck01", name: "Elegant Necklace", price: 59.99, badge: "New", stock: "In Stock" },
          { id: "p_brace01", name: "Gold Bracelet", price: 39.99, badge: "Hot", stock: "Low" },
        ],
      },
      {
        id: "sub_home",
        name: "Home & Living",
        products: [
          { id: "p_lamp01", name: "Ambient Lamp", price: 29.99, badge: "New", stock: "In Stock" },
          { id: "p_blank01", name: "Soft Blanket", price: 24.99, badge: "Top", stock: "In Stock" },
          { id: "p_mug01", name: "Minimal Mug", price: 12.99, badge: "", stock: "In Stock" },
        ],
      },
    ],
  },
  {
    id: "cat_kokidodi",
    name: "Koki & Dodi Videos",
    icon: "🎬",
    subcategories: [
      {
        id: "sub_queue",
        name: "Queue Titles",
        products: [
          { id: "v_title01", name: "Adventure Title #1", price: 0, badge: "READY", stock: "Queued" },
          { id: "v_title02", name: "Adventure Title #2", price: 0, badge: "READY", stock: "Queued" },
        ],
      },
      {
        id: "sub_published",
        name: "Published",
        products: [{ id: "v_pub01", name: "Published Video #1", price: 0, badge: "LIVE", stock: "Public" }],
      },
    ],
  },
  {
    id: "cat_bossmind",
    name: "BossMind Control",
    icon: "🧠",
    subcategories: [
      {
        id: "sub_services",
        name: "Services",
        products: [
          { id: "svc_queue", name: "Queue Service", price: 0, badge: "LIVE", stock: "Online" },
          { id: "svc_worker", name: "Worker Service", price: 0, badge: "READY", stock: "Pending Wire" },
          { id: "svc_hero", name: "HeroPage", price: 0, badge: "PENDING", stock: "Wiring" },
        ],
      },
    ],
  },
];

/* =========================
   UI PRIMITIVES
========================= */
function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Badge({ children, tone = "neutral" }) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
      : tone === "bad"
      ? "bg-rose-500/15 text-rose-200 border-rose-500/25"
      : tone === "info"
      ? "bg-sky-500/15 text-sky-200 border-sky-500/25"
      : "bg-white/5 text-white/80 border-white/10";

  return (
    <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", toneClass)}>
      {children}
    </span>
  );
}

function Pill({ label, value, tone = "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs text-white/60">{label}</div>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold tracking-wide text-white">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}
    </div>
  );
}

function Divider() {
  return <div className="my-4 h-px w-full bg-white/10" />;
}

/* =========================
   ADMIN GATE (optional)
========================= */
function useAdminGate() {
  const adminEmail = (CONFIG.ADMIN_EMAIL || "").trim().toLowerCase();
  const [email, setEmail] = useState(() => {
    try {
      return (localStorage.getItem("bossmind_email") || "").trim();
    } catch (_) {
      return "";
    }
  });

  const normalized = (email || "").trim().toLowerCase();
  const isAdmin = !adminEmail || normalized === adminEmail; // if ADMIN_EMAIL not set => open
  const saveEmail = (v) => {
    setEmail(v);
    try {
      localStorage.setItem("bossmind_email", v);
    } catch (_) {}
  };

  return { isAdmin, email, saveEmail, adminEmail };
}

/* =========================
   MAIN DASHBOARD
========================= */
export default function Dashboard() {
  const { isAdmin, email, saveEmail, adminEmail } = useAdminGate();

  // Catalog
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [catalogSource, setCatalogSource] = useState("fallback"); // "api" | "fallback"
  const [activeCategoryId, setActiveCategoryId] = useState(FALLBACK_CATALOG[0]?.id || "");
  const [activeSubId, setActiveSubId] = useState(FALLBACK_CATALOG[0]?.subcategories?.[0]?.id || "");
  const [search, setSearch] = useState("");

  // Service statuses
  const [queueHealth, setQueueHealth] = useState({ ok: false, state: "Unknown", detail: "" });
  const [workerHealth, setWorkerHealth] = useState({ ok: false, state: "Unknown", detail: "" });

  // Jobs
  const [jobs, setJobs] = useState([]);
  const [jobsState, setJobsState] = useState({ ok: false, detail: "Not loaded" });

  // UI
  const [activeTab, setActiveTab] = useState("catalog"); // catalog | services | jobs | logs
  const [logLines, setLogLines] = useState([]);
  const logsRef = useRef(null);

  const activeCategory = useMemo(
    () => catalog.find((c) => c.id === activeCategoryId) || catalog[0] || null,
    [catalog, activeCategoryId]
  );

  const activeSubcategory = useMemo(() => {
    if (!activeCategory) return null;
    return activeCategory.subcategories.find((s) => s.id === activeSubId) || activeCategory.subcategories[0] || null;
  }, [activeCategory, activeSubId]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = activeSubcategory?.products || [];
    if (!q) return list;
    return list.filter((p) => (p?.name || "").toLowerCase().includes(q) || (p?.badge || "").toLowerCase().includes(q));
  }, [activeSubcategory, search]);

  function pushLog(line) {
    const entry = `[${new Date().toLocaleTimeString()}] ${line}`;
    setLogLines((prev) => {
      const next = [...prev, entry].slice(-300);
      return next;
    });
    // auto scroll
    setTimeout(() => {
      if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }, 0);
  }

  /* =========================
     DATA LOADERS
  ========================= */
  async function loadCatalog() {
    // Preferred: unified API_BASE_URL + /catalog
    // Alternate: relative /api/catalog
    const tryUrls = [
      CONFIG.API_BASE_URL ? joinUrl(CONFIG.API_BASE_URL, "/catalog") : "",
      "/api/catalog",
      "/catalog",
    ].filter(Boolean);

    for (const url of tryUrls) {
      const r = await safeFetchJSON(url);
      if (r.ok && r.data) {
        // expected shape: [{id,name,icon,subcategories:[{id,name,products:[...]}]}]
        if (Array.isArray(r.data) && r.data.length) {
          setCatalog(r.data);
          setCatalogSource("api");
          // keep selection valid
          const firstCat = r.data[0];
          setActiveCategoryId((cur) => (r.data.some((c) => c.id === cur) ? cur : firstCat?.id || ""));
          const firstSub = firstCat?.subcategories?.[0];
          setActiveSubId((cur) => {
            const cat = r.data.find((c) => c.id === (activeCategoryId || firstCat?.id));
            const has = cat?.subcategories?.some((s) => s.id === cur);
            return has ? cur : firstSub?.id || "";
          });
          pushLog(`Catalog loaded from ${url}`);
          return;
        }
      }
    }

    // fallback stays
    setCatalog(FALLBACK_CATALOG);
    setCatalogSource("fallback");
    pushLog("Catalog API not available. Using built-in catalog view.");
  }

  async function loadQueueHealth() {
    const url = CONFIG.QUEUE_BASE_URL ? joinUrl(CONFIG.QUEUE_BASE_URL, "/health") : "/queue/health";
    const r = await safeFetchJSON(url);
    if (r.ok) {
      setQueueHealth({
        ok: true,
        state: "LIVE",
        detail: `OK • ${url}`,
        raw: r.data,
      });
      pushLog("Queue health: LIVE");
    } else {
      setQueueHealth({
        ok: false,
        state: "OFFLINE",
        detail: `${r.error} • ${url}`,
      });
      pushLog(`Queue health: OFFLINE (${r.error})`);
    }
  }

  async function loadWorkerHealth() {
    const url = CONFIG.WORKER_BASE_URL ? joinUrl(CONFIG.WORKER_BASE_URL, "/health") : "/worker/health";
    const r = await safeFetchJSON(url);
    if (r.ok) {
      setWorkerHealth({
        ok: true,
        state: "LIVE",
        detail: `OK • ${url}`,
        raw: r.data,
      });
      pushLog("Worker health: LIVE");
    } else {
      setWorkerHealth({
        ok: false,
        state: "OFFLINE",
        detail: `${r.error} • ${url}`,
      });
      pushLog(`Worker health: OFFLINE (${r.error})`);
    }
  }

  async function runQueueNow() {
    const url = CONFIG.QUEUE_BASE_URL ? joinUrl(CONFIG.QUEUE_BASE_URL, "/queue/run") : "/queue/run";
    pushLog(`Queue run requested → ${url}`);
    const r = await safeFetchJSON(url, { method: "POST", body: JSON.stringify({ source: "HeroPage" }) });
    if (r.ok) {
      pushLog(`Queue run OK • processed: ${r.data?.processed ?? "?"}`);
      // refresh jobs if you have them
      await loadJobs();
    } else {
      pushLog(`Queue run FAILED • ${r.error}`);
    }
  }

  async function loadJobs() {
    // Preferred: unified API
    // Alternate: relative /jobs
    const tryUrls = [
      CONFIG.API_BASE_URL ? joinUrl(CONFIG.API_BASE_URL, "/jobs") : "",
      "/api/jobs",
      "/jobs",
    ].filter(Boolean);

    for (const url of tryUrls) {
      const r = await safeFetchJSON(url);
      if (r.ok) {
        const list = Array.isArray(r.data) ? r.data : r.data?.jobs;
        if (Array.isArray(list)) {
          setJobs(list);
          setJobsState({ ok: true, detail: `Loaded • ${url}` });
          pushLog(`Jobs loaded (${list.length}) from ${url}`);
          return;
        }
      }
    }

    setJobs([]);
    setJobsState({ ok: false, detail: "Jobs API not available yet (Worker/Supabase wiring pending)" });
    pushLog("Jobs API not available yet.");
  }

  /* =========================
     BOOT
  ========================= */
  useEffect(() => {
    loadCatalog();
    loadQueueHealth();
    loadWorkerHealth();
    loadJobs();

    const t = setInterval(() => {
      loadQueueHealth();
      loadWorkerHealth();
    }, 30_000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     UI RENDER
  ========================= */
  const shell = (
    <div className="min-h-screen bg-[#07070A] text-white">
      {/* Top glow */}
      <div className="pointer-events-none fixed left-1/2 top-[-160px] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

      <Header
        title={CONFIG.DASH_TITLE}
        subtitle={catalogSource === "api" ? "Live Catalog" : "Catalog (Fallback Safe Mode)"}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queueHealth={queueHealth}
        workerHealth={workerHealth}
      />

      <div className="mx-auto max-w-[1400px] px-4 pb-14 pt-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <Sidebar
            catalog={catalog}
            activeCategoryId={activeCategoryId}
            setActiveCategoryId={(id) => {
              setActiveCategoryId(id);
              const cat = catalog.find((c) => c.id === id);
              const firstSub = cat?.subcategories?.[0]?.id || "";
              setActiveSubId(firstSub);
              setSearch("");
            }}
            activeSubId={activeSubId}
            setActiveSubId={(id) => {
              setActiveSubId(id);
              setSearch("");
            }}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <main className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            {activeTab === "catalog" ? (
              <CatalogPanel
                activeCategory={activeCategory}
                activeSubcategory={activeSubcategory}
                search={search}
                setSearch={setSearch}
                products={filteredProducts}
              />
            ) : activeTab === "services" ? (
              <ServicesPanel
                queueHealth={queueHealth}
                workerHealth={workerHealth}
                reloadQueue={loadQueueHealth}
                reloadWorker={loadWorkerHealth}
                runQueueNow={runQueueNow}
              />
            ) : activeTab === "jobs" ? (
              <JobsPanel
                jobs={jobs}
                jobsState={jobsState}
                reloadJobs={loadJobs}
              />
            ) : (
              <LogsPanel logLines={logLines} logsRef={logsRef} onClear={() => setLogLines([])} />
            )}
          </main>
        </div>
      </div>

      <Footer />
      <Style />
    </div>
  );

  if (isAdmin) return shell;

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <Style />
      <div className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center px-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-semibold">Admin Access</div>
          <div className="mt-2 text-sm text-white/60">
            This HeroPage is protected. Enter your admin email to continue.
          </div>

          <Divider />

          <div className="text-xs text-white/60">Admin email required</div>
          <div className="mt-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white">
            {adminEmail || "(Not set — set ADMIN_EMAIL to enable gate)"}
          </div>

          <div className="mt-5">
            <div className="text-xs text-white/60">Your email</div>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
              value={email}
              onChange={(e) => saveEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="mt-5 text-sm text-white/60">
            If you set <span className="text-white/90">ADMIN_EMAIL</span> to your email, access becomes automatic.
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   PANELS
========================= */
function CatalogPanel({ activeCategory, activeSubcategory, search, setSearch, products }) {
  return (
    <div>
      <SectionTitle
        title={`${activeCategory?.icon || "🧩"} ${activeCategory?.name || "Catalog"}`}
        subtitle={`${activeSubcategory?.name || "Subcategory"} • Products`}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <div className="text-xs text-white/60">Search products</div>
          <input
            className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search…"
          />
        </div>

        <div className="flex items-end justify-end">
          <Badge tone="info">{products.length} items</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>

      {!products.length ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-white/60">
          No products in this subcategory.
        </div>
      ) : null}
    </div>
  );
}

function ServicesPanel({ queueHealth, workerHealth, reloadQueue, reloadWorker, runQueueNow }) {
  const queueTone = queueHealth.ok ? "good" : "bad";
  const workerTone = workerHealth.ok ? "good" : "bad";

  return (
    <div>
      <SectionTitle
        title="🧠 Services Wiring"
        subtitle="Live status + instant actions (Queue → Worker → HeroPage)"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Queue Service</div>
            <Badge tone={queueTone}>{queueHealth.state}</Badge>
          </div>
          <div className="mt-2 text-sm text-white/60">{queueHealth.detail || "—"}</div>

          <Divider />

          <div className="grid grid-cols-1 gap-3">
            <Pill label="Health" value={queueHealth.ok ? "OK" : "ERROR"} tone={queueTone} />
            <button
              onClick={reloadQueue}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-white/20 hover:bg-white/10"
            >
              Refresh Queue Health
            </button>
            <button
              onClick={runQueueNow}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm hover:bg-emerald-500/15"
            >
              Run Queue Now (POST /queue/run)
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">Worker Service</div>
            <Badge tone={workerTone}>{workerHealth.state}</Badge>
          </div>
          <div className="mt-2 text-sm text-white/60">{workerHealth.detail || "—"}</div>

          <Divider />

          <div className="grid grid-cols-1 gap-3">
            <Pill label="Health" value={workerHealth.ok ? "OK" : "ERROR"} tone={workerTone} />
            <button
              onClick={reloadWorker}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-white/20 hover:bg-white/10"
            >
              Refresh Worker Health
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              If Worker is OFFLINE, deploy/start it first. If it is LIVE, Queue will dispatch jobs to it.
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <div className="text-base font-semibold">Wiring Checklist</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Pill label="Queue" value={queueHealth.ok ? "LIVE" : "OFFLINE"} tone={queueHealth.ok ? "good" : "bad"} />
          <Pill label="Worker" value={workerHealth.ok ? "LIVE" : "OFFLINE"} tone={workerHealth.ok ? "good" : "bad"} />
          <Pill label="HeroPage" value="LIVE UI" tone="info" />
        </div>

        <div className="mt-4 text-sm text-white/60">
          Next objective: make Jobs visible (Worker/Supabase → Jobs API). Then HeroPage becomes full reactive.
        </div>
      </div>
    </div>
  );
}

function JobsPanel({ jobs, jobsState, reloadJobs }) {
  const tone = jobsState.ok ? "good" : "warn";
  return (
    <div>
      <SectionTitle title="📦 Jobs Stream" subtitle="Live jobs list (requires Jobs API wiring)" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Badge tone={tone}>{jobsState.detail}</Badge>
        <button
          onClick={reloadJobs}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-white/20 hover:bg-white/10"
        >
          Refresh Jobs
        </button>
      </div>

      {jobs && jobs.length ? (
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="w-full border-collapse">
            <thead className="bg-white/5">
              <tr className="text-left text-xs text-white/70">
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 200).map((j, idx) => {
                const status = String(j.status || j.state || "UNKNOWN");
                const project = String(j.project || "default");
                const id = String(j.jobId || j.id || `job_${idx}`);
                const updated = String(j.updatedAt || j.updated_at || j.createdAt || j.created_at || "");
                const tone =
                  /COMPLETED|DONE|SUCCESS/i.test(status)
                    ? "good"
                    : /FAILED|ERROR/i.test(status)
                    ? "bad"
                    : /PROCESSING|RUNNING/i.test(status)
                    ? "info"
                    : "warn";

                return (
                  <tr key={id} className="border-t border-white/10 bg-black/20 text-sm">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{id}</div>
                      <div className="mt-1 text-xs text-white/60">{j.title || j.name || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{project}</td>
                    <td className="px-4 py-3">
                      <Badge tone={tone}>{status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-white/60">{updated || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-white/60">
          No jobs to display yet. Once your Worker writes jobs to Supabase (or exposes /jobs), they will appear here.
        </div>
      )}
    </div>
  );
}

function LogsPanel({ logLines, logsRef, onClear }) {
  return (
    <div>
      <SectionTitle title="🧾 Activity Log" subtitle="Local UI logs (useful for debugging without server console)" />

      <div className="mb-4 flex items-center justify-between">
        <Badge tone="neutral">{logLines.length} lines</Badge>
        <button
          onClick={onClear}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-white/20 hover:bg-white/10"
        >
          Clear Logs
        </button>
      </div>

      <div
        ref={logsRef}
        className="h-[520px] overflow-auto rounded-3xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/80"
      >
        {logLines.length ? (
          logLines.map((l, i) => (
            <div key={`${i}_${l}`} className="whitespace-pre-wrap">
              {l}
            </div>
          ))
        ) : (
          <div className="text-white/50">No logs yet.</div>
        )}
      </div>
    </div>
  );
}

/* =========================
   HEADER / SIDEBAR / FOOTER
========================= */
function Header({ title, subtitle, activeTab, setActiveTab, queueHealth, workerHealth }) {
  const qTone = queueHealth.ok ? "good" : "bad";
  const wTone = workerHealth.ok ? "good" : "bad";

  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-[#07070A]/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg">
            🧠
          </div>
          <div>
            <div className="text-base font-semibold tracking-wide text-white">{title}</div>
            <div className="text-xs text-white/60">{subtitle}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={qTone}>Queue: {queueHealth.state}</Badge>
          <Badge tone={wTone}>Worker: {workerHealth.state}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TabButton label="Catalog" active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")} />
          <TabButton label="Services" active={activeTab === "services"} onClick={() => setActiveTab("services")} />
          <TabButton label="Jobs" active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} />
          <TabButton label="Logs" active={activeTab === "logs"} onClick={() => setActiveTab("logs")} />
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-2xl border px-4 py-2 text-sm transition",
        active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}

function Sidebar({ catalog, activeCategoryId, setActiveCategoryId, activeSubId, setActiveSubId, activeTab, setActiveTab }) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <SectionTitle title="📚 Navigation" subtitle="Categories & tools" />

      <div className="grid grid-cols-2 gap-2">
        <QuickButton label="Catalog" active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")} />
        <QuickButton label="Services" active={activeTab === "services"} onClick={() => setActiveTab("services")} />
        <QuickButton label="Jobs" active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} />
        <QuickButton label="Logs" active={activeTab === "logs"} onClick={() => setActiveTab("logs")} />
      </div>

      <Divider />

      <div className="text-xs text-white/60">Categories</div>
      <div className="mt-3 space-y-2">
        {catalog.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategoryId(c.id)}
            className={clsx(
              "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
              c.id === activeCategoryId
                ? "border-white/20 bg-white/10"
                : "border-white/10 bg-black/20 hover:border-white/15 hover:bg-white/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">
                {c.icon ? <span className="mr-2">{c.icon}</span> : null}
                {c.name}
              </div>
              <span className="text-xs text-white/50">{c.subcategories?.length || 0}</span>
            </div>
          </button>
        ))}
      </div>

      <Divider />

      <div className="text-xs text-white/60">Subcategories</div>
      <div className="mt-3 space-y-2">
        {(catalog.find((c) => c.id === activeCategoryId)?.subcategories || []).map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSubId(s.id)}
            className={clsx(
              "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
              s.id === activeSubId
                ? "border-white/20 bg-white/10"
                : "border-white/10 bg-black/20 hover:border-white/15 hover:bg-white/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">{s.name}</div>
              <span className="text-xs text-white/50">{s.products?.length || 0}</span>
            </div>
          </button>
        ))}
      </div>

      <Divider />

      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/60">
        <div className="font-semibold text-white/80">Wiring URLs</div>
        <div className="mt-2 space-y-1">
          <div>QUEUE_BASE_URL: <span className="text-white/80">{CONFIG.QUEUE_BASE_URL || "(relative /queue/*)"}</span></div>
          <div>WORKER_BASE_URL: <span className="text-white/80">{CONFIG.WORKER_BASE_URL || "(relative /worker/*)"}</span></div>
          <div>API_BASE_URL: <span className="text-white/80">{CONFIG.API_BASE_URL || "(relative /api/*)"}</span></div>
        </div>
      </div>
    </aside>
  );
}

function QuickButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-2xl border px-4 py-3 text-sm transition",
        active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/80 hover:bg-white/5"
      )}
    >
      {label}
    </button>
  );
}

function ProductCard({ p }) {
  const price =
    typeof p.price === "number"
      ? p.price === 0
        ? "—"
        : `$${p.price.toFixed(2)}`
      : p.price
      ? String(p.price)
      : "—";

  const badge = String(p.badge || "").trim();
  const stock = String(p.stock || "").trim();

  const tone =
    /LIVE|COMPLETED|OK|TOP/i.test(badge)
      ? "good"
      : /READY|NEW|HOT|PROCESSING/i.test(badge)
      ? "info"
      : /FAILED|ERROR/i.test(badge)
      ? "bad"
      : badge
      ? "warn"
      : "neutral";

  return (
    <div className="group rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:border-white/15 hover:bg-black/25">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{p.name}</div>
          <div className="mt-1 text-sm text-white/60">{stock || "—"}</div>
        </div>
        {badge ? <Badge tone={tone}>{badge}</Badge> : <Badge tone="neutral">—</Badge>}
      </div>

      <Divider />

      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Price</div>
        <div className="text-sm font-semibold text-white">{price}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10">
          View
        </button>
        <button className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10">
          Actions
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t border-white/10 bg-black/30">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-white/60">
        <div>© {new Date().getFullYear()} BossMind • HeroPage</div>
        <div className="text-white/50">Queue → Worker → HeroPage • Luxury Dark • Safe Mode Ready</div>
      </div>
    </div>
  );
}

/* =========================
   STYLE (Tailwind-like classes without dependency)
   - If you already use Tailwind, this is harmless.
   - If not, these utilities still render via normal CSS below.
========================= */
function Style() {
  return (
    <style>{`
      /* Minimal utility helpers for environments without Tailwind */
      .bg-\\[\\#07070A\\]{background:#07070A;}
      .text-white{color:#fff;}
      .text-white\\/80{color:rgba(255,255,255,.8);}
      .text-white\\/70{color:rgba(255,255,255,.7);}
      .text-white\\/60{color:rgba(255,255,255,.6);}
      .text-white\\/50{color:rgba(255,255,255,.5);}
      .text-white\\/30{color:rgba(255,255,255,.3);}
      .bg-white\\/5{background:rgba(255,255,255,.05);}
      .bg-white\\/10{background:rgba(255,255,255,.10);}
      .bg-black\\/20{background:rgba(0,0,0,.20);}
      .bg-black\\/25{background:rgba(0,0,0,.25);}
      .bg-black\\/30{background:rgba(0,0,0,.30);}
      .border-white\\/10{border-color:rgba(255,255,255,.10);}
      .border-white\\/15{border-color:rgba(255,255,255,.15);}
      .border-white\\/20{border-color:rgba(255,255,255,.20);}
      .border-emerald-400\\/30{border-color:rgba(52,211,153,.30);}
      .bg-emerald-500\\/10{background:rgba(16,185,129,.10);}
      .bg-emerald-500\\/15{background:rgba(16,185,129,.15);}
      .bg-sky-500\\/15{background:rgba(14,165,233,.15);}
      .bg-amber-500\\/15{background:rgba(245,158,11,.15);}
      .bg-rose-500\\/15{background:rgba(244,63,94,.15);}
      .text-emerald-200{color:rgb(167,243,208);}
      .text-sky-200{color:rgb(186,230,253);}
      .text-amber-200{color:rgb(253,230,138);}
      .text-rose-200{color:rgb(254,205,211);}
      .border-emerald-500\\/25{border-color:rgba(16,185,129,.25);}
      .border-sky-500\\/25{border-color:rgba(14,165,233,.25);}
      .border-amber-500\\/25{border-color:rgba(245,158,11,.25);}
      .border-rose-500\\/25{border-color:rgba(244,63,94,.25);}
      .border{border-width:1px;border-style:solid;}
      .rounded-2xl{border-radius:1rem;}
      .rounded-3xl{border-radius:1.5rem;}
      .rounded-full{border-radius:9999px;}
      .p-4{padding:1rem;}
      .p-5{padding:1.25rem;}
      .p-6{padding:1.5rem;}
      .px-4{padding-left:1rem;padding-right:1rem;}
      .px-6{padding-left:1.5rem;padding-right:1.5rem;}
      .py-2{padding-top:.5rem;padding-bottom:.5rem;}
      .py-3{padding-top:.75rem;padding-bottom:.75rem;}
      .py-4{padding-top:1rem;padding-bottom:1rem;}
      .py-6{padding-top:1.5rem;padding-bottom:1.5rem;}
      .pb-14{padding-bottom:3.5rem;}
      .pt-6{padding-top:1.5rem;}
      .mt-1{margin-top:.25rem;}
      .mt-2{margin-top:.5rem;}
      .mt-3{margin-top:.75rem;}
      .mt-4{margin-top:1rem;}
      .mt-5{margin-top:1.25rem;}
      .mt-8{margin-top:2rem;}
      .mb-4{margin-bottom:1rem;}
      .my-4{margin-top:1rem;margin-bottom:1rem;}
      .mx-auto{margin-left:auto;margin-right:auto;}
      .min-h-screen{min-height:100vh;}
      .w-full{width:100%;}
      .h-11{height:2.75rem;}
      .w-11{width:2.75rem;}
      .h-\\[520px\\]{height:520px;}
      .max-w-\\[720px\\]{max-width:720px;}
      .max-w-\\[1400px\\]{max-width:1400px;}
      .grid{display:grid;}
      .grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr));}
      .gap-2{gap:.5rem;}
      .gap-3{gap:.75rem;}
      .gap-4{gap:1rem;}
      .gap-6{gap:1.5rem;}
      .flex{display:flex;}
      .flex-col{flex-direction:column;}
      .flex-wrap{flex-wrap:wrap;}
      .items-center{align-items:center;}
      .items-start{align-items:flex-start;}
      .items-end{align-items:flex-end;}
      .justify-between{justify-content:space-between;}
      .justify-end{justify-content:flex-end;}
      .justify-center{justify-content:center;}
      .text-left{text-align:left;}
      .text-xs{font-size:.75rem;line-height:1rem;}
      .text-sm{font-size:.875rem;line-height:1.25rem;}
      .text-base{font-size:1rem;line-height:1.5rem;}
      .text-lg{font-size:1.125rem;line-height:1.75rem;}
      .text-2xl{font-size:1.5rem;line-height:2rem;}
      .font-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}
      .font-medium{font-weight:500;}
      .font-semibold{font-weight:600;}
      .tracking-wide{letter-spacing:.025em;}
      .overflow-auto{overflow:auto;}
      .overflow-hidden{overflow:hidden;}
      .outline-none{outline:none;}
      .transition{transition:all .15s ease;}
      .hover\\:bg-white\\/10:hover{background:rgba(255,255,255,.10);}
      .hover\\:bg-white\\/5:hover{background:rgba(255,255,255,.05);}
      .hover\\:border-white\\/20:hover{border-color:rgba(255,255,255,.20);}
      .hover\\:border-white\\/15:hover{border-color:rgba(255,255,255,.15);}
      .backdrop-blur{backdrop-filter:blur(10px);}
      .sticky{position:sticky;}
      .top-0{top:0;}
      .z-20{z-index:20;}
      .fixed{position:fixed;}
      .pointer-events-none{pointer-events:none;}
      .left-1\\/2{left:50%;}
      .top-\\[-160px\\]{top:-160px;}
      .-translate-x-1\\/2{transform:translateX(-50%);}
      .blur-3xl{filter:blur(64px);}
      .shadow-\\[0_0_0_1px_rgba\\(255\\,255\\,255\\,0\\.03\\)\\]{box-shadow:0 0 0 1px rgba(255,255,255,0.03);}
      .whitespace-pre-wrap{white-space:pre-wrap;}
      @media (min-width:1024px){
        .lg\\:grid-cols-\\[320px_1fr\\]{grid-template-columns:320px 1fr;}
        .lg\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (min-width:768px){
        .md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr));}
        .md\\:grid-cols-\\[1fr_auto\\]{grid-template-columns:1fr auto;}
        .md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr));}
      }
      @media (min-width:1280px){
        .xl\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr));}
      }
      button{cursor:pointer;}
      table{width:100%;}
      th,td{vertical-align:top;}
    `}</style>
  );
}
