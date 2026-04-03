'use strict';

const express = require("express");

let supervisor = null;

try {
  supervisor = require("./core/supervisor_loader");
} catch (e) {
  console.log("Supervisor load error:", e.message);
}

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    status: "BossMind ACTIVE",
    service: "bossmind-orchestrator",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bossmind-orchestrator",
    supervisorLoaded: !!supervisor,
  });
});

app.get("/test-supervisor", async (req, res) => {
  try {
    if (!supervisor) {
      return res.status(200).json({
        supervisor: "ERROR",
        message: "Supervisor not loaded",
      });
    }

    return res.status(200).json({
      supervisor: "OK",
      message: "Supervisor connected",
      loaded: true,
    });
  } catch (err) {
    return res.status(200).json({
      supervisor: "ERROR",
      message: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});