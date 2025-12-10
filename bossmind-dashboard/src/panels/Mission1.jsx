import React, { useState } from 'react';
import './Mission1.css';

export default function Mission1({ apiBase, apiStatus, onRunMission }) {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const runMission = async () => {
    if (apiStatus !== 'connected') {
      setResult('❌ API server not connected. Start backend on port 5000.');
      return;
    }

    setLoading(true);
    try {
      // Test connection
      const healthRes = await fetch(`${apiBase}/health`);
      if (!healthRes.ok) throw new Error('API not responding');
      
      // Get missions
      const missionsRes = await fetch(`${apiBase}/missions`);
      const missions = await missionsRes.json();
      
      setResult(JSON.stringify(missions, null, 2));
      
      // Run first mission
      if (missions.length > 0) {
        await onRunMission(1);
      }
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mission1-panel">
      <h2>🎯 Mission Control I</h2>
      <p className="panel-description">Test live data fetch from BossMind API</p>
      
      <div className="connection-status">
        <div className={`status-indicator ${apiStatus}`}>
          {apiStatus === 'connected' ? '🟢 Connected to API' : '🔴 API Disconnected'}
        </div>
        <div className="api-endpoint">
          <code>{apiBase}</code>
        </div>
      </div>

      <button 
        onClick={runMission} 
        disabled={loading || apiStatus !== 'connected'}
        className="run-mission-btn"
      >
        {loading ? '🔄 Running Mission...' : '🚀 Run Mission'}
      </button>

      <div className="result-display">
        <h3>API Response:</h3>
        {result ? (
          <pre className="api-result">{result}</pre>
        ) : (
          <p className="no-data">Click "Run Mission" to fetch live data</p>
        )}
      </div>

      <div className="mission-info">
        <h4>Available Endpoints:</h4>
        <ul className="endpoint-list">
          <li><code>GET {apiBase}/missions</code> - Get all missions</li>
          <li><code>GET {apiBase}/bozemski</code> - Bozemski AI status</li>
          <li><code>GET {apiBase}/intelligence</code> - Intelligence points</li>
          <li><code>GET {apiBase}/security</code> - Security status</li>
          <li><code>POST {apiBase}/missions/:id/run</code> - Run mission</li>
        </ul>
      </div>
    </div>
  );
}