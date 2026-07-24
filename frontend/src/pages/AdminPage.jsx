import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopbarBrand from '../components/TopbarBrand';

function createEntry() {
  return { key: '', value: '' };
}

const MODULE_OPTIONS = [
  'testcase',
  'bug reporter',
  'log task'
];

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('admin_authed') === 'true');
  const [currentSection, setCurrentSection] = useState('dashboard'); // 'dashboard', 'global-settings', 'user-settings'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [entries, setEntries] = useState([createEntry()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    modules: [],
    jiraApiToken: '',
    jiraProjectKey: '',
    authorAccountId: '',
    tempoToken: ''
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authenticated) {
      loadEntries();
      loadUsers();
    }
  }, [authenticated]);

  function getAdminAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadEntries() {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/api/admin/env', {
        headers: getAdminAuthHeaders()
      });
      const nextEntries = response.data?.entries?.length ? response.data.entries.map((entry) => ({ key: entry.key, value: entry.value })) : [createEntry()];
      setEntries(nextEntries);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load environment variables');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const response = await axios.get('http://localhost:3000/api/admin/users', {
        headers: getAdminAuthHeaders()
      });
      setUsers(response.data?.users || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load users');
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:3000/api/admin/login', { username, password });
      const token = response.data?.token;

      localStorage.setItem('admin_authed', 'true');
      if (token) {
        localStorage.setItem('admin_token', token);
      }

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

  const toggleModule = (moduleName) => {
    setUserForm((currentForm) => {
      const nextModules = currentForm.modules.includes(moduleName)
        ? currentForm.modules.filter((value) => value !== moduleName)
        : [...currentForm.modules, moduleName];

      return { ...currentForm, modules: nextModules };
    });
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      modules: [],
      jiraApiToken: '',
      jiraProjectKey: '',
      authorAccountId: '',
      tempoToken: ''
    });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        ...userForm,
        jira_api_token: userForm.jiraApiToken,
        jira_project_key: userForm.jiraProjectKey,
        author_account_id: userForm.authorAccountId,
        tempo_token: userForm.tempoToken,
      };

      if (editingUserId) {
        await axios.put(
          `http://localhost:3000/api/admin/users/${editingUserId}`,
          payload,
          { headers: getAdminAuthHeaders() }
        );

        setMessage('User updated successfully.');
      } else {
        await axios.post(
          'http://localhost:3000/api/admin/users',
          payload,
          { headers: getAdminAuthHeaders() }
        );

        setMessage('User created successfully.');
      }

      resetUserForm();
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || (editingUserId ? 'Unable to update user' : 'Unable to create user'));
    } finally {
      setLoading(false);
    }
  };

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      modules: Array.isArray(user.modules) ? user.modules : [],
      jiraApiToken: user.jira_api_token || '',
      jiraProjectKey: user.jira_project_key || '',
      authorAccountId: user.author_account_id || '',
      tempoToken: user.tempo_token || ''
    });
    setMessage('');
    setError('');
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      await axios.delete(`http://localhost:3000/api/admin/users/${userId}`, {
        headers: getAdminAuthHeaders()
      });

      if (editingUserId === userId) {
        resetUserForm();
      }

      setMessage('User deleted successfully.');
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete user');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_authed');
    localStorage.removeItem('admin_token');
    setAuthenticated(false);
    setUsername('');
    setPassword('');
    setEntries([createEntry()]);
    setMessage('');
    setCurrentSection('dashboard');
    navigate('/');
  };

  // Main admin dashboard with cards
  if (authenticated && currentSection === 'dashboard') {
    return (
      <div className="dashboard-page admin-env-page">
        <div className="dashboard-topbar">
          <TopbarBrand label="Administrator Dashboard" />
          <div className="topbar-right">
            <button className="topbar-logout" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="dashboard-content admin-env-content">
          <div className="dashboard-header admin-env-header">
            <span className="dashboard-pill">Admin Portal</span>
            <h1>Welcome to the Admin Dashboard</h1>
            <p>Manage system-wide settings and user accounts from one central location.</p>
          </div>

          <div className="admin-cards-grid">
            {/* Global Settings Card */}
            <div className="admin-card" onClick={() => setCurrentSection('global-settings')}>
              <div className="admin-card-icon global">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <h2>Global Settings</h2>
              <p>Manage backend environment variables for all integrations including Gemini, Jira, and Tempo.</p>
              <button className="admin-card-button">Access Settings</button>
            </div>

            {/* User Settings Card */}
            <div className="admin-card" onClick={() => setCurrentSection('user-settings')}>
              <div className="admin-card-icon users">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h2>User Settings</h2>
              <p>View, create, and manage user accounts. Handle environment credentials for each team member.</p>
              <button className="admin-card-button">Manage Users</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login page for admin authentication (only shown if not authenticated)
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

  // Global Settings Page (formerly the main environment settings page)
  if (authenticated && currentSection === 'global-settings') {
    return (
      <div className="dashboard-page admin-env-page">
        <div className="dashboard-topbar">
          <button className="back-button" onClick={() => setCurrentSection('dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Dashboard
          </button>
          <TopbarBrand label="Global Settings" />
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

  // User Settings Page
  if (authenticated && currentSection === 'user-settings') {
    return (
      <div className="dashboard-page admin-env-page">
        <div className="dashboard-topbar">
          <button className="back-button" onClick={() => setCurrentSection('dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Dashboard
          </button>
          <TopbarBrand label="User Settings" />
          <div className="topbar-right">
            <button className="topbar-logout" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="dashboard-content admin-env-content">
          <div className="dashboard-header admin-env-header">
            <span className="dashboard-pill">User Management</span>
            <h1>Manage User Accounts</h1>
            <p>Create users and assign the modules they are allowed to access.</p>
          </div>

          <form className="admin-env-card" onSubmit={handleCreateUser}>
            <div className="admin-env-toolbar">
              <div>
                <h2>{editingUserId ? 'Edit User' : 'Create User'}</h2>
                <p>Enter a username, email, password, and choose the modules this user can access.</p>
              </div>
              {editingUserId && (
                <div className="admin-env-actions">
                  <button type="button" className="settings-reset-btn" onClick={resetUserForm}>Cancel Edit</button>
                </div>
              )}
            </div>

            {message && <div className="admin-notice success">{message}</div>}
            {error && <div className="admin-notice error">{error}</div>}

            <div className="admin-env-list">
              <div className="admin-env-row">
                <input
                  className="login-input"
                  placeholder="User Name"
                  value={userForm.name}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                />
                <input
                  className="login-input"
                  placeholder="Email"
                  value={userForm.email}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
                />
                <input
                  className="login-input"
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, password: event.target.value }))}
                />
              </div>

              <div className="admin-env-row">
                <input
                  className="login-input"
                  placeholder="Jira API Token"
                  value={userForm.jiraApiToken}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, jiraApiToken: event.target.value }))}
                />
                <input
                  className="login-input"
                  placeholder="Jira Project Key"
                  value={userForm.jiraProjectKey}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, jiraProjectKey: event.target.value }))}
                />
                <input
                  className="login-input"
                  placeholder="Author Account ID"
                  value={userForm.authorAccountId}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, authorAccountId: event.target.value }))}
                />
                <input
                  className="login-input"
                  placeholder="Tempo Token"
                  value={userForm.tempoToken}
                  onChange={(event) => setUserForm((currentForm) => ({ ...currentForm, tempoToken: event.target.value }))}
                />
              </div>

              <div className="admin-env-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'center' }}>
                {MODULE_OPTIONS.map((moduleName) => (
                  <label key={moduleName} className="login-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={userForm.modules.includes(moduleName)}
                      onChange={() => toggleModule(moduleName)}
                    />
                    {moduleName}
                  </label>
                ))}
              </div>

              <div className="admin-env-actions">
                <button type="submit" className="settings-save-btn" disabled={loading}>
                  {loading ? 'Saving…' : (editingUserId ? 'Update User' : 'Create User')}
                </button>
              </div>
            </div>
          </form>

          <div className="admin-env-card" style={{ marginTop: '16px' }}>
            <div className="admin-env-toolbar">
              <div>
                <h2>Created Users</h2>
                <p>Users currently stored in the system and the modules they are allowed to access.</p>
              </div>
            </div>

            <div className="admin-env-list">
              {users.length === 0 ? (
                <p className="login-footer">No users created yet.</p>
              ) : (
                users.map((user) => (
                  <div className="admin-env-row" key={user.id}>
                    <div>
                      <strong>{user.name || 'Unnamed User'}</strong><br />
                      <span>{user.email}</span>
                    </div>
                    <div>
                      <strong>Modules:</strong><br />
                      <span>{user.modules?.length ? user.modules.join(', ') : 'No modules assigned'}</span>
                    </div>
                    <div className="admin-env-actions">
                      <button type="button" className="settings-save-btn" onClick={() => startEditUser(user)}>Edit</button>
                      <button type="button" className="settings-reset-btn remove-btn" onClick={() => handleDeleteUser(user.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should never reach here)
  return null;
}