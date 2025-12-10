import React, { useState } from "react";

export default function MissionRunner() {
  const [missionName, setMissionName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runMission() {
    try {
      setLoading(true);

      const response = await fetch("http://localhost:5000/api/missions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionName,
          missionId: Date.now(), // unique per run
          payload: { source: "UI-trigger" }
        })
      });

      const data = await response.json();
      setResult(data.result || JSON.stringify(data, null, 2));
    } catch (err) {
      setResult("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "25px" }}>
      <h2>🚀 Run Mission via DeepSeek</h2>

      <input
        value={missionName}
        onChange={(e) => setMissionName(e.target.value)}
        placeholder="Enter mission name"
        style={{ width: 280, padding: 8, marginRight: 10 }}
      />

      <button onClick={runMission} disabled={loading} style={{ padding: "8px 18px" }}>
        {loading ? "Running..." : "Run Mission"}
      </button>

      {result && (
        <div style={{
          marginTop: 20,
          background: "#0a0f22",
          border: "1px solid #00eaff",
          padding: 15,
          borderRadius: 6,
          color: "#00eaff",
          whiteSpace: "pre-wrap"
        }}>
          {result}
        </div>
      )}
    </div>
  );
}
