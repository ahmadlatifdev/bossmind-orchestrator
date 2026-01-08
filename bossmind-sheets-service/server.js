const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("BossMind Sheets Service is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bossmind-sheets-service",
    time: new Date().toISOString()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
