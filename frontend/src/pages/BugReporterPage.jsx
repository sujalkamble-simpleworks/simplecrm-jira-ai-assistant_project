import { useEffect, useMemo, useState } from 'react';
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

export default function BugReporterPage() {
  const navigate = useNavigate();
  const [textareaValue, setTextareaValue] = useState('');
  const [formData, setFormData] = useState(blankForm);
  const [metadata, setMetadata] = useState({ components: [], priorities: [], labels: [], accounts: [], bugTypes: [], startDateFieldId: null });
  const [suggestions, setSuggestions] = useState([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState([]);
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/jira-metadata');
        setMetadata(response.data);
        setFormData((current) => ({
          ...current,
          account: response.data.accounts?.[0]?.id || current.account,
          bugType: response.data.bugTypes?.[0]?.value || current.bugType,
          labels: current.labels.length > 0 ? current.labels : ['bug'],
        }));
      } catch (err) {
        console.error(err);
      }
    };
    loadMetadata();
  }, []);

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
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
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

      <div className="logtask-container" style={{ maxWidth: '900px' }}>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Dashboard
        </button>

        <div className="logtask-card">
          <div className="logtask-header">
            <div className="logtask-icon" style={{ background: 'rgba(249, 115, 22, 0.14)', color: '#f97316' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 9.5a5 5 0 0 1 11 0v2.5a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V9.5z"/>
                <path d="M8 13.5v4.5M16 13.5v4.5"/>
                <path d="M12 17.5v1.5"/>
              </svg>
            </div>
            <div>
              <h1>Bug Reporter</h1>
              <p>Use AI to fill a Jira-style bug ticket. Review the preview, then confirm to create the bug.</p>
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
                  <label className="logtask-label">Component *</label>
                  <select
                    className="logtask-textarea"
                    value={formData.component}
                    onChange={(e) => handleChange('component', e.target.value)}
                    disabled={loadingSubmit}
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
                  <label className="logtask-label">Priority</label>
                  <select
                    className="logtask-textarea"
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    disabled={loadingSubmit}
                  >
                    <option value="">Select priority</option>
                    {metadata.priorities.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label">Linked Work Item</label>
                  <input
                    className="logtask-textarea"
                    value={formData.linkedWorkItem}
                    onChange={(e) => handleChange('linkedWorkItem', e.target.value)}
                    disabled={loadingSubmit}
                    placeholder="PROD-5746"
                  />
                </div>
                <div>
                  <label className="logtask-label">Link Type</label>
                  <select
                    className="logtask-textarea"
                    value={formData.linkedWorkType}
                    onChange={(e) => handleChange('linkedWorkType', e.target.value)}
                    disabled={loadingSubmit}
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
                  <label className="logtask-label">Account</label>
                  <select
                    className="logtask-textarea"
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value)}
                    disabled={loadingSubmit}
                  >
                    <option value="">Select account</option>
                    {metadata.accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label">Bug Type</label>
                  <select
                    className="logtask-textarea"
                    value={formData.bugType}
                    onChange={(e) => handleChange('bugType', e.target.value)}
                    disabled={loadingSubmit}
                  >
                    <option value="">Select bug type</option>
                    {metadata.bugTypes.map((type) => (
                      <option key={type.id} value={type.value}>{type.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="logtask-label">Assignee</label>
                  <input
                    className="logtask-textarea"
                    value={formData.assigneeName}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    disabled={loadingSubmit}
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
                  <label className="logtask-label">Start Date</label>
                  <input
                    type="date"
                    className="logtask-textarea"
                    value={formData.startDate}
                    onChange={(e) => handleChange('startDate', e.target.value)}
                    disabled={loadingSubmit}
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
