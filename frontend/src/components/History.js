// frontend/src/components/History.js
import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const History = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history?limit=50`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📜 History API response:', data);
      
      // Extract analyses from the response object
      if (data.history && Array.isArray(data.history)) {
        setAnalyses(data.history);
      } else if (Array.isArray(data)) {
        setAnalyses(data);
      } else {
        setAnalyses([]);
      }
    } catch (error) {
      console.error('❌ Error fetching history:', error);
      setError('Failed to load history: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error-message">
          ❌ {error}
        </div>
        <button onClick={fetchHistory} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="card">
        <h1>Analysis History</h1>
        <p>Your previously analyzed terms and conditions</p>

        {analyses.length === 0 ? (
          <div className="empty-state">
            <h3>No analyses yet</h3>
            <p>Start by analyzing some terms and conditions!</p>
            <Link to="/analyze" className="btn btn-primary">
              Analyze Terms
            </Link>
          </div>
        ) : (
          <div className="history-list">
            {analyses.map((analysis, index) => (
              <div key={analysis.id || index} className="history-item card">
                <div className="history-header">
                  <h4>{analysis.domain || 'Unknown Domain'}</h4>
                  <div className={`risk-badge ${analysis.risk_score >= 7 ? 'high' : analysis.risk_score >= 4 ? 'medium' : 'low'}`}>
                    Risk: {analysis.risk_score}/10
                  </div>
                </div>
                <div className="history-url">{analysis.url}</div>
                <div className="history-date">{formatDate(analysis.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;