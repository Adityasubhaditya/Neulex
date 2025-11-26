import React, { useState } from 'react';

const Profile = ({ userProfile, setUserProfile }) => {
  const [formData, setFormData] = useState(userProfile);

  const handleSubmit = (e) => {
    e.preventDefault();
    setUserProfile(formData);
    alert('Profile updated successfully!');
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleConcern = (concern) => {
    setFormData(prev => ({
      ...prev,
      dataConcerns: prev.dataConcerns.includes(concern)
        ? prev.dataConcerns.filter(c => c !== concern)
        : [...prev.dataConcerns, concern]
    }));
  };

  return (
    <div className="profile">
      <div className="card">
        <h1>User Profile</h1>
        <p>Customize your privacy preferences for personalized analysis</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Risk Tolerance</label>
            <select 
              className="form-select"
              value={formData.riskTolerance}
              onChange={(e) => handleChange('riskTolerance', e.target.value)}
            >
              <option value="low">Low - Prefer maximum privacy</option>
              <option value="medium">Medium - Balanced approach</option>
              <option value="high">High - More flexible with data sharing</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Data Concerns</label>
            <div className="concerns-grid">
              {['data_collection', 'data_sharing', 'data_retention', 'cookies', 'third_party'].map(concern => (
                <label key={concern} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.dataConcerns.includes(concern)}
                    onChange={() => toggleConcern(concern)}
                  />
                  <span>{concern.replace(/_/g, ' ').toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <select 
              className="form-select"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
            >
              <option value="US">United States</option>
              <option value="EU">European Union</option>
              <option value="UK">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">
            Save Profile
          </button>
        </form>
      </div>

      <div className="card">
        <h2>How Your Profile Affects Analysis</h2>
        <ul>
          <li>📊 <strong>Risk Tolerance:</strong> Adjusts sensitivity of risk scoring</li>
          <li>🔍 <strong>Data Concerns:</strong> Highlights specific privacy issues you care about</li>
          <li>🌍 <strong>Location:</strong> Considers regional privacy laws (GDPR, CCPA, etc.)</li>
        </ul>
      </div>
    </div>
  );
};

export default Profile;