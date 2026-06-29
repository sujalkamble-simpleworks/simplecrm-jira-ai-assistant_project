import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('http://localhost:3000/api/save-email', { email });
      localStorage.setItem('jira_email', email);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
              <path d="M12 20l5 5 11-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-title">SimpleCRM</h1>
          <p className="login-subtitle">Jira AI Assistant</p>
        </div>

        {/* Divider */}
        <div className="login-divider"></div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="jira-email">
            Jira Account Email
          </label>
          <div className="input-wrapper">
            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 7l-10 6L2 7"/>
            </svg>
            <input
              id="jira-email"
              type="email"
              placeholder="you@company.atlassian.net"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={loading}
              autoFocus
              className="login-input"
            />
          </div>

          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? (
              <span className="login-spinner"></span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Connect to Jira
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          We'll save your email to configure the Jira integration.
        </p>
      </div>
    </div>
  );
}
