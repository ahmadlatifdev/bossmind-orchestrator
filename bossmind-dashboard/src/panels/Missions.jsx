import React, { useState } from "react";

const Missions = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState(null);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [errorText, setErrorText] = useState("");

  const runFullSystemAction = async () => {
    setIsRunning(true);
    setErrorText("");
    setSummary("Running full system action check...");
    setDetails("");

    try {
      // 1) Check backend health
      const healthRes = await fetch("http://localhost:5000/api/health");
      const healthJson = await healthRes.json();

      // 2) Check DeepSeek status
      const aiRes = await fetch("http://localhost:5000/api/deepseek/status");
      const aiJson = await aiRes.json();

      const backendOk = healthJson?.status === "ok";
      const aiOnline = aiJson?.online === true;

      const summaryLines = [];
      summaryLines.push(
        backendOk
          ? "✅ Backend: OK"
          : `⚠ Backend: Unexpected status (${healthJson?.status || "unknown"})`
      );
      summaryLines.push(
        aiOnline
          ? `✅ DeepSeek: Online (${aiJson?.model || "model not specified"})`
          : "⚠ DeepSeek: Reported OFFLINE"
      );

      setSummary(summaryLines.join(" | "));

      const detailObj = {
        backend: healthJson,
        deepseek: aiJson,
        timestamps: {
          executedAt: new Date().toISOString(),
        },
      };

      setDetails(JSON.stringify(detailObj, null, 2));
      setLastRunTime(new Date().toLocaleString());
    } catch (err) {
      console.error("Full system action error:", err);
      setErrorText(
        "Action failed: could not reach one of the endpoints (health or DeepSeek status)."
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: "30px", color: "#e6f7ff" }}>
      <h2
        style={{
          fontSize: "26px",
          marginBottom: "10px",
          color: "#7dd3fc",
        }}
      >
        Mission Control 🎯
      </h2>
      <p
        style={{
          fontSize: "14px",
          opacity: 0.8,
          marginBottom: "24px",
        }}
      >
        Action Engine v1: runs a full system check by calling both the backend
        health endpoint and DeepSeek status, then summarizes the result.
      </p>

      {/* MAIN ACTION CARD */}
      <div
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          background:
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.15), rgba(15, 23, 42, 0.98))",
          padding: "22px 20px",
          marginBottom: "24px",
          boxShadow: "0 0 18px rgba(8, 47, 73, 0.6)",
        }}
      >
        <div
          style={{
            marginBottom: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              Mission 1 — Full System Action Check
            </div>
            <div
              style={{
                fontSize: "13px",
                opacity: 0.8,
                marginTop: "4px",
              }}
            >
              Sequentially calls:
              <br />
              • <code>GET /api/health</code>
              <br />
              • <code>GET /api/deepseek/status</code>
            </div>
          </div>

          <button
            onClick={runFullSystemAction}
            disabled={isRunning}
            style={{
              padding: "10px 20px",
              borderRadius: "999px",
              border: "none",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: isRunning ? "default" : "pointer",
              background: isRunning
                ? "rgba(148, 163, 184, 0.8)"
                : "linear-gradient(135deg, #38bdf8, #06b6d4)",
              color: "#020617",
              boxShadow: isRunning
                ? "none"
                : "0 0 16px rgba(56, 189, 248, 0.7)",
              minWidth: "170px",
              textAlign: "center",
              transition: "all 0.15s ease-out",
            }}
          >
            {isRunning ? "Running..." : "Run Full System Action"}
          </button>
        </div>

        {/* SUMMARY */}
        <div
          style={{
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#020617",
            border: "1px solid rgba(51, 65, 85, 0.9)",
            fontSize: "13px",
            minHeight: "40px",
          }}
        >
          {summary || "Action not executed yet."}
        </div>

        {/* ERROR */}
        {errorText && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(248, 113, 113, 0.15)",
              border: "1px solid rgba(248, 113, 113, 0.7)",
              fontSize: "13px",
              color: "#fecaca",
            }}
          >
            {errorText}
          </div>
        )}

        {/* DETAILS */}
        {details && (
          <pre
            style={{
              marginTop: "14px",
              padding: "12px",
              borderRadius: "10px",
              background: "#020617",
              border: "1px solid rgba(30, 64, 175, 0.7)",
              fontSize: "12px",
              maxHeight: "260px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {details}
          </pre>
        )}

        {lastRunTime && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              opacity: 0.7,
            }}
          >
            Last run: {lastRunTime}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: "13px",
          opacity: 0.75,
        }}
      >
        Future missions (product automation, Supabase sync, scheduled autopilot)
        will be added here as additional action cards. Current mission is a safe
        diagnostic action using only working endpoints.
      </div>
    </div>
  );
};

export default Missions;
