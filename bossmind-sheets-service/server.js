require("./core/supervisor_loader.js");
const buffer = require("./core/buffer");

const express = require("express");
const app = express();

const PORT = Number(process.env.PORT) || 3010;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROOT
app.get("/", (req, res) => {
  res.status(200).json({
    status: "BossMind ACTIVE",
    host: "127.0.0.1",
    port: PORT
  });
});

// ADD TASK
app.get("/task/log/:type", (req, res) => {
  const { type } = req.params;
  const { priority } = req.query;

  const task = {
    type: "log",
    payload: type
  };

  buffer.addTask(task, priority || "low");

  res.json({
    status: "Task added",
    task
  });
});

// BUFFER STATUS
app.get("/buffer/status", (req, res) => {
  res.json({
    queue_length: buffer.getQueueLength(),
    is_processing: buffer.isProcessing()
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});