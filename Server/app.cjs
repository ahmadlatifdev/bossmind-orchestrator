const express = require("express");
const routes = require("./routes/index.cjs");
const openrouterRoutes = require("./routes/openrouter.cjs");

const app = express();

// Core middleware
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Base API routes
app.use("/api", routes);

// OpenRouter API
app.use("/api/openrouter", openrouterRoutes);

module.exports = app;
