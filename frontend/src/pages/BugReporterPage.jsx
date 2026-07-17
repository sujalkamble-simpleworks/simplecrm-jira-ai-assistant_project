import { useEffect, useMemo, useState } from 'react';
import TopbarBrand from '../components/TopbarBrand';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const blankForm = {
  summary: '',
  description: '',
  acceptanceCriteria: '',
  stepsToReproduce: '',
  component: '',
  priority: '',
  labels: [],
  linkedWorkItem: '',
  linkedWorkType: 'blocks',
  account: '',
  bugType: 'New Bug',
  assigneeAccountId: '',
  assigneeName: '',
  reporter: 'self',
  workType: 'Bug',
  startDate: new Date().toISOString().split('T')[0],
};

const defaultLockedFields = {
  component: false,
  priority: false,
  linkedWorkItem: false,
  linkedWorkType: false,
  account: false,
  bugType: false,
  assigneeAccountId: false,
  assigneeName: false,
  startDate: false,
};

export default function BugReporterPage() {
  const navigate = useNavigate();
  const [email] = useState(() => localStorage.getItem('jira_email') || '');
  const [textareaValue, setTextareaValue] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/');
    }
  }, [email, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('jira_email');
    navigate('/');
  };

  const [formData, setFormData] = useState(blankForm);
  const [metadata, setMetadata] = useState({ components: [], priorities: [], labels: [], accounts: [], bugTypes: [], startDateFieldId: null });
  const [, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState([]);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lockedFields, setLockedFields] = useState(() => {
    const saved = localStorage.getItem('bugReporterLockedFields');
    return saved ? JSON.parse(saved) : { ...defaultLockedFields };
  });
  const [lockedValues, setLockedValues] = useState(() => {
    const saved = localStorage.getItem('bugReporterLockedValues');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/jira-metadata');
        setMetadata(response.data);
        
        // Apply locked values first, then defaults for unlocked fields
        setFormData((current) => {
          const updated = { ...current };
          // Apply locked values if they exist
          Object.keys(lockedValues).forEach(key => {
            if (lockedFields[key]) {
              updated[key] = lockedValues[key];
            }
          });
          // Set defaults only for fields that are not locked
          if (!lockedFields.account && !updated.account) {
            updated.account = response.data.accounts?.[0]?.id || '';
          }
          if (!lockedFields.bugType && !updated.bugType) {
            updated.bugType = response.data.bugTypes?.[0]?.value || 'New Bug';
          }
          if (updated.labels.length === 0) {
            updated.labels = ['bug'];
          }
          return updated;
        });
      } catch (err) {
        console.error(err);
      }
    };
    loadMetadata();
  }, [lockedFields, lockedValues]);

  // Save locked settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('bugReporterLockedFields', JSON.stringify(lockedFields));
    localStorage.setItem('bugReporterLockedValues', JSON.stringify(lockedValues));
  }, [lockedFields, lockedValues]);

  const toggleFieldLock = (field) => {
    setLockedFields(prev => {
      const newLocked = { ...prev, [field]: !prev[field] };
      // If we're locking the field, save its current value
      if (!prev[field]) {
        setLockedValues(prevValues => ({
          ...prevValues,
          [field]: formData[field]
        }));
      }
      return newLocked;
    });
  };

  const resetAllLocks = () => {
    setLockedFields({ ...defaultLockedFields });
    setLockedValues({});
    localStorage.removeItem('bugReporterLockedFields');
    localStorage.removeItem('bugReporterLockedValues');
  };

  const linkedEnum = useMemo(
    () => [
      { value: 'blocks', label: 'Blocks' },
      { value: 'is_blocked_by', label: 'Is blocked by' },
      { value: 'relates_to', label: 'Relates to' },
    ],
    []
  );

  const handleSuggestion = (value) => {
    setTextareaValue(value);
    setError(null);
    setSubmitResult(null);
    setPreviewVisible(false);
  };

  const handleParse = async (e) => {
    e.preventDefault();
    if (!textareaValue.trim()) return;
    setLoadingParse(true);
    setError(null);
    setSubmitResult(null);

    try {
      const response = await axios.post('http://localhost:3000/api/parse-bug', {
        userInput: textareaValue,
        metadata,
      });

      const mapAccountValueToId = (value) => {
        if (!value) return null;
        const normalized = String(value).trim().toLowerCase();
        const match = metadata.accounts.find((account) => account.id === value || account.value.toLowerCase() === normalized);
        return match ? match.id : value;
      };

      const mapBugTypeValue = (value) => {
        if (!value) return null;
        const normalized = String(value).trim().toLowerCase();
        const match = metadata.bugTypes.find((type) => type.value.toLowerCase() === normalized || type.id === value);
        return match ? match.value : value;
      };

      const parsed = {
        ...blankForm,
        ...response.data,
        workType: 'Bug',
        account: mapAccountValueToId(response.data.account) || formData.account || '',
        bugType: mapBugTypeValue(response.data.bugType) || formData.bugType || 'New Bug',
        reporter: 'self',
        startDate: response.data.startDate || formData.startDate || new Date().toISOString().split('T')[0],
      };

      if (!parsed.component && metadata.components.length > 0) {
        parsed.component = metadata.components[0];
      }
      if (!parsed.priority && metadata.priorities.length > 0) {
        parsed.priority = metadata.priorities[0];
      }
      if (!parsed.labels || parsed.labels.length === 0) {
        parsed.labels = metadata.labels.slice(0, 2);
      }
      if (!parsed.account && metadata.accounts.length > 0) {
        parsed.account = metadata.accounts[0].id;
      }
      if (!parsed.bugType && metadata.bugTypes.length > 0) {
        parsed.bugType = metadata.bugTypes[0].value;
      }
      if (!parsed.startDate && metadata.startDateFieldId) {
        parsed.startDate = new Date().toISOString().split('T')[0];
      }

      setFormData(parsed);
      setPreviewVisible(true);
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || err.message || 'Unable to parse bug request.');
    } finally {
      setLoadingParse(false);
    }
  };

  const handleChange = (field, value) => {
    // Only allow changes if the field is not locked
    if (!lockedFields[field]) {
      setFormData((current) => ({
        ...current,
        [field]: value,
      }));
    }
  };

  const handleAssigneeChange = async (value) => {
    setAssigneeSearch(value);
    setFormData((current) => ({
      ...current,
      assigneeName: value,
      assigneeAccountId: value === '' ? '' : current.assigneeAccountId,
    }));

    if (!value.trim()) {
      setAssigneeResults([]);
      return;
    }

    try {
      const response = await axios.get(`http://localhost:3000/api/user-search?q=${encodeURIComponent(value)}`);
      setAssigneeResults(response.data);
    } catch (err) {
      console.error('Assignee search failed', err.message || err);
      setAssigneeResults([]);
    }
  };

  const handleLabelsChange = (label) => {
    setFormData((current) => {
      const hasLabel = current.labels.includes(label);
      return {
        ...current,
        labels: hasLabel ? current.labels.filter((item) => item !== label) : [...current.labels, label],
      };
    });
  };

  const handleAssigneeSelect = (user) => {
    setFormData((current) => ({
      ...current,
      assigneeAccountId: user.accountId,
      assigneeName: user.displayName,
    }));
    setAssigneeSearch(user.displayName);
    setAssigneeResults([]);
  };

  const handleSubmit = async () => {
    setLoadingSubmit(true);
    setError(null);
    setSubmitResult(null);

    try {
      const payload = {
        summary: formData.summary,
        description: formData.description,
        acceptanceCriteria: formData.acceptanceCriteria,
        stepsToReproduce: formData.stepsToReproduce,
        component: formData.component,
        priority: formData.priority,
        labels: formData.labels,
        linkedWorkItem: formData.linkedWorkItem,
        linkedWorkType: formData.linkedWorkType,
        account: formData.account,
        bugType: formData.bugType,
        assigneeAccountId: formData.assigneeAccountId,
        startDate: formData.startDate,
        startDateFieldId: metadata.startDateFieldId,
      };

      const response = await axios.post('http://localhost:3000/api/create-bug', payload);
      setSubmitResult(response.data);
    } catch (err) {
      setError(err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to create bug.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="logtask-page">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      {/* Add top navigation bar with settings gear icon */}
      <div className="dashboard-topbar">
        <TopbarBrand label="Jira Bug Reporter" />
        <div className="topbar-right">
          <div className="topbar-email">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {email}
          </div>
          <button 
            onClick={() => setSettingsOpen(!settingsOpen)} 
            className="topbar-logout"
            style={{ marginRight: '8px' }}
            title="Field Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
          <button onClick={() => navigate('/dashboard')} className="topbar-logout" style={{ marginRight: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div 
          className="settings-modal-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <div 
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-header">
              <h2>Field Lock Settings</h2>
              <button 
                onClick={() => setSettingsOpen(false)}
                className="settings-close-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="settings-description">
              Lock fields to keep their values persistent across bug reports. Locked fields will be automatically filled and cannot be modified until unlocked.
            </p>
            
            <div className="settings-field-list">
              {[
                { key: 'component', label: 'Component' },
                { key: 'priority', label: 'Priority' },
                { key: 'linkedWorkItem', label: 'Linked Work Item' },
                { key: 'linkedWorkType', label: 'Link Type (Blocks/Is blocked by/Relates to)' },
                { key: 'account', label: 'Account' },
                { key: 'bugType', label: 'Bug Type' },
                { key: 'assigneeAccountId', label: 'Assignee' },
                { key: 'startDate', label: 'Start Date' },
              ].map(field => (
                <label 
                  key={field.key}
                  className={`settings-field-item ${lockedFields[field.key] ? 'locked' : 'unlocked'}`}
                >
                  <input
                    type="checkbox"
                    checked={lockedFields[field.key]}
                    onChange={() => toggleFieldLock(field.key)}
                    className="settings-field-checkbox"
                  />
                  <div className="settings-field-content">
                    <div className="settings-field-label">{field.label}</div>
                    {lockedFields[field.key] && lockedValues[field.key] && (
                      <div className="settings-field-locked-value">
                        Locked value: {lockedValues[field.key]}
                      </div>
                    )}
                  </div>
                  {lockedFields[field.key] && (
                    <svg className="settings-field-lock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  )}
                </label>
              ))}
            </div>
            
            <div className="settings-actions">
              <button 
                onClick={resetAllLocks}
                className="settings-reset-btn"
              >
                Reset All
              </button>
              <button 
                onClick={() => setSettingsOpen(false)}
                className="settings-save-btn"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="logtask-container" style={{ maxWidth: '900px', marginTop: '30px' }}>
        <div className="logtask-card">
          <div className="logtask-header">
            <div className="logtask-icon" style={{ background: 'rgba(249, 115, 22, 0.14)', color: '#f97316' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 9.5a5 5 0 0 111 0v2.5a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V9.5z"/>
                <path d="M8 13.5v4.5M16 13.5v4.5"/>
                <path d="M12 17.5v1.5"/>
              </svg>
            </div>
            <div>
              <h1>Bug Reporter</h1>
              <p>Use AI to fill a Jira-style bug ticket. Review the preview, then confirm to create the bug. Click the Settings icon in the top bar to lock frequently used fields.</p>
            </div>
          </div>

          <form onSubmit={handleParse} className="logtask-form">
            <label className="logtask-label" htmlFor="bug-input">
              Describe the bug in plain language
            </label>
            <textarea
              id="bug-input"
              className="logtask-textarea"
              rows="5"
              placeholder="E.g., Found a High priority bug in the authentication component..."
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              disabled={loadingParse || loadingSubmit}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              <button type="submit" disabled={loadingParse || loadingSubmit} className="logtask-submit">
                {loadingParse ? 'Parsing...' : 'Parse and Build Preview'}
              </button>
              <button
                type="button"
                onClick={() => handleSuggestion('Found a High priority bug in the authentication component. If you click login twice fast, the app crashes. Steps: open app, type creds, double click login button. Expected: it should just log you in once. This blocks PROD-5746. Add the ui-glitch label.')}
                className="logtask-submit"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
              >
                Use Example Prompt
              </button>
            </div>
          </form>

          {error && (
            <div className="logtask-error" style={{ marginTop: '18px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <div>
                <strong>Error:</strong> {String(error)}
              </div>
            </div>
          )}

          {previewVisible && (
            <div style={{ marginTop: '32px' }}>
              <div className="logtask-header" style={{ marginBottom: '20px' }}>
                <div className="logtask-icon" style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.14)', color: '#3b82f6' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M4 12h16M4 17h16"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>Preview Bug Ticket</h2>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Confirm the details below before creating the Jira bug.</p>
                </div>
              </div>

              <div className="bug-preview-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div>
                  <label className="logtask-label">Summary</label>
                  <input
                    className="logtask-textarea"
                    value={formData.summary}
                    onChange={(e) => handleChange('summary', e.target.value)}
                    disabled={loadingSubmit}
                  />
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
            Component *
            {lockedFields.component && (
              <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            )}
          </label>
          <select
            className={`logtask-textarea ${lockedFields.component ? 'locked-field-input' : ''}`}
            value={formData.component}
            onChange={(e) => handleChange('component', e.target.value)}
            disabled={loadingSubmit || lockedFields.component}
          >
                    <option value="">Select component</option>
                    {metadata.components.map((component) => (
                      <option key={component} value={component}>{component}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="logtask-label">Description</label>
                  <textarea
                    className="logtask-textarea"
                    rows="4"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    disabled={loadingSubmit}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="logtask-label">Acceptance Criteria</label>
                  <textarea
                    className="logtask-textarea"
                    rows="3"
                    value={formData.acceptanceCriteria}
                    onChange={(e) => handleChange('acceptanceCriteria', e.target.value)}
                    disabled={loadingSubmit}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="logtask-label">Steps to Reproduce</label>
                  <textarea
                    className="logtask-textarea"
                    rows="3"
                    value={formData.stepsToReproduce}
                    onChange={(e) => handleChange('stepsToReproduce', e.target.value)}
                    disabled={loadingSubmit}
                  />
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Priority
                    {lockedFields.priority && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <select
                    className={`logtask-textarea ${lockedFields.priority ? 'locked-field-input' : ''}`}
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    disabled={loadingSubmit || lockedFields.priority}
                  >
                    <option value="">Select priority</option>
                    {metadata.priorities.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Linked Work Item
                    {lockedFields.linkedWorkItem && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <input
                    className={`logtask-textarea ${lockedFields.linkedWorkItem ? 'locked-field-input' : ''}`}
                    value={formData.linkedWorkItem}
                    onChange={(e) => handleChange('linkedWorkItem', e.target.value)}
                    disabled={loadingSubmit || lockedFields.linkedWorkItem}
                    placeholder="PROD-5746"
                  />
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Link Type
                    {lockedFields.linkedWorkType && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <select
                    className={`logtask-textarea ${lockedFields.linkedWorkType ? 'locked-field-input' : ''}`}
                    value={formData.linkedWorkType}
                    onChange={(e) => handleChange('linkedWorkType', e.target.value)}
                    disabled={loadingSubmit || lockedFields.linkedWorkType}
                  >
                    {linkedEnum.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label">Reporter</label>
                  <input className="logtask-textarea" value="self" disabled />
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Account
                    {lockedFields.account && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <select
                    className={`logtask-textarea ${lockedFields.account ? 'locked-field-input' : ''}`}
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value)}
                    disabled={loadingSubmit || lockedFields.account}
                  >
                    <option value="">Select account</option>
                    {metadata.accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Bug Type
                    {lockedFields.bugType && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <select
                    className={`logtask-textarea ${lockedFields.bugType ? 'locked-field-input' : ''}`}
                    value={formData.bugType}
                    onChange={(e) => handleChange('bugType', e.target.value)}
                    disabled={loadingSubmit || lockedFields.bugType}
                  >
                    <option value="">Select bug type</option>
                    {metadata.bugTypes.map((type) => (
                      <option key={type.id} value={type.value}>{type.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Assignee
                    {lockedFields.assigneeAccountId && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <input
                    className={`logtask-textarea ${lockedFields.assigneeAccountId ? 'locked-field-input' : ''}`}
                    value={formData.assigneeName}
                    onChange={(e) => !lockedFields.assigneeAccountId && handleAssigneeChange(e.target.value)}
                    disabled={loadingSubmit || lockedFields.assigneeAccountId}
                    placeholder="Type assignee name"
                  />
                  {assigneeResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', marginTop: '6px', maxHeight: '180px', overflowY: 'auto', background: 'var(--surface)' }}>
                      {assigneeResults.map((user) => (
                        <button
                          key={user.accountId}
                          type="button"
                          onClick={() => handleAssigneeSelect(user)}
                          className="logtask-submit"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {user.displayName} {user.emailAddress ? `(${user.emailAddress})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="logtask-label" style={{ display: 'flex', alignItems: 'center' }}>
                    Start Date
                    {lockedFields.startDate && (
                      <svg className="field-locked-indicator" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    )}
                  </label>
                  <input
                    type="date"
                    className={`logtask-textarea ${lockedFields.startDate ? 'locked-field-input' : ''}`}
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    disabled={loadingSubmit || lockedFields.startDate}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="logtask-label">Labels</label>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setLabelDropdownOpen((open) => !open)}
                      className="logtask-submit"
                      style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      {formData.labels.length > 0 ? formData.labels.join(', ') : 'Select labels'}
                      <span style={{ marginLeft: '8px' }}>▾</span>
                    </button>
                    {labelDropdownOpen && (
                      <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '4px', padding: '10px' }}>
                        {metadata.labels.map((label) => (
                          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={formData.labels.includes(label)}
                              onChange={() => handleLabelsChange(label)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loadingSubmit || !formData.summary || !formData.component}
                  className="logtask-submit"
                >
                  {loadingSubmit ? 'Creating Bug...' : 'Confirm and Create Bug'}
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  The bug will be created with type Bug, start date today, reporter as self, and account SimpleCRM.
                </span>
              </div>
            </div>
          )}

          {submitResult && (
            <div className="logtask-success" style={{ marginTop: '26px' }}>
              <div className="logtask-success-header">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Bug created successfully
              </div>
              <div className="logtask-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="result-item">
                  <span className="result-label">Issue Key</span>
                  <span className="result-value">{submitResult.issueKey}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Issue URL</span>
                  <a href={submitResult.issueUrl} target="_blank" rel="noreferrer" className="result-value">Open in Jira</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}