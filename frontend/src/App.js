import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Analysis from './components/Analysis';
import Comparison from './components/Comparison';
import History from './components/History';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [userProfile, setUserProfile] = useState({
    riskTolerance: 'medium',
    dataConcerns: ['data_collection', 'data_sharing'],
    location: 'US'
  });

  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard userProfile={userProfile} />} />
            <Route path="/analyze" element={<Analysis userProfile={userProfile} />} />
            <Route path="/compare" element={<Comparison />} />
            <Route path="/history" element={<History />} />
            <Route 
              path="/profile" 
              element={<Profile userProfile={userProfile} setUserProfile={setUserProfile} />} 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;