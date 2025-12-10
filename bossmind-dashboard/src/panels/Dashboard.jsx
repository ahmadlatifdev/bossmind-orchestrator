import React, { useEffect, useState } from "react";

function Dashboard() {
  const [apiStatus, setApiStatus] = useState(null);
  const [deepseek, setDeepseek] = useState({ online: false, model: null });

  // ----------- Fetch Backend Status -----------
  const loadApiStatus = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/health");
      const data = await res.json();
      setApiStatus(data.status === "ok" ? "Online" : "Offline");
    } catch {
      setApiStatus("Offline");
    }
  };

  // ----------- Fetch DeepSeek Status -----------
  const loadDeepseek = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/deepseek/status");
      const data = await res.json();
      setDeepseek({
        online: data.online === true,
        model: data.model || "Not Detected"
      });
    } catch {
      setDeepseek({ online: false, model: null });
    }
  };

  useEffect(() => {
    loadApiStatus();
    loadDeepseek();
  }, []);

  return (
    <div style={{ padding: "25px", color: "white" }}>
      <h2 style={{ fontSize: "28px", marginBottom: "30px" }}>System Overview</h2>

      {/* Backend Box */}
      <div style={{
        background: "#08223a",
        padding: "18px",
        borderRadius: "10px",
        marginBottom: "20px",
        border: "1px solid #1463a5"
      }}>
        <h3>Backend API</h3>
        <p>Status: <b style={{ color: apiStatus === "Online" ? "#4ade80" : "#f87171" }}>
          {apiStatus}
        </b></p>
        <p>Endpoint: http://localhost:5000</p>
      </div>

      {/* DeepSeek AI Box */}
      <div style={{
        background: "#08223a",
        padding: "18px",
        borderRadius: "10px",
        border: "1px solid #126f99"
      }}>
        <h3>DeepSeek AI</h3>

        <p>Status: <b style={{
          color: deepseek.online ? "#4ade80" : "#f87171"
        }}>
          {deepseek.online ? "Online" : "Offline"}
        </b></p>

        <p>Model: <b style={{ color: deepseek.model ? "#00e0ff" : "#f87171" }}>
          {deepseek.model || "No Model Detected"}
        </b></p>
      </div>
    </div>
  );
}

export default Dashboard;
