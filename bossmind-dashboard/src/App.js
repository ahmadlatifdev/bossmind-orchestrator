import React, { useState, useEffect } from 'react';
import './App.css';
import { coreAI, DEEPSEEK_API } from './services/deepseek';
import { BACKEND_CONFIG } from './config/backend';   //  <== NEW (backend link injected)

// ========================= GLOBAL ==========================
const API_BASE = BACKEND_CONFIG.BASE_URL;
// ===========================================================

function App() {
  const [activePanel, setActivePanel] = useState('dashboard');
  const [apiStatus, setApiStatus] = useState('checking');
  const [deepSeekStatus, setDeepSeekStatus] = useState(null);
  const [missions, setMissions] = useState([]);
  const [bozemski, setBozemski] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [security, setSecurity] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkApiConnection();
    checkDeepSeekStatus();
    loadAllData();
  }, []);

  // ======================================================
  // BACKEND CHECK
  // ======================================================
  const checkApiConnection = async () => {
    try {
      const r = await fetch(`${API_BASE}/health`);
      if (!r.ok) throw new Error();
      setApiStatus('connected');
    } catch {
      setApiStatus('disconnected');
    }
  };

  // ======================================================
  // DEEPSEEK AI CHECK
  // ======================================================
  const checkDeepSeekStatus = async () => {
    try {
      const res = await coreAI.getSystemStatus();
      setDeepSeekStatus(res);
    } catch {
      setDeepSeekStatus({ status: 'offline', error: 'No API Key or invalid configuration' });
    }
  };

  // ======================================================
  // LOAD MISSIONS + AI SYSTEM
  // ======================================================
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [m1, b1, a1, s1] = await Promise.all([
        fetch(`${API_BASE}/missions`).then(r => r.json()),
        fetch(`${API_BASE}/bozemski`).then(r => r.json()),
        fetch(`${API_BASE}/intelligence`).then(r => r.json()),
        fetch(`${API_BASE}/security`).then(r => r.json())
      ]);

      setMissions(m1);
      setBozemski(b1);
      setIntelligence(a1);
      setSecurity(s1);

    } catch (e) {
      console.log("Data Sync Failed →", e.message);
    }
    setLoading(false);
  };

  // ======================================================
  // RUN A MISSION
  // ======================================================
  const runMission = async (id) => {
    try {
      const r = await fetch(`${API_BASE}/missions/${id}/run`, { method:'POST' });
      const d = await r.json();
      alert(d.success ? `🚀 ${d.message}` : `❌ ${d.message}`);
      loadAllData();
    } catch(e){ alert("Mission Failed: " + e.message); }
  };

  // ======================================================
  // ASK AI (CHAT)
  // ======================================================
  const askDeepSeek = async (txt) => {
    try {
      setLoading(true);
      const res = await coreAI.chatCompletion([
        { role:'system', content:'You are Bozemski Mission AI.' },
        { role:'user', content:txt }
      ]);
      setAiResponse(res.choices?.[0]?.message?.content || "No reply");
    } catch(e){ setAiResponse("AI Error: " + e.message); }
    setLoading(false);
  };

  // ======================================================
  // UI PANELS
  // ======================================================
  const Dashboard = () => (
    <div className="dashboard-panel">
      <h2>📊 System Overview</h2>

      <div className="ai-status-card">
        <h3>🧠 DeepSeek AI</h3>
        <p>Status: {deepSeekStatus?.status === "online" ? "🟢 Online" : "🔴 Offline"}</p>
        <p>Model: {DEEPSEEK_API.CURRENT_MODEL}</p>
        {deepSeekStatus?.error && <small>{deepSeekStatus.error}</small>}
      </div>

      <div className="stat-box">
        <h3>Missions</h3> <b>{missions.length}</b>
      </div>
    </div>
  );

  const Mission1 = () => (
    <div className="mission-panel">
      <h2>🎯 Mission Control</h2>

      {missions.map(m => (
        <div key={m.id} className="mission-item">
          <b>{m.name}</b>
          <p>{m.description}</p>
          <button onClick={() => runMission(m.id)}>🚀 Run Now</button>
        </div>
      ))}
    </div>
  );

  const Settings = () => (
    <div className="settings-panel">
      <h2>⚙️ Settings</h2>

      <button onClick={checkApiConnection}>🔄 Test API</button>
      <button onClick={checkDeepSeekStatus}>🤖 Test AI</button>
      <button onClick={loadAllData}>📥 Reload Data</button>
      <a href="http://localhost:5000" target="_blank">🔗 Backend</a>
    </div>
  );

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 BossMind Orchestrator</h1>
        <p>{apiStatus === "connected" ? "🟢 API Ready" : "🔴 Backend Offline"}</p>
      </header>

      <nav className="tabs">
        <button onClick={() => setActivePanel("dashboard")}>📊 Dashboard</button>
        <button onClick={() => setActivePanel("mission1")}>🎯 Missions</button>
        <button onClick={() => setActivePanel("settings")}>⚙ Settings</button>
      </nav>

      <main className="main">
        {activePanel==="dashboard" && <Dashboard />}
        {activePanel==="mission1" && <Mission1 />}
        {activePanel==="settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
