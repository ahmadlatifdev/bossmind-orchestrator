// Server/server.cjs
"use strict";

const express = require("express");
const path = require("path");

const app = express();

/* ===============================
   GLOBAL MIDDLEWARE
=============================== */
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ===============================
   HEALTH CHECK (Railway)
=============================== */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "BossMind Orchestrator",
    uptime: process.uptime()
  });
});

/* ===============================
   ROUTES (SAFE LOAD)
=============================== */
try {
  require("../routes")(app);
} catch (e) {
  console.warn("[BossMind] Routes not loaded:", e.message);
}

/* ===============================
   RAILWAY-CONTROLLED SERVER START
   (BossMind auto-start DISABLED)
=============================== */
if (!global.__BOSSMIND_SERVER_STARTED__) {
  global.__BOSSMIND_SERVER_STARTED__ = true;

  const PORT = Number(process.env.PORT || 3000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BossMind] Listening on ${PORT}`);
  });
}
