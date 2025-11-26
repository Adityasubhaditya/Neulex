// frontend/src/components/Analysis.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const API_BASE = 'http://localhost:8000';

const Analysis = ({ userProfile }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      console.log('🔍 Fetching companies from:', `${API_BASE}/companies`);
      const response = await fetch(`${API_BASE}/companies`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Companies received:', data);
      
      const formattedCompanies = data.map(company => ({
        id: company.id || company.sl_no || company['Sl No'],
        name: company.name || company.company_name || company['Company Name'],
        url: company.url || company.terms_url || company['Terms & Conditions']
      }));
      
      setCompanies(formattedCompanies);
    } catch (error) {
      console.error('❌ Error fetching companies:', error);
      setError('Failed to load companies. Make sure backend is running on port 8000.');
    }
  };

  const analyzeCompany = async (companyId) => {
    if (!companyId) return;
    
    setLoading(true);
    setAnalysis(null);
    setError('');
    
    try {
      const company = companies.find(c => c.id == companyId);
      if (!company) {
        throw new Error('Company not found in frontend list');
      }

      console.log('🚀 Analyzing company:', company.name, 'ID:', company.id);
      
      const url = `${API_BASE}/api/analyze/company/${encodeURIComponent(company.name)}`;
      console.log('🔍 DEBUG - Request URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Analysis result:', result);
      
      if (result.success) {
        // Ensure the analysis data is properly formatted
        const formattedAnalysis = formatAnalysisData(result.analysis);
        setAnalysis(formattedAnalysis);
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
      setError('Analysis failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCustomUrl = async () => {
    if (!customUrl) return;
    
    setLoading(true);
    setAnalysis(null);
    setError('');
    
    try {
      console.log('🌐 Analyzing custom URL:', customUrl);
      const response = await fetch(`${API_BASE}/api/analyze/url?url=${encodeURIComponent(customUrl)}`);
      
      if (!response.ok) {
        throw new Error(`URL analysis failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ URL analysis result:', result);
      
      if (result.success) {
        const formattedAnalysis = formatAnalysisData(result.analysis);
        setAnalysis(formattedAnalysis);
      } else {
        throw new Error(result.error || 'URL analysis failed');
      }
    } catch (error) {
      console.error('❌ URL analysis error:', error);
      setError('URL analysis failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (file) => {
    if (!file) return;
    
    setLoading(true);
    setAnalysis(null);
    setError('');
    
    try {
      console.log('📄 Uploading PDF:', file.name);
      
      const formData = new FormData();
      formData.append('pdf', file);
      
      const response = await fetch(`${API_BASE}/api/analyze/pdf`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF analysis failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ PDF analysis result:', result);
      
      if (result.success) {
        const formattedAnalysis = formatAnalysisData(result.analysis);
        setAnalysis(formattedAnalysis);
      } else {
        throw new Error(result.error || 'PDF analysis failed');
      }
    } catch (error) {
      console.error('❌ PDF analysis error:', error);
      setError('PDF analysis failed: ' + error.message);
    } finally {
      setLoading(false);
      setPdfFile(null);
    }
  };

  // Format analysis data to ensure consistent structure
  const formatAnalysisData = (analysisData) => {
    if (!analysisData) return null;
    
    // If analysis data is a string (table format), parse it
    if (typeof analysisData === 'string') {
      return parseTableData(analysisData);
    }
    
    // Ensure risk_scores exists and has proper structure
    const formattedData = {
      ...analysisData,
      risk_scores: analysisData.risk_scores || {
        data_risk: analysisData.data_risk || 0,
        user_rights_score: analysisData.user_rights_score || 0,
        readability_score: analysisData.readability_score || 0,
        overall_risk: analysisData.overall_risk || 0,
        termination_risk: analysisData.termination_risk || 0
      },
      risk_level: analysisData.risk_level || getRiskLevel(analysisData.overall_risk || analysisData.risk_scores?.overall_risk || 0)
    };
    
    return formattedData;
  };

  // Parse table data if backend returns table format
  const parseTableData = (tableString) => {
    try {
      const lines = tableString.split('\n').filter(line => line.trim());
      const riskScores = {};
      
      lines.forEach(line => {
        if (line.includes('Data Risk:')) {
          riskScores.data_risk = extractScore(line);
        } else if (line.includes('User Rights:')) {
          riskScores.user_rights_score = extractScore(line);
        } else if (line.includes('Readability:')) {
          riskScores.readability_score = extractScore(line);
        } else if (line.includes('Overall Risk:')) {
          riskScores.overall_risk = extractScore(line);
        }
      });
      
      return {
        risk_scores: riskScores,
        risk_level: getRiskLevel(riskScores.overall_risk || 0),
        summary: "Analysis completed successfully",
        data_collection: ["Data collection practices analyzed"],
        user_rights: ["User rights assessment completed"],
        recommendations: ["Review the detailed risk scores above"]
      };
    } catch (error) {
      console.error('Error parsing table data:', error);
      return {
        risk_scores: {
          data_risk: 0,
          user_rights_score: 0,
          readability_score: 0,
          overall_risk: 0,
          termination_risk: 0
        },
        risk_level: 'unknown',
        summary: "Analysis completed",
        data_collection: ["Analysis data available"],
        user_rights: ["User rights data available"],
        recommendations: ["Please review the analysis results"]
      };
    }
  };

  const extractScore = (line) => {
    const match = line.match(/(\d+(\.\d+)?)\/10/);
    return match ? parseFloat(match[1]) : 0;
  };

  const getRiskLevel = (score) => {
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      handlePdfUpload(file);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      handlePdfUpload(file);
    } else {
      setError('Please drop a valid PDF file');
    }
  };

  const getRiskColor = (score) => {
    if (score >= 7) return '#ff4757';
    if (score >= 4) return '#ffa502';
    return '#2ed573';
  };

  const riskChartData = analysis ? [
    { name: 'Data Risk', score: analysis.risk_scores?.data_risk || 0, color: getRiskColor(analysis.risk_scores?.data_risk || 0) },
    { name: 'User Rights', score: analysis.risk_scores?.user_rights_score || 0, color: getRiskColor(10 - (analysis.risk_scores?.user_rights_score || 0)) },
    { name: 'Termination Risk', score: analysis.risk_scores?.termination_risk || 0, color: getRiskColor(analysis.risk_scores?.termination_risk || 0) },
    { name: 'Readability', score: analysis.risk_scores?.readability_score || 0, color: getRiskColor(10 - (analysis.risk_scores?.readability_score || 0)) }
  ] : [];

  return (
    <div className="analysis-container">
      <div className="analysis-header-card">
        <h1 className="analysis-title">Analyze Terms & Conditions</h1>
        <p className="analysis-subtitle">Multiple ways to analyze terms - choose your preferred method</p>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <div className="analysis-methods-grid">
          {/* Company Selection */}
          <div className="method-card">
            <label className="method-label">🎯 Analyze Company</label>
            <select 
              className="method-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">Choose a company...</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} (ID: {company.id})
                </option>
              ))}
            </select>
            <div className="method-info">
              {companies.length} companies loaded
            </div>
            <button 
              className="btn btn-neon-green method-btn"
              onClick={() => analyzeCompany(selectedCompany)}
              disabled={!selectedCompany || loading}
            >
              {loading ? '🔍 Analyzing...' : '🚀 Analyze Company'}
            </button>
          </div>

          {/* PDF Upload */}
          <div className="method-card">
            <label className="method-label">📄 Upload PDF</label>
            <div 
              className={`file-upload-area ${isDragging ? 'dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('pdf-upload').click()}
            >
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="file-upload-icon">📄</div>
              <h4>Upload PDF Terms</h4>
              <p className="file-upload-text">
                Drag & drop or click to upload
              </p>
              {pdfFile && (
                <div className="file-selected">
                  📎 {pdfFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Custom URL */}
          <div className="method-card">
            <label className="method-label">🌐 Custom URL</label>
            <input
              type="url"
              className="method-input"
              placeholder="https://example.com/terms"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <button 
              className="btn btn-secondary method-btn"
              onClick={analyzeCustomUrl}
              disabled={!customUrl || loading}
            >
              {loading ? '🔍 Analyzing...' : '🌐 Analyze URL'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>AI is analyzing terms and conditions...</p>
          <p className="loading-subtext">This may take 10-30 seconds</p>
        </div>
      )}

      {analysis && (
        <div className="analysis-results-container">
          {/* Risk Overview */}
          <div className="results-card">
            <h2 className="results-title">Risk Overview</h2>
            <div className="risk-cards-grid">
              <div className="risk-card">
                <h4>Overall Risk</h4>
                <div className={`risk-score-display ${analysis.risk_level}`}>
                  {analysis.risk_scores?.overall_risk}/10
                </div>
                <div className={`risk-badge ${analysis.risk_level}`}>
                  {analysis.risk_level?.toUpperCase()} Risk
                </div>
              </div>
              
              <div className="risk-card">
                <h4>Data Collection</h4>
                <div className={`risk-score-display ${getRiskLevel(analysis.risk_scores?.data_risk)}`}>
                  {analysis.risk_scores?.data_risk}/10
                </div>
              </div>
              
              <div className="risk-card">
                <h4>User Rights</h4>
                <div className={`risk-score-display ${getRiskLevel(10 - (analysis.risk_scores?.user_rights_score || 0))}`}>
                  {analysis.risk_scores?.user_rights_score}/10
                </div>
              </div>
              
              <div className="risk-card">
                <h4>Readability</h4>
                <div className={`risk-score-display ${getRiskLevel(10 - (analysis.risk_scores?.readability_score || 0))}`}>
                  {analysis.risk_scores?.readability_score}/10
                </div>
              </div>
            </div>

            {/* Risk Chart */}
            {riskChartData.length > 0 && (
              <div className="risk-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
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
                    <Bar dataKey="score" name="Risk Score">
                      {riskChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Summary */}
          {analysis.summary && (
            <div className="results-card">
              <h2 className="results-title">Summary</h2>
              <div className="summary-content">
                <p className="summary-text">{analysis.summary}</p>
              </div>
            </div>
          )}

          {/* Data Collection */}
          {analysis.data_collection && analysis.data_collection.length > 0 && (
            <div className="results-card">
              <h2 className="results-title">Data Collection</h2>
              <div className="list-content">
                <ul className="data-list">
                  {analysis.data_collection.map((item, index) => (
                    <li key={index} className="data-item">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* User Rights */}
          {analysis.user_rights && analysis.user_rights.length > 0 && (
            <div className="results-card">
              <h2 className="results-title">User Rights</h2>
              <div className="list-content">
                <ul className="rights-list">
                  {analysis.user_rights.map((right, index) => (
                    <li key={index} className="rights-item">
                      {right}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="results-card">
              <h2 className="results-title">Recommendations</h2>
              <div className="recommendations-content">
                <div className="recommendations-list">
                  {analysis.recommendations.map((rec, index) => (
                    <div key={index} className="recommendation-item">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Source Info */}
          <div className="source-info-card">
            <small>
              <strong>Analysis Source:</strong> {analysis.source || 'AI Analysis'} | 
              <strong> AI Provider:</strong> {analysis.ai_provider || 'Ollama'}
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;