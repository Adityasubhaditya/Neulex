// frontend/src/components/Comparison.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:8000';

const Comparison = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // New state for URL comparison
  const [customUrl1, setCustomUrl1] = useState('');
  const [customUrl2, setCustomUrl2] = useState('');
  const [urlComparison, setUrlComparison] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      console.log('🔍 Fetching companies for comparison...');
      const response = await fetch(`${API_BASE}/companies`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Companies for comparison:', data);
      
      // Ensure companies have proper IDs and names
      const formattedCompanies = data.map(company => ({
        id: company.id || company.sl_no || company['Sl No'],
        name: company.name || company.company_name || company['Company Name'],
        url: company.url || company.terms_url || company['Terms & Conditions']
      }));
      
      setCompanies(formattedCompanies);
    } catch (error) {
      console.error('❌ Error fetching companies for comparison:', error);
      setError('Failed to load companies. Make sure backend is running on port 8000.');
    }
  };

  const toggleCompany = (companyId) => {
    setSelectedCompanies(prev => {
      if (prev.includes(companyId)) {
        return prev.filter(id => id !== companyId);
      } else {
        if (prev.length >= 4) { // Limit to 4 companies for performance
          alert('Maximum 4 companies can be compared at once');
          return prev;
        }
        return [...prev, companyId];
      }
    });
  };

  const runComparison = async () => {
    if (selectedCompanies.length < 2) {
      alert('Please select at least 2 companies to compare');
      return;
    }

    setLoading(true);
    setComparison(null);
    setUrlComparison(null); // Clear URL comparison when doing company comparison
    setError('');

    try {
      const companyNames = selectedCompanies.map(id => {
        const company = companies.find(c => c.id == id);
        return company ? company.name : null;
      }).filter(name => name !== null);

      console.log('🚀 Comparing companies:', companyNames);

      const response = await fetch(`${API_BASE}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: companyNames,
          comparison_metrics: ['data_risk', 'user_rights', 'readability']
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Comparison failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Comparison result:', result);
      
      // Format comparison data to ensure consistent structure
      const formattedComparison = formatComparisonData(result);
      setComparison(formattedComparison);
    } catch (error) {
      console.error('❌ Comparison error:', error);
      setError('Comparison failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // New function to compare two URLs
  const compareUrls = async () => {
    if (!customUrl1 || !customUrl2) {
      alert('Please enter both URLs to compare');
      return;
    }

    setUrlLoading(true);
    setUrlComparison(null);
    setComparison(null); // Clear company comparison when doing URL comparison
    setError('');

    try {
      console.log('🌐 Comparing URLs:', { customUrl1, customUrl2 });

      // Analyze first URL
      const response1 = await fetch(`${API_BASE}/api/analyze/url?url=${encodeURIComponent(customUrl1)}`);
      if (!response1.ok) {
        throw new Error(`URL 1 analysis failed: ${response1.status}`);
      }
      const result1 = await response1.json();

      // Analyze second URL
      const response2 = await fetch(`${API_BASE}/api/analyze/url?url=${encodeURIComponent(customUrl2)}`);
      if (!response2.ok) {
        throw new Error(`URL 2 analysis failed: ${response2.status}`);
      }
      const result2 = await response2.json();

      console.log('✅ URL comparison results:', { result1, result2 });

      // Format the comparison data
      const urlComparisonData = {
        comparisons: [
          {
            company: `Custom URL 1`,
            risk_scores: result1.analysis?.risk_scores || {
              data_risk: result1.analysis?.data_risk || 0,
              user_rights_score: result1.analysis?.user_rights_score || 0,
              readability_score: result1.analysis?.readability_score || 0,
              overall_risk: result1.analysis?.overall_risk || 0
            },
            risk_level: getRiskLevel(result1.analysis?.overall_risk || result1.analysis?.risk_scores?.overall_risk || 0),
            source: customUrl1
          },
          {
            company: `Custom URL 2`,
            risk_scores: result2.analysis?.risk_scores || {
              data_risk: result2.analysis?.data_risk || 0,
              user_rights_score: result2.analysis?.user_rights_score || 0,
              readability_score: result2.analysis?.readability_score || 0,
              overall_risk: result2.analysis?.overall_risk || 0
            },
            risk_level: getRiskLevel(result2.analysis?.overall_risk || result2.analysis?.risk_scores?.overall_risk || 0),
            source: customUrl2
          }
        ],
        insights: generateUrlInsights(result1.analysis, result2.analysis),
        comparison_type: 'url'
      };

      setUrlComparison(urlComparisonData);
    } catch (error) {
      console.error('❌ URL comparison error:', error);
      setError('URL comparison failed: ' + error.message);
    } finally {
      setUrlLoading(false);
    }
  };

  // Generate insights for URL comparison
  const generateUrlInsights = (analysis1, analysis2) => {
    const insights = [];
    
    const risk1 = analysis1?.risk_scores?.overall_risk || analysis1?.overall_risk || 0;
    const risk2 = analysis2?.risk_scores?.overall_risk || analysis2?.overall_risk || 0;
    
    if (risk1 > risk2) {
      insights.push(`URL 1 has higher overall risk than URL 2 (${risk1} vs ${risk2})`);
    } else if (risk2 > risk1) {
      insights.push(`URL 2 has higher overall risk than URL 1 (${risk2} vs ${risk1})`);
    } else {
      insights.push('Both URLs have similar overall risk levels');
    }

    const dataRisk1 = analysis1?.risk_scores?.data_risk || analysis1?.data_risk || 0;
    const dataRisk2 = analysis2?.risk_scores?.data_risk || analysis2?.data_risk || 0;
    
    if (dataRisk1 > dataRisk2) {
      insights.push(`URL 1 collects more user data than URL 2`);
    } else if (dataRisk2 > dataRisk1) {
      insights.push(`URL 2 collects more user data than URL 1`);
    }

    return insights;
  };

  // Format comparison data to ensure consistent structure
  const formatComparisonData = (comparisonData) => {
    if (!comparisonData) return null;
    
    const formatted = {
      ...comparisonData,
      comparisons: comparisonData.comparisons?.map(comp => ({
        ...comp,
        risk_scores: comp.risk_scores || {
          data_risk: comp.data_risk || 0,
          user_rights_score: comp.user_rights_score || 0,
          readability_score: comp.readability_score || 0,
          overall_risk: comp.overall_risk || 0
        },
        risk_level: comp.risk_level || getRiskLevel(comp.overall_risk || comp.risk_scores?.overall_risk || 0)
      })) || []
    };
    
    return formatted;
  };

  const getRiskLevel = (score) => {
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  };

  // Get the current comparison data (either from companies or URLs)
  const currentComparison = comparison || urlComparison;

  // Ensure comparison data is properly formatted
  const comparisonChartData = currentComparison?.comparisons?.map(comp => ({
    name: comp.company || 'Unknown',
    'Data Risk': comp.risk_scores?.data_risk || 0,
    'User Rights': comp.risk_scores?.user_rights_score || 0,
    'Readability': comp.risk_scores?.readability_score || 0,
    'Overall Risk': comp.risk_scores?.overall_risk || 0
  })) || [];

  const getRiskColor = (score) => {
    if (score >= 7) return '#ff4757';
    if (score >= 4) return '#ffa502';
    return '#2ed573';
  };

  return (
    <div className="comparison-container">
      <div className="comparison-header-card">
        <h1 className="comparison-title">Compare Terms & Conditions</h1>
        <p className="comparison-subtitle">Compare companies from database or analyze custom URLs</p>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {/* Company Comparison Section */}
        <div className="comparison-section">
          <h2 className="section-title">🎯 Compare Database Companies</h2>
          <div className="companies-grid">
            {Array.isArray(companies) && companies.map(company => (
              <div 
                key={company.id}
                className={`company-card ${selectedCompanies.includes(company.id) ? 'selected' : ''}`}
                onClick={() => toggleCompany(company.id)}
              >
                <h4 className="company-name">{company.name}</h4>
                <div className="company-id">
                  ID: {company.id}
                </div>
                {selectedCompanies.includes(company.id) && (
                  <div className="company-selected">
                    ✅ Selected
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="comparison-controls">
            <div className="selected-info">
              <strong>Selected: {selectedCompanies.length} companies</strong>
              {selectedCompanies.length > 0 && (
                <div className="selected-names">
                  {selectedCompanies.map(id => {
                    const company = companies.find(c => c.id == id);
                    return company ? company.name : 'Unknown';
                  }).join(', ')}
                </div>
              )}
            </div>
            
            <button 
              className="btn btn-primary compare-btn"
              onClick={runComparison}
              disabled={selectedCompanies.length < 2 || loading}
            >
              {loading ? '🔍 Comparing...' : `Compare ${selectedCompanies.length} Companies`}
            </button>
          </div>
        </div>

        {/* URL Comparison Section */}
        <div className="comparison-section">
          <h2 className="section-title">🌐 Compare Custom URLs</h2>
          <div className="url-comparison-grid">
            <div className="url-input-group">
              <label className="url-label">First Website URL</label>
              <input
                type="url"
                className="url-input"
                placeholder="https://example1.com/terms"
                value={customUrl1}
                onChange={(e) => setCustomUrl1(e.target.value)}
              />
            </div>
            
            <div className="url-input-group">
              <label className="url-label">Second Website URL</label>
              <input
                type="url"
                className="url-input"
                placeholder="https://example2.com/terms"
                value={customUrl2}
                onChange={(e) => setCustomUrl2(e.target.value)}
              />
            </div>
          </div>

          <div className="url-comparison-controls">
            <button 
              className="btn btn-secondary compare-btn"
              onClick={compareUrls}
              disabled={!customUrl1 || !customUrl2 || urlLoading}
            >
              {urlLoading ? '🔍 Comparing URLs...' : '🌐 Compare URLs'}
            </button>
          </div>
        </div>
      </div>

      {(loading || urlLoading) && (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Comparing terms and conditions...</p>
          <p className="loading-subtext">This may take a while as we analyze each source</p>
        </div>
      )}

      {currentComparison && (
        <div className="comparison-results-container">
          <div className="results-card">
            <h2 className="results-title">
              Comparison Results - {currentComparison.comparison_type === 'url' ? 'URL Comparison' : 'Company Comparison'}
            </h2>
            
            {comparisonChartData.length > 0 ? (
              <div className="comparison-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#b0b0b0" />
                    <YAxis domain={[0, 10]} stroke="#b0b0b0" />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#111', 
                        border: '1px solid #333',
                        borderRadius: '8px',
                        color: '#fff'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="Data Risk" fill="#ff4757" />
                    <Bar dataKey="User Rights" fill="#2ed573" />
                    <Bar dataKey="Readability" fill="#3742fa" />
                    <Bar dataKey="Overall Risk" fill="#ffa502" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">
                No comparison data available
              </div>
            )}

            <div className="comparison-grid">
              {currentComparison.comparisons && currentComparison.comparisons.map((comp, index) => (
                <div key={index} className="company-comparison-card">
                  <h3 className="company-title">{comp.company || 'Unknown Company'}</h3>
                  {comp.source && (
                    <div className="source-info">
                      <small>Source: {comp.source}</small>
                    </div>
                  )}
                  <div className={`risk-badge ${comp.risk_level?.toLowerCase() || 'medium'}`}>
                    {(comp.risk_level || 'Medium')} Risk
                  </div>
                  
                  <div className="risk-scores">
                    <div className="risk-score-item">
                      <strong>Data Risk:</strong> 
                      <span className={`risk-value ${getRiskLevel(comp.risk_scores?.data_risk)}`}>
                        {comp.risk_scores?.data_risk || 'N/A'}/10
                      </span>
                    </div>
                    <div className="risk-score-item">
                      <strong>User Rights:</strong> 
                      <span className={`risk-value ${getRiskLevel(10 - (comp.risk_scores?.user_rights_score || 0))}`}>
                        {comp.risk_scores?.user_rights_score || 'N/A'}/10
                      </span>
                    </div>
                    <div className="risk-score-item">
                      <strong>Readability:</strong> 
                      <span className={`risk-value ${getRiskLevel(10 - (comp.risk_scores?.readability_score || 0))}`}>
                        {comp.risk_scores?.readability_score || 'N/A'}/10
                      </span>
                    </div>
                    <div className="risk-score-item">
                      <strong>Overall Risk:</strong> 
                      <span className={`risk-value ${comp.risk_level}`}>
                        {comp.risk_scores?.overall_risk || 'N/A'}/10
                      </span>
                    </div>
                  </div>

                  {comp.error && (
                    <div className="company-error">
                      ❌ {comp.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {currentComparison.insights && currentComparison.insights.length > 0 && (
              <div className="insights-card">
                <h3 className="insights-title">Comparison Insights</h3>
                <ul className="insights-list">
                  {currentComparison.insights.map((insight, index) => (
                    <li key={index} className="insight-item">{insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="debug-card">
        <details>
          <summary>Debug Information</summary>
          <div className="debug-content">
            <div><strong>Companies Loaded:</strong> {companies.length}</div>
            <div><strong>Selected Companies:</strong> {selectedCompanies.join(', ')}</div>
            <div><strong>Comparison Data:</strong> {currentComparison ? 'Loaded' : 'Not loaded'}</div>
            <div><strong>URL 1:</strong> {customUrl1 || 'Not set'}</div>
            <div><strong>URL 2:</strong> {customUrl2 || 'Not set'}</div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default Comparison;