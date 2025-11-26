// frontend/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer 
} from 'recharts';

const API_BASE = 'http://localhost:8000';

const Dashboard = ({ userProfile }) => {
  const [stats, setStats] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('📊 Fetching dashboard data...');
      
      const [historyRes, companiesRes] = await Promise.all([
        fetch(`${API_BASE}/api/history?limit=10`),
        fetch(`${API_BASE}/companies`)
      ]);

      if (!historyRes.ok) throw new Error('Failed to fetch history');
      if (!companiesRes.ok) throw new Error('Failed to fetch companies');

      const historyData = await historyRes.json();
      const companies = await companiesRes.json();

      console.log('📈 History API response:', historyData);
      console.log('🏢 Companies data:', companies);

      // Extract analyses from the response object
      let analyses = [];
      if (historyData.history && Array.isArray(historyData.history)) {
        analyses = historyData.history;
      } else if (Array.isArray(historyData)) {
        analyses = historyData;
      }

      console.log('📋 Extracted analyses:', analyses);
      setRecentAnalyses(analyses);
      
      // Calculate stats
      const riskDistribution = calculateRiskDistribution(analyses);
      const avgRiskScore = calculateAverageRisk(analyses);
      
      setStats({
        totalAnalyses: analyses.length,
        avgRiskScore,
        highRiskCount: riskDistribution.high,
        mediumRiskCount: riskDistribution.medium,
        lowRiskCount: riskDistribution.low,
        companiesCount: companies.length,
        totalFromAPI: historyData.total // Keep the total from API for reference
      });
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError('Failed to load dashboard data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateRiskDistribution = (analyses) => {
    if (!Array.isArray(analyses)) return { high: 0, medium: 0, low: 0 };
    
    const distribution = { high: 0, medium: 0, low: 0 };
    analyses.forEach(analysis => {
      const risk = analysis.risk_score;
      if (risk >= 7) distribution.high++;
      else if (risk >= 4) distribution.medium++;
      else distribution.low++;
    });
    return distribution;
  };

  const calculateAverageRisk = (analyses) => {
    if (!Array.isArray(analyses) || analyses.length === 0) return 0;
    const total = analyses.reduce((sum, analysis) => sum + (analysis.risk_score || 0), 0);
    return (total / analyses.length).toFixed(1);
  };

  const riskChartData = stats ? [
    { name: 'High Risk', value: stats.highRiskCount, color: '#ff4757' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#ffa502' },
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#2ed573' }
  ] : [];

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
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
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error-message">
          ❌ {error}
        </div>
        <button onClick={fetchDashboardData} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Neulex</h1>
        <p className="dashboard-subtitle">AI-powered analysis of privacy policies and terms of service</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Analyses</h3>
          <div className="stat-number">{stats?.totalAnalyses || 0}</div>
          <div className="stat-label">
            {stats?.totalFromAPI ? `of ${stats.totalFromAPI} total` : 'Completed scans'}
          </div>
        </div>
        
        <div className="stat-card">
          <h3>Average Risk</h3>
          <div className={`stat-number risk-${stats?.avgRiskScore >= 7 ? 'high' : stats?.avgRiskScore >= 4 ? 'medium' : 'low'}`}>
            {stats?.avgRiskScore || 0}/10
          </div>
          <div className="stat-label">Across all analyses</div>
        </div>
        
        <div className="stat-card">
          <h3>High Risk Sites</h3>
          <div className="stat-number risk-high">{stats?.highRiskCount || 0}</div>
          <div className="stat-label">Risk score ≥ 7</div>
        </div>
        
        <div className="stat-card">
          <h3>Companies Tracked</h3>
          <div className="stat-number">{stats?.companiesCount || 0}</div>
          <div className="stat-label">In database</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Risk Distribution</h3>
          {riskChartData.some(item => item.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data-placeholder">
              No analysis data available
            </div>
          )}
        </div>

        <div className="chart-card">
          <h3>Recent Analyses</h3>
          <div className="recent-list">
            {recentAnalyses.length > 0 ? (
              recentAnalyses.slice(0, 5).map((analysis, index) => (
                <div key={analysis.id || index} className="recent-item">
                  <div className="recent-domain">{analysis.domain || 'Unknown'}</div>
                  <div className="recent-risk">
                    <span className={`risk-badge ${analysis.risk_score >= 7 ? 'high' : analysis.risk_score >= 4 ? 'medium' : 'low'}`}>
                      Risk: {analysis.risk_score || 'N/A'}/10
                    </span>
                  </div>
                  <div className="recent-date">{formatDate(analysis.created_at)}</div>
                </div>
              ))
            ) : (
              <div className="no-data-placeholder">
                No recent analyses
                <br />
                <small>Analyze some terms to see history here</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="actions-card">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <Link to="/analyze" className="btn btn-primary action-btn">
            <span className="btn-icon">🔍</span>
            Analyze New Terms
          </Link>
          
          <Link to="/compare" className="btn btn-secondary action-btn">
            <span className="btn-icon">⚖️</span>
            Compare Companies
          </Link>
          
          <Link to="/profile" className="btn btn-secondary action-btn">
            <span className="btn-icon">👤</span>
            Update Profile
          </Link>
        </div>
      </div>

      {/* Debug Info - Remove in production */}
      <div className="debug-card">
        <details>
          <summary>Debug Info (Click to expand)</summary>
          <div><strong>API Response Format:</strong> Object with 'history' array</div>
          <div><strong>Recent Analyses Count:</strong> {recentAnalyses.length}</div>
          <div><strong>Stats:</strong> {JSON.stringify(stats, null, 2)}</div>
        </details>
      </div>
    </div>
  );
};

export default Dashboard;