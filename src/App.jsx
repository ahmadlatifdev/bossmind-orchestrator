import React, { useState } from "react";
import { checkBossmindHealth, sendDeepseekChat } from "./bossmindApi";
import BossmindTester from "./Components/BossmindTester";
import LivePreviewPanel from "./Components/LivePreviewPanel";

export default function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [chatResponse, setChatResponse] = useState("");

  // Trigger health check
  const handleHealthCheck = async () => {
    try {
      const data = await checkBossmindHealth();
      setHealthStatus(JSON.stringify(data, null, 2));
    } catch (err) {
      setHealthStatus("❌ Health check failed — see console");
    }
  };

  // Trigger DeepSeek test query
  const handleAskDeepSeek = async () => {
    try {
      const reply = await sendDeepseekChat([
        { role: "user", content: "Hello BossMind, are you connected?" }
      ]);
      setChatResponse(JSON.stringify(reply, null, 2));
    } catch (err) {
      setChatResponse("❌ DeepSeek request failed — see console");
    }
  };

  return (
    <div style={{ 
      padding: "20px", 
      background: "#0a0f1c", 
      color: "white", 
      minHeight: "100vh",
      fontFamily: "Arial"
    }}>
      <h1>BOSSMIND ORCHESTRATOR — FRONTEND TESTER</h1>

      {/* HEALTH CHECK */}
      <button onClick={handleHealthCheck} style={buttonStyle}>
        🔍 Check API Health
      </button>
      {healthStatus && (
        <pre style={outputBox}>{healthStatus}</pre>
      )}

      {/* DEEPSEEK CHAT TEST */}
      <button onClick={handleAskDeepSeek} style={buttonStyle}>
        🤖 Test DeepSeek Connection
      </button>
      {chatResponse && (
        <pre style={outputBox}>{chatResponse}</pre>
      )}

      {/* COMPONENT TESTING AREA */}
      <div style={{ marginTop: "30px" }}>
        <BossmindTester />
        <LivePreviewPanel />
      </div>
    </div>
  );
}

// Styling
const buttonStyle = {
  padding: "10px 20px",
  background: "#1b2340",
  color: "white",
  border: "1px solid #3e4c85",
  borderRadius: "8px",
  marginRight: "10px",
  cursor: "pointer"
};

const outputBox = {
  background: "#111827",
  padding: "15px",
  marginTop: "10px",
  borderRadius: "8px",
  whiteSpace: "pre-wrap"
};
