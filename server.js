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
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #050505;
      color: #f5f5f5;
    }

    .layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      background: #0b0b0b;
      border-right: 1px solid #252525;
      padding: 22px;
    }

    .brand {
      font-size: 22px;
      font-weight: 700;
      color: #d4af37;
      margin-bottom: 6px;
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
      padding: 14px 14px;
      margin-bottom: 12px;
      cursor: pointer;
      font-size: 15px;
      transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .nav-item:hover {
      border-color: #d4af37;
      background: #171717;
      transform: translateY(-1px);
    }

    .nav-item:active {
      transform: translateY(0);
    }

    .main {
      padding: 24px;
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

    .refresh-btn:hover {
      opacity: 0.92;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-bottom: 24px;
    }

    .card {
      background: #0d0d0d;
      border: 1px solid #262626;
      border-radius: 18px;
      padding: 18px;
    }

    .card h3 {
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

    .section-title {
      font-size: 22px;
      margin: 30px 0 14px;
      color: #ffffff;
    }

    .panel {
      background: #0d0d0d;
      border: 1px solid #262626;
      border-radius: 18px;
      padding: 18px;
      margin-bottom: 22px;
    }

    .panel-title {
      font-size: 18px;
      font-weight: 700;
      color: #d4af37;
      margin-bottom: 12px;
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

    .table-wrap {
      background: #0d0d0d;
      border: 1px solid #262626;
      border-radius: 18px;
      overflow: hidden;
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
      .layout {
        grid-template-columns: 1fr;
      }

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

      <button class="nav-item" onclick="loadDashboard()">Dashboard</button>
      <button class="nav-item" onclick="runBufferTest()">Run Buffer Test</button>
      <button class="nav-item" onclick="showHealth()">Open Health JSON</button>
      <button class="nav-item" onclick="showBuffer()">Open Buffer JSON</button>
      <button class="nav-item" onclick="showSupervisor()">Open Supervisor JSON</button>
    </aside>

    <main class="main">
      <div class="topbar">
        <div class="title">BossMind Admin Master Dashboard</div>
        <button class="refresh-btn" onclick="loadDashboard()">Refresh Now</button>
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

    async function fetchJson(url, title) {
      var res = await fetch(url);
      var data = await res.json();
      setOutput(title, data);
      return data;
    }

    async function loadDashboard() {
      try {
        var master = await fetchJson("/api/master-status", "Dashboard refreshed");
        var supervisor = await fetchJson("/supervisor", "Supervisor loaded");

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

        var rows = "";

        master.projects.forEach(function(project) {
          var badgeClass = project.status === "ACTIVE"
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
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Dashboard load failed";
        document.getElementById("actionOutput").textContent = error.message;
        document.getElementById("footerNote").textContent =
          "Dashboard load failed: " + error.message;
      }
    }

    async function runBufferTest() {
      try {
        await fetchJson("/buffer/test", "Buffer test executed");
        await showBuffer();
        await loadDashboard();
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Buffer test failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showHealth() {
      try {
        await fetchJson("/health", "Health JSON loaded");
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Health load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showBuffer() {
      try {
        await fetchJson("/buffer", "Buffer JSON loaded");
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Buffer load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    async function showSupervisor() {
      try {
        await fetchJson("/supervisor", "Supervisor JSON loaded");
      } catch (error) {
        document.getElementById("actionStatus").textContent = "Supervisor load failed";
        document.getElementById("actionOutput").textContent = error.message;
      }
    }

    loadDashboard();
    setInterval(loadDashboard, 5000);
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});