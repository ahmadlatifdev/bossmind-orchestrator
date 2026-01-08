// bossmind-sheets-service/server.js
// CommonJS version (Railway-safe)

const express = require("express");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-sheets-service",
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (_req, res) => {
  res.status(200).send("BossMind Sheets Service is running");
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`✅ BossMind Sheets Service listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received. Shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
