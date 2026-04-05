const buffer = require("./buffer");

function autoInjectTestTasks() {
  setInterval(() => {
    buffer.addTask(
      { type: "log", payload: "auto-heartbeat" },
      "low"
    );
  }, 10000);
}

function startSupervisor() {
  console.log("[Supervisor] Autonomous Mode ACTIVE");

  autoInjectTestTasks();
}

module.exports = {
  startSupervisor
};