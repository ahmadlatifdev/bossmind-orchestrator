import React, { useState } from 'react';

function Settings({ onApiStatusChange }) {
  const [apiTestResult, setApiTestResult] = useState(null);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [loading, setLoading] = useState({ api: false, ai: false });
  const [error, setError] = useState({ api: null, ai: null });

  const testApi = async () => {
    setLoading(prev => ({ ...prev, api: true }));
    setError(prev => ({ ...prev, api: null }));
    
    try {
      const response = await fetch('http://localhost:5000/api/health');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setApiTestResult(data);
      
      if (data.status === 'ok') {
        onApiStatusChange('Ready');
      }
    } catch (err) {
      console.error('Error testing API:', err);
      setError(prev => ({ ...prev, api: err.message }));
      onApiStatusChange('Error');
    } finally {
      setLoading(prev => ({ ...prev, api: false }));
    }
  };

  const testAI = async () => {
    setLoading(prev => ({ ...prev, ai: true }));
    setError(prev => ({ ...prev, ai: null }));
    
    try {
      const response = await fetch('http://localhost:5000/api/deepseek/status');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAiTestResult(data);
      
      if (data.online) {
        onApiStatusChange('Ready');
      } else {
        onApiStatusChange('No API Key');
      }
    } catch (err) {
      console.error('Error testing AI:', err);
      setError(prev => ({ ...prev, ai: err.message }));
      onApiStatusChange('Error');
    } finally {
      setLoading(prev => ({ ...prev, ai: false }));
    }
  };

  const reloadData = () => {
    testApi();
    testAI();
  };

  return (
    <div className="settings-panel">
      <h2 style={{ color: '#90e0ef', marginBottom: '30px', fontSize: '2rem' }}>Settings & Diagnostics</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', marginBottom: '40px' }}>
        {/* Connection Settings */}
        <div style={{
          background: 'linear-gradient(145deg, #001e3c, #0a1929)',
          borderRadius: '15px',
          padding: '25px',
          border: '1px solid #1e3a5f'
        }}>
          <h3 style={{ color: '#00b4d8', marginTop: 0 }}>Backend Connection</h3>
          
          <div style={{ color: '#e6f7ff', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>API Endpoint:</span>
              <a 
                href="http://localhost:5000/api/health" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#00b4d8', textDecoration: 'none' }}
              >
                http://localhost:5000
              </a>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Status:</span>
              <span style={{
                color: apiTestResult?.status === 'ok' ? '#4ade80' : 
                       error.api ? '#f87171' : '#fbbf24',
                fontWeight: 'bold'
              }}>
                {apiTestResult?.status === 'ok' ? 'Connected' : 
                 error.api ? 'Error' : 'Unknown'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button
              onClick={testApi}
              disabled={loading.api}
              style={{
                padding: '12px',
                background: loading.api ? '#1e3a5f' : 'linear-gradient(90deg, #00b4d8, #0077b6)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: loading.api ? 'not-allowed' : 'pointer',
                opacity: loading.api ? 0.7 : 1
              }}
            >
              {loading.api ? 'Testing...' : 'Test API'}
            </button>
            
            <button
              onClick={testAI}
              disabled={loading.ai}
              style={{
                padding: '12px',
                background: loading.ai ? '#1e3a5f' : 'linear-gradient(90deg, #4ade80, #16a34a)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: loading.ai ? 'not-allowed' : 'pointer',
                opacity: loading.ai ? 0.7 : 1
              }}
            >
              {loading.ai ? 'Testing...' : 'Test AI'}
            </button>
            
            <button
              onClick={reloadData}
              disabled={loading.api || loading.ai}
              style={{
                padding: '12px',
                background: 'linear-gradient(90deg, #fbbf24, #d97706)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: loading.api || loading.ai ? 'not-allowed' : 'pointer',
                opacity: loading.api || loading.ai ? 0.7 : 1
              }}
            >
              Reload Data
            </button>
            
            <a
              href="http://localhost:5000/api/health"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px',
                background: '#1e3a5f',
                color: '#90e0ef',
                border: '1px solid #00b4d8',
                borderRadius: '8px',
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Open Backend in New Tab
            </a>
          </div>
        </div>

        {/* System Information */}
        <div style={{
          background: 'linear-gradient(145deg, #001e3c, #0a1929)',
          borderRadius: '15px',
          padding: '25px',
          border: '1px solid #1e3a5f'
        }}>
          <h3 style={{ color: '#00b4d8', marginTop: 0 }}>System Information</h3>
          
          <div style={{ color: '#e6f7ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #1e3a5f' }}>
              <span>Frontend:</span>
              <span style={{ color: '#90e0ef', fontWeight: 'bold' }}>React v18</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #1e3a5f' }}>
              <span>Backend:</span>
              <span style={{ color: '#90e0ef', fontWeight: 'bold' }}>Node.js + Express</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #1e3a5f' }}>
              <span>AI Engine:</span>
              <span style={{ color: '#90e0ef', fontWeight: 'bold' }}>DeepSeek API</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>CORS:</span>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>Enabled (*)</span>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0, 180, 216, 0.1)', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#caf0f8', fontSize: '14px' }}>
                <strong>Note:</strong> Ensure your backend is running at http://localhost:5000
                with CORS enabled for React development.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div style={{
        background: 'linear-gradient(145deg, #001e3c, #0a1929)',
        borderRadius: '15px',
        padding: '25px',
        border: '1px solid #1e3a5f'
      }}>
        <h3 style={{ color: '#00b4d8', marginTop: 0, marginBottom: '20px' }}>Test Results</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* API Test Results */}
          <div>
            <h4 style={{ color: '#90e0ef', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: error.api ? '#f87171' : (apiTestResult?.status === 'ok' ? '#4ade80' : '#fbbf24')
              }} />
              API Health Test
            </h4>
            
            {loading.api ? (
              <div style={{ color: '#caf0f8', padding: '15px', textAlign: 'center' }}>
                <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }}>⟳</div>
                Testing API connection...
              </div>
            ) : error.api ? (
              <div style={{
                padding: '15px',
                background: 'rgba(248, 113, 113, 0.1)',
                borderRadius: '8px',
                borderLeft: '4px solid #f87171',
                color: '#fca5a5'
              }}>
                <strong>Error:</strong> {error.api}
              </div>
            ) : apiTestResult ? (
              <pre style={{
                background: '#0a1929',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #1e3a5f',
                color: '#e6f7ff',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '13px',
                margin: 0
              }}>
                {JSON.stringify(apiTestResult, null, 2)}
              </pre>
            ) : (
              <div style={{ color: '#7dd3fc', fontStyle: 'italic', textAlign: 'center', padding: '15px' }}>
                Click "Test API" to check connection
              </div>
            )}
          </div>

          {/* AI Test Results */}
          <div>
            <h4 style={{ color: '#90e0ef', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: error.ai ? '#f87171' : (aiTestResult?.online ? '#4ade80' : '#fbbf24')
              }} />
              DeepSeek AI Test
            </h4>
            
            {loading.ai ? (
              <div style={{ color: '#caf0f8', padding: '15px', textAlign: 'center' }}>
                <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }}>⟳</div>
                Testing AI configuration...
              </div>
            ) : error.ai ? (
              <div style={{
                padding: '15px',
                background: 'rgba(248, 113, 113, 0.1)',
                borderRadius: '8px',
                borderLeft: '4px solid #f87171',
                color: '#fca5a5'
              }}>
                <strong>Error:</strong> {error.ai}
              </div>
            ) : aiTestResult ? (
              <pre style={{
                background: '#0a1929',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #1e3a5f',
                color: '#e6f7ff',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '13px',
                margin: 0
              }}>
                {JSON.stringify(aiTestResult, null, 2)}
              </pre>
            ) : (
              <div style={{ color: '#7dd3fc', fontStyle: 'italic', textAlign: 'center', padding: '15px' }}>
                Click "Test AI" to check DeepSeek
              </div>
            )}
          </div>
        </div>
        
        {(apiTestResult || aiTestResult || error.api || error.ai) && (
          <button
            onClick={() => {
              setApiTestResult(null);
              setAiTestResult(null);
              setError({ api: null, ai: null });
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#1e3a5f',
              color: '#90e0ef',
              border: '1px solid #00b4d8',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Clear All Results
          </button>
        )}
      </div>

      <style jsx="true">{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Settings;