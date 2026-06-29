import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('jira_email');
    if (!savedEmail) {
      navigate('/');
      return;
    }
    setEmail(savedEmail);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('jira_email');
    navigate('/');
  };

  return (
    <div className="dashboard-page">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      {/* Top bar */}
      <div className="dashboard-topbar">
        <div className="topbar-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#logo-grad2)" />
            <path d="M12 20l5 5 11-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="logo-grad2" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#6366f1"/>
                <stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
          <span>SimpleCRM</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-email">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {email}
          </div>
          <button onClick={handleLogout} className="topbar-logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Disconnect
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>What would you like to do?</h1>
          <p>Choose an action to get started with your Jira workflow</p>
        </div>

        <div className="dashboard-cards">
          {/* Log Task in Tempo - Active */}
          <div className="action-card action-card-active" onClick={() => navigate('/log-task')}>
            <div className="action-card-icon action-icon-tempo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Log Task in Tempo</h2>
            <p>Use AI to generate professional worklogs and log them directly to Tempo with a single prompt.</p>
            <div className="action-card-footer">
              <span className="action-badge action-badge-active">Available</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </div>

          <div className="action-card action-card-active" onClick={() => navigate('/bug-reporter')}>
            <div className="action-card-icon action-icon-bug">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1"/>
                <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z"/>
                <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M6 17l-4 1M17.47 9c1.93-.2 3.53-1.9 3.53-4M18 13h4M18 17l4 1"/>
              </svg>
            </div>
            <h2>Create Bug</h2>
            <p>File bug reports with AI-assisted issue extraction, priority detection, and a review step.</p>
            <div className="action-card-footer">
              <span className="action-badge action-badge-active">Beta</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
