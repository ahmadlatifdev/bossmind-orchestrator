require("dotenv").config();

const {
  saveMemory,
  testConnection,
  closeMemory
} = require("./bossmind_shared_memory_connector");

async function activateBossMind() {
  console.log("BossMind activation started...");

  const db = await testConnection();
  console.log("Database connected at:", db.now);

  await saveMemory(
    "BossMind",
    "system",
    "activation_status",
    {
      status: "active",
      description: "BossMind shared memory activated"
    },
    "activate-bossmind"
  );

  await saveMemory(
    "Resumora",
    "project",
    "status",
    { state: "connected_to_shared_memory" },
    "activate-bossmind"
  );

  await saveMemory(
    "ElegancyArt",
    "project",
    "status",
    { state: "connected_to_shared_memory" },
    "activate-bossmind"
  );

  await saveMemory(
    "AI Video Generator",
    "project",
    "status",
    { state: "connected_to_shared_memory" },
    "activate-bossmind"
  );

  await saveMemory(
    "TikTok System",
    "project",
    "status",
    { state: "connected_to_shared_memory" },
    "activate-bossmind"
  );

  await saveMemory(
    "Global Stock System",
    "project",
    "status",
    { state: "connected_to_shared_memory" },
    "activate-bossmind"
  );

  console.log("BossMind shared memory activated successfully.");
}

activateBossMind()
  .catch((err) => {
    console.error("BossMind activation error:", err);
  })
  .finally(async () => {
    await closeMemory();
  });