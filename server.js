require("./core/supervisor_loader.js");
const buffer = require("./core/buffer");

const express = require("express");
const app = express();

const PORT = Number(process.env.PORT) || 3010;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getProjectStatuses() {
  return [
    {
      key: "bossmind-master-admin",
      name: "BossMind Master Admin",
      status: "ACTIVE",
      host: "Local Core",
      role: "Master control dashboard",
    },
    {
      key: "bossmind-resumora",
      name: "Resumora",
      status: "PENDING",
      host: "Not connected yet",
      role: "Resume platform",
    },
    {
      key: "bossmind-elegancyart",
      name: "ElegancyArt",
      status: "PENDING",
      host: "Not connected yet",
      role: "E-commerce automation",
    },
    {
      key: "bossmind-ai-video-generator",
      name: "AI Video Generator",
      status: "PENDING",
      host: "Not connected yet",
      role: "Long-form video automation",
    },
    {
      key: "bossmind-tiktok-ai",
      name: "TikTok AI",
      status: "PENDING",
      host: "Not connected yet",
      role: "Short-form video automation",
    },
    {
      key: "bossmind-global-stock",
      name: "Global Stock",
      status: "PENDING",
      host: "Not connected yet",
      role: "Stock automation",
    },
  ];
}

app.get("/", (req, res) => {
  res.status(200).json({
    status: "BossMind ACTIVE",
    service: "Supervisor + Buffer + Admin Dashboard",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-core",
    port: PORT,
    time: new Date().toISOString(),
  });
});

app.get("/supervisor", (req, res) => {
  res.status(200).json({
    ok: true,
    supervisor: "ACTIVE",
    strategy: "BossMind Autonomous Supervisor",
    time: new Date().toISOString(),
  });
});

app.get("/buffer", (req, res) => {
  res.status(200).json({
    ok: true,
    queue: buffer.getQueue(),
    count: buffer.getQueue().length,
    time: new Date().toISOString(),
  });
});

app.get("/buffer/test", async (req, res) => {
  buffer.addTask(async () => {
    console.log("Buffer task executed at " + new Date().toISOString());
  });

  res.status(200).json({
    ok: true,
    message: "Test task added to buffer",
    count: buffer.getQueue().length,
    time: new Date().toISOString(),
  });
});

app.get("/api/projects", (req, res) => {
  res.status(200).json({
    ok: true,
    projects: getProjectStatuses(),
  });
});

app.get("/api/master-status", (req, res) => {
  res.status(200).json({
    ok: true,
    core: {
      status: "ACTIVE",
      service: "bossmind-core",
      supervisor: "ACTIVE",
      bufferQueueCount: buffer.getQueue().length,
      port: PORT,
      updatedAt: new Date().toISOString(),
    },
    projects: getProjectStatuses(),
  });
});

app.get("/admin", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BossMind Master Admin</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #050505;
      color: #f5f5f5;
    }
    .layout {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: 100vh;
    }
    .sidebar {
      background: #0b0b0b;
      border-right: 1px solid #252525;
      padding: 18px;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: #d4af37;
      margin-bottom: 4px;
    }
    .subbrand {
      font-size: 13px;
      color: #d0d0d0;
      margin-bottom: 24px;
    }
    .nav-item {
      display: block;
      width: 100%;
      text-align: left;
      background: #111111;
      color: #ffffff;
      border: 1px solid #2b2b2b;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
      cursor: pointer;
      font-size: 15px;
    }
    .nav-item:hover {
      border-color: #d4af37;
      background: #171717;
    }
    .main {
      padding: 22px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 22px;
      flex-wrap: wrap;
    }
    .title {
      font-size: 26px;
      font-weight: 700;
      color: #d4af37;
    }
    .refresh-btn {
      background: #d4af37;
      color: #111111;
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-bottom: 24px;
    }
    .card, .panel, .table-wrap {
      background: #0d0d0d;
      border: 1px solid #262626;
      border-radius: 18px;
    }
    .card {
      padding: 18px;
    }
    .card h3, .panel-title {
      margin: 0 0 12px 0;
      color: #d4af37;
      font-size: 18px;
    }
    .stat {
      font-size: 15px;
      margin: 8px 0;
      color: #f0f0f0;
    }
    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-top: 8px;
    }
    .badge-active {
      background: rgba(0, 128, 0, 0.18);
      color: #7CFC00;
      border: 1px solid rgba(124, 252, 0, 0.35);
    }
    .badge-pending {
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
      border: 1px solid rgba(212, 175, 55, 0.35);
    }
    .panel {
      padding: 18px;
      margin-bottom: 22px;
    }
    .panel-status {
      font-size: 14px;
      color: #d6d6d6;
      margin-bottom: 10px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: #f5f5f5;
      font-size: 14px;
      line-height: 1.5;
      background: #090909;
      border: 1px solid #202020;
      border-radius: 14px;
      padding: 16px;
      min-height: 140px;
    }
    .section-title {
      font-size: 22px;
      margin: 30px 0 14px;
      color: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 14px 16px;
      border-bottom: 1px solid #202020;
      text-align: left;
      font-size: 14px;
    }
    th {
      background: #0a0a0a;
      color: #d4af37;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .footer-note {
      margin-top: 16px;
      color: #aaaaaa;
      font-size: 13px;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar {
        border-right: none;
        border-bottom: 1px solid #252525;
      }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">BossMind</div>
      <div class="subbrand">Master Admin Dashboard</div>

      <button id="btn-dashboard" class="nav-item" type="button">Dashboard</button>
      <button id="btn-buffer-test" class="nav-item" type="button">Run Buffer Test</button>
      <button id="btn-health" class="nav-item" type="button">Open Health JSON</button>
      <button id="btn-buffer" class="nav-item" type="button">Open Buffer JSON</button>
      <button id="btn-supervisor" class="nav-item" type="button">Open Supervisor JSON</button>
    </aside>

    <main class="main">
      <div class="topbar">
        <div class="title">BossMind Admin Master Dashboard</div>
        <button id="btn-refresh" class="refresh-btn" type="button">Refresh Now</button>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Core Service</h3>
          <div class="stat" id="coreService">Loading...</div>
          <div class="stat" id="corePort">Loading...</div>
          <div class="stat" id="coreUpdated">Loading...</div>
        </div>

        <div class="card">
          <h3>Supervisor</h3>
          <div class="stat" id="supervisorStatus">Loading...</div>
          <div class="stat" id="supervisorStrategy">Loading...</div>
          <span class="badge badge-active">ACTIVE</span>
        </div>

        <div class="card">
          <h3>Buffer Queue</h3>
          <div class="stat" id="bufferCount">Loading...</div>
          <div class="stat">Mode: In-memory queue</div>
          <span class="badge badge-active">LIVE</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Live Action Panel</div>
        <div class="panel-status" id="actionStatus">Ready.</div>
        <pre id="actionOutput">Click any left button. Output will appear here instantly.</pre>
      </div>

      <div class="section-title">Projects</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Host</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody id="projectsTable">
            <tr>
              <td colspan="4">Loading...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer-note" id="footerNote">Loading latest status...</div>
    </main>
  </div>

  <script>
    function setOutput(title, data) {
      document.getElementById("actionStatus").textContent = title;
      document.getElementById("actionOutput").textContent = JSON.stringify(data, null, 2);
    }

    async function getJson(url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Request failed: " + url + " (" + res.status + ")");
      }
      return await res.json();
    }

    async function loadDashboard() {
      try {
        const master = await getJson("/api/master-status");
        const supervisor = await getJson("/supervisor");

        document.getElementById("coreService").textContent =
          "Service: " + master.core.service + " (" + master.core.status + ")";
        document.getElementById("corePort").textContent =
          "Port: " + master.core.port;
        document.getElementById("coreUpdated").textContent =
          "Updated: " + master.core.updatedAt;

        document.getElementById("supervisorStatus").textContent =
          "Supervisor: " + supervisor.supervisor;
        document.getElementById("supervisorStrategy").textContent =
          "Strategy: " + supervisor.strategy;

        document.getElementById("bufferCount").textContent =
          "Queue Count: " + master.core.bufferQueueCount;

        let rows = "";
        master.projects.forEach(function(project) {
          const badgeClass = project.status === "ACTIVE"
            ? "badge badge-active"
            : "badge badge-pending";

          rows +=
            "<tr>" +
              "<td>" + project.name + "</td>" +
              "<td><span class='" + badgeClass + "'>" + project.status + "</span></td>" +
              "<td>" + project.host + "</td>" +
              "<td>" + project.role + "</td>" +
            "</tr>";
        });

        document.getElementById("projectsTable").innerHTML = rows;
        document.getElementById("footerNote").textContent =
          "BossMind dashboard refreshed successfully at " + new Date().toLocaleString();
        setOutput("Dashboard refreshed", master);
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Dashboard load failed";
        document.getElementById("actionOutput").textContent = error.message;
        document.getElementById("footerNote").textContent =
          "Dashboard load failed: " + error.message;
      }
    }

    async function runBufferTest() {
      try {
        const result = await getJson("/buffer/test");
        setOutput("Buffer test executed", result);

        const bufferData = await getJson("/buffer");
        document.getElementById("bufferCount").textContent =
          "Queue Count: " + bufferData.count;

        document.getElementById("actionStatus").textContent = "Buffer JSON loaded";
        document.getElementById("actionOutput").textContent =
          JSON.stringify(bufferData, null, 2);

        await loadDashboard();
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Buffer test failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showHealth() {
      try {
        const data = await getJson("/health");
        setOutput("Health JSON loaded", data);
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Health load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showBuffer() {
      try {
        const data = await getJson("/buffer");
        setOutput("Buffer JSON loaded", data);
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Buffer load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showSupervisor() {
      try {
        const data = await getJson("/supervisor");
        setOutput("Supervisor JSON loaded", data);
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Supervisor load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    document.addEventListener("DOMContentLoaded", function() {
      document.getElementById("btn-dashboard").addEventListener("click", loadDashboard);
      document.getElementById("btn-buffer-test").addEventListener("click", runBufferTest);
      document.getElementById("btn-health").addEventListener("click", showHealth);
      document.getElementById("btn-buffer").addEventListener("click", showBuffer);
      document.getElementById("btn-supervisor").addEventListener("click", showSupervisor);
      document.getElementById("btn-refresh").addEventListener("click", loadDashboard);

      loadDashboard();
      setInterval(loadDashboard, 15000);
    });
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});