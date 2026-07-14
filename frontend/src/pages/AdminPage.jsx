import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopbarBrand from '../components/TopbarBrand';

function createEntry() {
  return { key: '', value: '' };
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('admin_authed') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [entries, setEntries] = useState([createEntry()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (authenticated) {
      loadEntries();
    }
  }, [authenticated]);

  async function loadEntries() {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/api/admin/env');
      const nextEntries = response.data?.entries?.length ? response.data.entries.map((entry) => ({ key: entry.key, value: entry.value })) : [createEntry()];
      setEntries(nextEntries);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load environment variables');
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('http://localhost:3000/api/admin/login', { username, password });
      localStorage.setItem('admin_authed', 'true');
      setAuthenticated(true);
      setMessage('Admin access granted.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEntries = entries
        .filter((entry) => entry.key.trim())
        .map((entry) => ({ key: entry.key.trim(), value: entry.value }));

      if (!normalizedEntries.length) {
        setError('Add at least one environment variable before saving.');
        setLoading(false);
        return;
      }

      await axios.post('http://localhost:3000/api/admin/env', { entries: normalizedEntries });
      setMessage('Environment settings saved to the backend .env file.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save environment variables');
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index, field, value) => {
    setEntries((currentEntries) => currentEntries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: value } : entry
    )));
  };

  const addEntry = () => {
    setEntries((currentEntries) => [...currentEntries, createEntry()]);
  };

  const removeEntry = (index) => {
    setEntries((currentEntries) => currentEntries.filter((_, entryIndex) => entryIndex !== index));
  };

  const logout = () => {
    localStorage.removeItem('admin_authed');
    setAuthenticated(false);
    setUsername('');
    setPassword('');
    setEntries([createEntry()]);
    setMessage('');
    navigate('/');
  };

  if (!authenticated) {
    return (
      <div className="login-page admin-page">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>

        <div className="login-card admin-card">
          <div className="login-brand">
            <div className="login-logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#admin-logo)" />
                <path d="M12 20h16M20 12l8 8-8 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="admin-logo" x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor="#06b6d4" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="login-title">Administrator Access</h1>
            <p className="login-subtitle">Secure credentials and environment configuration.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <label className="login-label" htmlFor="admin-username">Username</label>
            <div className="input-wrapper">
              <input
                id="admin-username"
                type="text"
                className="login-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter administrator username"
                required
              />
            </div>

            <label className="login-label" htmlFor="admin-password">Password</label>
            <div className="input-wrapper">
              <input
                id="admin-password"
                type="password"
                className="login-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login-footer">Authorized users can update backend environment variables for the Gemini, Jira, and Tempo integrations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page admin-env-page">
      <div className="dashboard-topbar">
        <TopbarBrand label="Environment Manager" />
        <div className="topbar-right">
          <button className="topbar-logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="dashboard-content admin-env-content">
        <div className="dashboard-header admin-env-header">
          <span className="dashboard-pill">Configuration</span>
          <h1>Backend environment settings</h1>
          <p>Update and maintain the values used for Gemini, Jira, and Tempo integrations in the backend.</p>
        </div>

        <form className="admin-env-card" onSubmit={handleSave}>
          <div className="admin-env-toolbar">
            <div>
              <h2>Environment variables</h2>
              <p>Save only the values required by your backend integrations. Sensitive credentials are stored server-side.</p>
            </div>
            <div className="admin-env-actions">
              <button type="button" className="settings-reset-btn" onClick={loadEntries}>Reload</button>
              <button type="button" className="settings-save-btn" onClick={addEntry}>Add variable</button>
              <button type="submit" className="settings-save-btn">Save changes</button>
            </div>
          </div>

          {message && <div className="admin-notice success">{message}</div>}
          {error && <div className="admin-notice error">{error}</div>}

          <div className="admin-env-list">
            {entries.map((entry, index) => (
              <div className="admin-env-row" key={`${entry.key || 'new'}-${index}`}>
                <input
                  className="login-input"
                  placeholder="Variable name"
                  value={entry.key}
                  onChange={(event) => updateEntry(index, 'key', event.target.value)}
                />
                <input
                  className="login-input"
                  placeholder="Value"
                  value={entry.value}
                  onChange={(event) => updateEntry(index, 'value', event.target.value)}
                />
                <button type="button" className="settings-reset-btn remove-btn" onClick={() => removeEntry(index)}>Remove</button>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
