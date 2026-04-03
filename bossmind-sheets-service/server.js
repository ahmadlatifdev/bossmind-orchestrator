'use strict';

const express = require("express");

let supervisor;

try {
  supervisor = require("../core/supervisor_loader.js");
} catch (e) {
  console.log("Supervisor load error:", e.message);
}

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "BossMind ACTIVE",
  });
});

app.get("/test-supervisor", async (req, res) => {
  try {
    if (!supervisor) {
      return res.json({
        supervisor: "ERROR",
        message: "Supervisor not loaded",
      });
    }

    return res.json({
      supervisor: "OK",
      message: "Supervisor connected",
    });
  } catch (err) {
    return res.json({
      supervisor: "ERROR",
      message: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});'use strict';

const express = require("express");

let supervisor;

try {
  supervisor = require("../core/supervisor_loader.js");
} catch (e) {
  console.log("Supervisor load error:", e.message);
}

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "BossMind ACTIVE",
  });
});

app.get("/test-supervisor", async (req, res) => {
  try {
    if (!supervisor) {
      return res.json({
        supervisor: "ERROR",
        message: "Supervisor not loaded",
      });
    }

    return res.json({
      supervisor: "OK",
      message: "Supervisor connected",
    });
  } catch (err) {
    return res.json({
      supervisor: "ERROR",
      message: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});