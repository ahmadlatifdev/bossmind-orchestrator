// app/bossmind-worker.js
// Safe fallback worker to keep Railway service alive

let state = {
  running: false,
  startedAt: null,
  lastTickAt: null,
  lastError: null,
};

let interval = null;

function tick() {
  state.lastTickAt = new Date().toISOString();
}

function startWorker() {
  if (state.running) return { ok: true, state };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.lastError = null;

  interval = setInterval(tick, 15000);
  tick();

  return { ok: true, state };
}

function stopWorker() {
  if (interval) clearInterval(interval);
  interval = null;
  state.running = false;
  return { ok: true, state };
}

function getWorkerStatus() {
  return { ok: true, state };
}

process.on("uncaughtException", (err) => {
  state.lastError = String(err?.stack || err);
});

process.on("unhandledRejection", (err) => {
  state.lastError = String(err?.stack || err);
});

module.exports = {
  startWorker,
  stopWorker,
  getWorkerStatus,
};
