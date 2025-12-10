// src/services/missionsApi.js
// Helper to call POST /api/missions/run from your React app

export async function runMission(missionPayload) {
  try {
    const response = await fetch("/api/missions/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mission: missionPayload,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data; // { success, status, received, ... }

  } catch (error) {
    console.error("runMission error:", error);
    throw error;
  }
}
