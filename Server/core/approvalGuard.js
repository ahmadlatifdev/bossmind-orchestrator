"use strict";

const path = require("path");
const http = require("http");
const os = require("os");

/* Load .env safely */
try {
  require("dotenv").config({ path: path.join(process.cwd(), ".env") });
} catch (_) {}

const express = require("express");
const cors = require("cors");
const { resolvePort } = require("./core/portFile.cjs");

const app = express();

/* ---------------- Middleware ---------------- */

app.set("trust proxy", true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

/* ---------------- Routes ---------------- */

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "BossMind",
    time: new Date().toISOString(),
  });
});

app.post("/api/deepseek/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Missing messages[] in body.",
      });
    }

    return res.status(200).json({
      ok: true,
      mode: "fallback",
      reply:
        "BossMind is live. Add a real handler to connect DeepSeek/OpenRouter.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err && err.message ? err.message : err),
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.originalUrl,
  });
});

/* ---------------- Server Boot ---------------- */

async function boot() {
  // Windows dev safe: auto-pick if 5000 is busy
  const PORT = await resolvePort(5000);
  const HOST = process.env.HOST || "0.0.0.0";

  const server = http.createServer(app);

  // Reduce lingering sockets on Windows
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 6000;

  // Track sockets from startup (critical for clean shutdown)
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.listen(PORT, HOST, () => {
    const addr = server.address();
    const actualPort =
      addr && typeof addr === "object" ? addr.port : PORT;

    console.log(
      `BossMind listening on http://${HOST}:${actualPort}`
    );
    console.log(
      `Local: http://127.0.0.1:${actualPort}`
    );
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received → shutting down...`);

    server.close(() => {
      process.exit(0);
    });

    // Force-close remaining sockets
    setTimeout(() => {
      for (const s of sockets) {
        try {
          s.destroy();
        } catch (_) {}
      }
      process.exit(0);
    }, 8000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Windows Ctrl+C support
  if (os.platform() === "win32") {
    try {
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.on("SIGINT", () => shutdown("SIGINT"));
    } catch (_) {}
  }
}

if (require.main === module) {
  boot().catch((err) => {
    console.error("Boot failed:", err);
    process.exit(1);
  });
}

module.exports = { boot };
