import { useEffect, useState } from 'react';
import TopbarBrand from '../components/TopbarBrand';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function TestcasesPage() {
  const [email] = useState(() => localStorage.getItem('jira_email') || '');
  const [scenario, setScenario] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSheetConnected, setIsSheetConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [sheetWriteError, setSheetWriteError] = useState(null);
  const [testcaseHistory, setTestcaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyClearing, setHistoryClearing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!email) {
      navigate('/');
      return;
    }
    loadSpreadsheetId();
    loadTestcaseHistory();
  }, [email, navigate]);

  async function loadSpreadsheetId() {
    try {
      const response = await axios.get('http://localhost:3000/api/spreadsheet-id');
      const savedId = response.data.spreadsheetId || '';
      setSpreadsheetId(savedId);
      setIsSheetConnected(Boolean(savedId));
    } catch (err) {
      console.warn('Could not load spreadsheet ID', err);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('jira_email');
    navigate('/');
  };

  const handleConnectSpreadsheet = async () => {
    if (!spreadsheetId.trim()) {
      setSettingsError('Please provide a valid spreadsheet ID.');
      setIsSheetConnected(false);
      return;
    }

    setConnecting(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      const response = await axios.post('http://localhost:3000/api/save-spreadsheet', {
        spreadsheetId: spreadsheetId.trim(),
      });
      setSettingsMessage(`Connected to spreadsheet ${response.data.spreadsheetId}`);
      setIsSheetConnected(true);
    } catch (err) {
      setSettingsError(err.response?.data?.error || 'Unable to connect to the spreadsheet.');
      setIsSheetConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  async function loadTestcaseHistory() {
    setHistoryLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/api/testcase-history');
      setTestcaseHistory(response.data.history || []);
    } catch (err) {
      console.warn('Could not load testcase history', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  const clearHistory = async () => {
    setHistoryClearing(true);
    try {
      await axios.post('http://localhost:3000/api/clear-testcase-history');
      setTestcaseHistory([]);
      setIsHistoryOpen(false);
    } catch (err) {
      console.warn('Could not clear history', err);
    } finally {
      setHistoryClearing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!scenario.trim()) return;

    setLoading(true);
    setError(null);
    setSheetStatus(null);
    setSheetWriteError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:3000/api/generate-testcase', {
        scenario: scenario.trim(),
      });

      setResult(response.data.data);
      setSheetStatus(response.data.sheetResult || null);
      setSheetWriteError(response.data.sheetError || null);
      setScenario('');
      loadTestcaseHistory();
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || err.message || 'Unable to generate test case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="logtask-page">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <div className="dashboard-topbar">
        <TopbarBrand label="QA Testcase Generator" />
        <div className="topbar-right">
          <button className="settings-reset-btn" onClick={() => setSettingsOpen((open) => !open)}>
            {settingsOpen ? 'Hide settings' : 'Spreadsheet settings'}
          </button>
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
        </div>
      </div>

      {settingsOpen && (
        <div className="spreadsheet-panel">
          <div className="spreadsheet-panel-header">
            <div>
              <h2>Spreadsheet connection</h2>
              <p>Enter the Google Sheets spreadsheet ID and connect it for test case export or storage.</p>
            </div>
            <span className={`action-badge ${isSheetConnected ? 'action-badge-active' : 'action-badge-future'}`}>
              {isSheetConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

              <div className="spreadsheet-panel-form">
            <input
              type="text"
              className="login-input"
              placeholder="Spreadsheet ID"
              value={spreadsheetId}
              onChange={(event) => {
                setSpreadsheetId(event.target.value);
                setSettingsError(null);
                setSettingsMessage(null);
                setIsSheetConnected(false);
              }}
            />
            <button
              type="button"
              className="settings-save-btn"
              onClick={handleConnectSpreadsheet}
              disabled={connecting}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>

          {settingsMessage && <div className="admin-notice success">{settingsMessage}</div>}
          {settingsError && <div className="admin-notice error">{settingsError}</div>}
        </div>
      )}

      <div className="logtask-layout">
        <div className="logtask-container">
          <div className="logtask-card">
            <div className="logtask-header">
              <div className="logtask-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="logtask-pill">QA Testcases</div>
                <h1>AI test case generation</h1>
                <p>Enter a QA scenario and generate a structured test case for your workflow.</p>
              </div>
            </div>

            <div className="history-toolbar-row">
              <button
                type="button"
                className="history-toggle-btn"
                onClick={() => setIsHistoryOpen(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v5l3 3" />
                  <path d="M21 12a9 9 0 11-9-9" />
                </svg>
                History
              </button>
              {testcaseHistory.length > 0 && (
                <p className="history-idea-text">
                  Idea: {testcaseHistory[0].Subject || testcaseHistory[0].Scenario || 'Recent generated test case'}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="logtask-form">
              <label className="logtask-label" htmlFor="scenario-input">
                Describe the scenario you want to convert into a test case
              </label>
              <textarea
                id="scenario-input"
                className="logtask-textarea"
                rows="5"
                placeholder="e.g., User tries to create a contact without a required email address."
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="logtask-submit">
                {loading ? (
                  <>
                    <span className="login-spinner"></span>
                    Generating test case...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                    Generate test case
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

            {sheetWriteError && (
              <div className="logtask-error">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <div>
                  <strong>Sheet write failed:</strong> {sheetWriteError}
                </div>
              </div>
            )}

            {sheetStatus && (
              <div className="logtask-success">
                <div className="logtask-success-header">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {sheetStatus}
                </div>
              </div>
            )}

            {result && (
              <div className="logtask-success">
                <div className="logtask-success-header">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Test case generated successfully
                </div>
                <div className="logtask-result-grid">
                  {Object.entries(result).map(([key, value]) => (
                    <div className="result-item" key={key}>
                      <span className="result-label">{key}</span>
                      <span className="result-value">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`history-overlay ${isHistoryOpen ? 'history-overlay-open' : ''}`}>
        <div className="history-overlay-backdrop" onClick={() => setIsHistoryOpen(false)} />
        <div className="history-overlay-panel">
          <div className="history-overlay-header">
            <div>
              <h3>Testcase history</h3>
              <p>Similar scenario ideas from your recent generations.</p>
            </div>
            <div className="history-sidebar-actions">
              <button
                type="button"
                className="history-sidebar-clear"
                onClick={clearHistory}
                disabled={historyClearing}
              >
                {historyClearing ? 'Clearing…' : 'Clear'}
              </button>
              <button
                type="button"
                className="history-sidebar-close"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Close history panel"
              >
                ×
              </button>
            </div>
          </div>

          {historyLoading ? (
            <p>Loading history…</p>
          ) : testcaseHistory.length === 0 ? (
            <p>No history yet. Generate a test case to build a reference list.</p>
          ) : (
            <div className="history-list">
              {testcaseHistory.map((entry, index) => (
                <div className="history-item" key={`history-${index}`}>
                  <div className="history-item-header">
                    <span>Case #{testcaseHistory.length - index}</span>
                    <span>{entry.Subject || 'Untitled subject'}</span>
                  </div>
                  <div className="history-item-body">
                    <div><strong>Scenario:</strong> {entry.Scenario || '—'}</div>
                    <div><strong>Priority:</strong> {entry.Priority || '—'}</div>
                    <div><strong>Status:</strong> {entry.TestStatus || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
