const queue = [];
let processing = false;

function addTask(task) {
  queue.push({
    id: Date.now(),
    task,
    status: "pending",
    retries: 0,
  });

  processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;

  const item = queue.shift();

  if (!item) {
    processing = false;
    return;
  }

  try {
    item.status = "running";
    await item.task();
    item.status = "done";
  } catch (err) {
    item.retries += 1;
    item.status = "failed";
  }

  processing = false;
}

function getQueue() {
  return queue;
}

module.exports = {
  addTask,
  getQueue,
};