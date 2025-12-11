// src/Components/BossmindTester.jsx
// Simple test panel to call the BossMind Orchestrator on Railway

import React, { useState } from "react";
import { checkBossmindHealth, sendDeepseekChat } from "../bossmindApi";

function BossmindTester() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [question, setQuestion] = useState("Give me a short status summary.");
  const [answer, setAnswer] = useState("");
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState("");

  const handleCheckHealth = async () => {
    try {
      setError("");
      setLoadingHealth(true);
      const data = await checkBossmindHealth();
      setHealthStatus(data);
    } catch (err) {
      setError(err.message || "Health check failed.");
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleSendChat = async () => {
    try {
      setError("");
      setLoadingChat(true);
      setAnswer("");

      const messages = [
        {
          role: "system",
          content:
            "You are the BossMind Orchestrator assistant. Reply briefly and clearly.",
        },
        {
          role: "user",
          content: question,
        },
      ];

      const data = await sendDeepseekChat(messages);

      const content =
        data?.choices?.[0]?.message?.content ||
        JSON.stringify(data, null, 2);

      setAnswer(content);
    } catch (err) {
      setError(err.message || "DeepSeek chat failed.");
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div
      style={{
        background: "#020617",
        color: "#e5e7eb",
        padding: "20px",
        borderRadius: "12px",
        maxWidth: "800px",
        margin: "20px auto",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        border: "1px solid #1f2937",
      }}
    >
      <h2 style={{ marginBottom: "10px", fontSize: "20px" }}>
        BossMind Orchestrator Tester
      </h2>
      <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "16px" }}>
        This panel talks to your live Railway backend:
        <br />
        <code style={{ fontSize: "12px", color: "#38bdf8" }}>
          https://bossmind-orchestrator-production.up.railway.app
        </code>
      </p>

      {/* Health section */}
      <div
        style={{
          marginBottom: "20px",
          padding: "12px",
          background: "#020617",
          borderRadius: "10px",
          border: "1px solid #111827",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Health Check</h3>
        <button
          onClick={handleCheckHealth}
          disabled={loadingHealth}
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: "none",
            background: loadingHealth ? "#4b5563" : "#22c55e",
            color: "#020617",
            fontWeight: 600,
            cursor: loadingHealth ? "wait" : "pointer",
            fontSize: "14px",
          }}
        >
          {loadingHealth ? "Checking..." : "Check /api/health"}
        </button>

        {healthStatus && (
          <pre
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#020617",
              borderRadius: "8px",
              fontSize: "12px",
              maxHeight: "160px",
              overflow: "auto",
              border: "1px solid #111827",
            }}
          >
{JSON.stringify(healthStatus, null, 2)}
          </pre>
        )}
      </div>

      {/* Chat section */}
      <div
        style={{
          padding: "12px",
          background: "#020617",
          borderRadius: "10px",
          border: "1px solid #111827",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
          DeepSeek Chat Test
        </h3>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #374151",
            marginBottom: "10px",
            background: "#020617",
            color: "#e5e7eb",
            fontSize: "14px",
          }}
        />

        <button
          onClick={handleSendChat}
          disabled={loadingChat}
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: "none",
            background: loadingChat ? "#4b5563" : "#38bdf8",
            color: "#020617",
            fontWeight: 600,
            cursor: loadingChat ? "wait" : "pointer",
            fontSize: "14px",
          }}
        >
          {loadingChat ? "Sending..." : "Ask DeepSeek"}
        </button>

        {answer && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#020617",
              borderRadius: "8px",
              fontSize: "14px",
              border: "1px solid #111827",
              whiteSpace: "pre-wrap",
            }}
          >
            {answer}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "#7f1d1d",
            color: "#fee2e2",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default BossmindTester;
