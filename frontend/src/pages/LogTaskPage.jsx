import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LogTaskPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:3000/api/log-work', {
        userInput: input,
      });
      setResult(response.data);
      setInput('');
    } catch (err) {
      setError(err.response?.data?.details || err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="logtask-page">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      {/* Top bar */}
      <div className="dashboard-topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-mark">J</div>
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
          <span>SimpleCRM Workspace</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-email">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
             </svg>
             {email}
           </div>
          <button onClick={() => navigate('/dashboard')} className="topbar-logout" style={{ marginRight: '8px' }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
             </svg>
             Back
           </button>
           <button onClick={handleLogout} className="topbar-logout">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
             </svg>
             Disconnect
           </button>
        </div>
      </div>

      <div className="logtask-container">

        <div className="logtask-card">
          <div className="logtask-header">
            <div className="logtask-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div className="logtask-pill">Tempo • Jira-ready</div>
              <h1>AI Tempo Worklog Assistant</h1>
              <p>Describe your work and we’ll generate a professional Tempo worklog in seconds.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="logtask-form">
            <label className="logtask-label" htmlFor="work-input">
              What did you work on today?
            </label>
            <textarea
              id="work-input"
              className="logtask-textarea"
              rows="4"
              placeholder="e.g., Worked 2 hours on PROD-5746 from 10am fixing dropdown duplicate issue."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading} className="logtask-submit">
              {loading ? (
                <>
                  <span className="login-spinner"></span>
                  Processing & Logging...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                  Generate & Log Worklog
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="logtask-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <div>
                <strong>Error:</strong> {JSON.stringify(error)}
              </div>
            </div>
          )}

          {result && (
            <div className="logtask-success">
              <div className="logtask-success-header">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Worklog Logged Successfully
              </div>
              <div className="logtask-result-grid">
                <div className="result-item">
                  <span className="result-label">Issue</span>
                  <span className="result-value">{result.issueKey}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Duration</span>
                  <span className="result-value">{result.duration}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Start Time</span>
                  <span className="result-value">{result.startTime}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Tempo ID</span>
                  <span className="result-value">{result.tempoWorklogId}</span>
                </div>
              </div>
              <div className="logtask-description">
                <span className="result-label">Generated Description</span>
                <p>{result.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}