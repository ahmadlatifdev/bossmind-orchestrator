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

  while (queue.length > 0) {
    const item = queue[0];

    try {
      item.status = "running";
      await item.task();
      item.status = "done";
      queue.shift();
    } catch (err) {
      item.retries += 1;

      if (item.retries >= 3) {
        item.status = "failed";
        queue.shift();
      } else {
        item.status = "retrying";
      }
    }
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