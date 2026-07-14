import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import TopbarBrand from '../components/TopbarBrand';

export default function Dashboard() {
  const navigate = useNavigate();
  const [email] = useState(() => localStorage.getItem('jira_email') || '');
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef(null);

  useEffect(() => {
    if (!email) {
      navigate('/');
    }
  }, [email, navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aboutOpen && aboutRef.current && !aboutRef.current.contains(event.target)) {
        setAboutOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && aboutOpen) {
        setAboutOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [aboutOpen]);

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
        <TopbarBrand label="SimpleCRM" />
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
          <div className="dashboard-pill">Jira workspace</div>
          <h1>What would you like to do?</h1>
          <p>Choose a workflow to keep engineering work moving from one place.</p>
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

          <div className="action-card action-card-active" onClick={() => navigate('/testcases')}>
            <div className="action-card-icon action-icon-tempo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
                <path d="M7 6v12" />
              </svg>
            </div>
            <h2>Testcases generation (for QA)</h2>
            <p>Generate QA test cases from simple scenario text using AI and structured output.</p>
            <div className="action-card-footer">
              <span className="action-badge action-badge-active">Available</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </div>
        </div>

      </div>

      <footer className="dashboard-footer">
        <div ref={aboutRef} className={`about-hover-wrapper ${aboutOpen ? 'about-open' : ''}`}>
          <button
            type="button"
            className="footer-about-label"
            onClick={() => setAboutOpen((open) => !open)}
            aria-expanded={aboutOpen}
            aria-controls="about-card"
          >
            About
          </button>
          <div className="about-hover-card" id="about-card" role="dialog" aria-hidden={!aboutOpen}>
            <strong>Sujal Kamble</strong>
            <p>SDET at Simple Works.</p>
            <div className="about-links">
              <a href="https://www.instagram.com/sujallkamble" target="_blank" rel="noreferrer">Instagram</a>
              <a href="https://www.linkedin.com/in/sujalkamble741" target="_blank" rel="noreferrer">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
