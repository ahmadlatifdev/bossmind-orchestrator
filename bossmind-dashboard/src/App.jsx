import React, { useState } from 'react';
import Dashboard from './panels/Dashboard';
import Missions from './panels/Missions';
import Settings from './panels/Settings';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiStatus, setApiStatus] = useState('Checking...');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="bossmind-app" style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#0a1929', color: '#e6f7ff' }}>
      {/* Header */}
      <header className="bossmind-header" style={{ background: 'linear-gradient(135deg, #001e3c 0%, #0a1929 100%)', padding: '20px', borderBottom: '2px solid #00b4d8' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(90deg, #00b4d8, #90e0ef)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          BossMind Orchestrator
        </h1>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: apiStatus === 'Ready' ? '#4ade80' : apiStatus === 'Error' ? '#f87171' : '#fbbf24',
            animation: apiStatus === 'Checking...' ? 'pulse 1.5s infinite' : 'none'
          }} />
          <span style={{ color: '#caf0f8' }}>API: {apiStatus}</span>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bossmind-nav" style={{ display: 'flex', background: '#001e3c', borderBottom: '1px solid #1e3a5f' }}>
        <button
          onClick={() => handleTabChange('dashboard')}
          style={{
            flex: 1,
            padding: '15px',
            background: activeTab === 'dashboard' ? '#00b4d8' : 'transparent',
            color: activeTab === 'dashboard' ? '#0a1929' : '#90e0ef',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => handleTabChange('missions')}
          style={{
            flex: 1,
            padding: '15px',
            background: activeTab === 'missions' ? '#00b4d8' : 'transparent',
            color: activeTab === 'missions' ? '#0a1929' : '#90e0ef',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Missions
        </button>
        <button
          onClick={() => handleTabChange('settings')}
          style={{
            flex: 1,
            padding: '15px',
            background: activeTab === 'settings' ? '#00b4d8' : 'transparent',
            color: activeTab === 'settings' ? '#0a1929' : '#90e0ef',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Settings
        </button>
      </nav>

      {/* Main Content */}
      <main style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'dashboard' && <Dashboard onApiStatusChange={setApiStatus} />}
        {activeTab === 'missions' && <Missions />}
        {activeTab === 'settings' && <Settings onApiStatusChange={setApiStatus} />}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid #1e3a5f', color: '#7dd3fc', fontSize: '14px' }}>
        BossMind Orchestrator v1.0 • Backend running at: http://localhost:5000
      </footer>

      <style jsx="true">{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        button:hover {
          background-color: rgba(0, 180, 216, 0.1) !important;
        }
      `}</style>
    </div>
  );
}

export default App;