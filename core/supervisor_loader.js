const buffer = require("./buffer");

function loadSupervisor() {
  console.log("BossMind supervisor loaded");
  return {
    status: "ACTIVE",
    bufferReady: typeof buffer.getQueue === "function",
    startedAt: new Date().toISOString(),
  };
}

module.exports = loadSupervisor();