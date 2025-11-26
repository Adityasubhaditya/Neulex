import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-content">
        <div className="logo">
          <i className="fas fa-shield-alt"></i>
          T&C Analyzer
        </div>
        <ul className="nav-links">
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link></li>
          <li><Link to="/analyze" className={location.pathname === '/analyze' ? 'active' : ''}>Analyze</Link></li>
          <li><Link to="/compare" className={location.pathname === '/compare' ? 'active' : ''}>Compare</Link></li>
          <li><Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>History</Link></li>
          <li><Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;