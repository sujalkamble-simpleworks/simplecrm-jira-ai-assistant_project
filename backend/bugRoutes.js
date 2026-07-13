import express from 'express';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

const getJiraAuthHeader = () => {
  const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

const jiraHeaders = () => ({
  Authorization: getJiraAuthHeader(),
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const safeText = (text) => String(text)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n');

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const parseMaybeNumber = (value) => {
  if (value === null || value === undefined || value === '') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const extractFieldOptions = (fields, matchers) => {
  if (!Array.isArray(matchers)) matchers = [matchers];
  const field = Object.values(fields).find((item) => {
    const name = String(item?.name || '').toLowerCase();
    return matchers.some((matcher) => name.includes(matcher));
  });
  if (!field || !Array.isArray(field.allowedValues)) return [];
  return field.allowedValues.map((option) => ({ id: option.id, value: option.value }));
};

const makeAtlassianDocument = (text) => {
  const lines = String(text || '').split('\n');
  const content = [];

  if (lines.length === 0) {
    return { type: 'doc', version: 1, content: [] };
  }

  let paragraph = { type: 'paragraph', content: [] };
  lines.forEach((line, index) => {
    if (line === '') {
      if (paragraph.content.length > 0) {
        content.push(paragraph);
        paragraph = { type: 'paragraph', content: [] };
      }
      return;
    }

    if (paragraph.content.length > 0) {
      paragraph.content.push({ type: 'hardBreak' });
    }
    paragraph.content.push({ type: 'text', text: line });

    if (index === lines.length - 1) {
      content.push(paragraph);
    }
  });

  return { type: 'doc', version: 1, content };
};

router.get('/jira-metadata', async (req, res) => {
  try {
    const componentsResponse = await axios.get(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/project/${process.env.JIRA_PROJECT_KEY}/components`,
      { headers: jiraHeaders() }
    );

    const prioritiesResponse = await axios.get(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/priority`,
      { headers: jiraHeaders() }
    );

    const labels = ['bug', 'ui-glitch', 'high-priority', 'regression', 'blocking', 'needs-investigation'];

    const createMetaResponse = await axios.get(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue/createmeta?projectKeys=${process.env.JIRA_PROJECT_KEY}&issuetypeNames=Bug&expand=projects.issuetypes.fields`,
      { headers: jiraHeaders() }
    );

    const fields = createMetaResponse.data.projects?.[0]?.issuetypes?.[0]?.fields || {};
    const accountOptions = extractFieldOptions(fields, ['account', 'customer', 'organization', 'company']);
    const bugTypeOptions = extractFieldOptions(fields, ['bug type', 'issue type', 'type']);
    const startDateFieldEntry = Object.entries(fields).find(([, field]) => field?.name?.toLowerCase().includes('start date'));
    const startDateFieldId = startDateFieldEntry ? startDateFieldEntry[0] : null;

    res.json({
      components: componentsResponse.data.map((item) => item.name),
      priorities: prioritiesResponse.data.map((item) => item.name),
      labels,
      accounts: accountOptions,
      bugTypes: bugTypeOptions,
      startDateFieldId,
    });
  } catch (error) {
    console.error('jira-metadata error', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to load Jira metadata', details: error.response?.data || error.message });
  }
});

router.get('/user-search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.json([]);
    }

    const response = await axios.get(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`,
      { headers: jiraHeaders() }
    );

    res.json(response.data.map((user) => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || null,
    })));
  } catch (error) {
    console.error('user-search error', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to search Jira users', details: error.response?.data || error.message });
  }
});

router.post('/parse-bug', async (req, res) => {
  try {
    const { userInput, metadata } = req.body;
    if (!userInput) return res.status(400).json({ error: 'userInput is required' });

    const validComponents = metadata?.components?.join(', ') || '';
    const validPriorities = metadata?.priorities?.join(', ') || '';
    const validLabels = metadata?.labels?.join(', ') || '';
    const validAccounts = metadata?.accounts?.map((account) => account.value).join(', ') || '';
    const validBugTypes = metadata?.bugTypes?.map((type) => type.value).join(', ') || '';
    const cleanedInput = safeText(userInput);

    const prompt = `I am working as a QA tester for a CRM application.
I will provide bugs in raw format.

Convert them into proper Jira Bug format using the following structure exactly:

Summary in summary
Description in description section only
Expected Result in description section only
Actual Result in description section only
Acceptance Criteria in acceptanceCriteria section only
Steps to Reproduce in stepsToReproduce section only

Formatting Rules:
 dont add the heading of JSON  below in text
 Use plain text titles (no **markdown**). Examples: Description:, Expected Result:, Actual Result:, Acceptance Criteria:, Steps to Reproduce:
 Do not add horizontal lines
Keep language simple and professional
Do not change bug meaning
Add numbering in Steps to Reproduce
Keep Acceptance Criteria clear and measurable
Do not add extra sections unless provided and also add expected and actual result inside description field

Return JSON only in this exact schema:
{
  "summary": string,
  "description": string,
  "stepsToReproduce": string,
  "acceptanceCriteria": string,
  "priority": string,
  "component": string,
  "labels": array,
  "linkedWorkItem": string,
  "linkedWorkType": string,
  "account": string,
  "bugType": string,
  "startDate": string
}

Use these valid values when possible:
- components: ${validComponents}
- priorities: ${validPriorities}
- labels: ${validLabels}
- accounts: ${validAccounts}
- bug types: ${validBugTypes}

If the text does not mention a field, return an empty string or empty array. Always choose a valid component, priority, label, account, and bugType if the text implies them.
If the text mentions a date for when the bug should be addressed or when it was found, return startDate in YYYY-MM-DD format.

Text: "${cleanedInput}"`;


    const model = getGeminiModel();
    const extractResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const rawJson = await extractResult.response.text();
    const parsed = JSON.parse(rawJson);
    parsed.labels = normalizeArray(parsed.labels);
    parsed.linkedWorkType = parsed.linkedWorkType || 'blocks';

    res.json(parsed);
  } catch (error) {
    console.error('parse-bug error', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to parse bug description', details: error.response?.data || error.message });
  }
});

router.post('/create-bug', async (req, res) => {
  try {
    const {
      summary,
      description,
      stepsToReproduce,
      acceptanceCriteria,
      component,
      priority,
      labels,
      linkedWorkItem,
      linkedWorkType,
      startDate,
      account,
      bugType,
      assigneeAccountId,
      startDateFieldId,
    } = req.body;

    if (!summary || !component) {
      return res.status(400).json({ error: 'summary and component are required' });
    }

    const resolvedStartDate = startDate || new Date().toISOString().split('T')[0];
    const descriptionString = `${description || ''}\n\nSteps to Reproduce:\n${stepsToReproduce || ''}\n\nAcceptance Criteria:\n${acceptanceCriteria || ''}`;

    const fields = {
      project: { key: process.env.JIRA_PROJECT_KEY },
      summary,
      description: makeAtlassianDocument(descriptionString),
      issuetype: { name: 'Bug' },
      components: [{ name: component }],
      priority: priority ? { name: priority } : undefined,
      labels: normalizeArray(labels),
      customfield_10522: makeAtlassianDocument(acceptanceCriteria || 'Acceptance criteria not provided'),
      customfield_10423: makeAtlassianDocument(stepsToReproduce || 'Steps to reproduce not provided'),
      customfield_10190: parseMaybeNumber(account) || 2,
      customfield_10192: bugType ? { value: bugType } : { value: 'New Bug' },
    };

    if (startDateFieldId) {
      fields[startDateFieldId] = resolvedStartDate;
    }
    if (assigneeAccountId) {
      fields.assignee = { accountId: assigneeAccountId };
    }
    if (process.env.JIRA_REPORTER_ACCOUNT_ID) {
      fields.reporter = { accountId: process.env.JIRA_REPORTER_ACCOUNT_ID };
    }

    const issuePayload = { fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)) };

    const issueResponse = await axios.post(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue`,
      issuePayload,
      { headers: jiraHeaders() }
    );

    const issueKey = issueResponse.data.key;
    const issueUrl = `https://${process.env.JIRA_DOMAIN}/browse/${issueKey}`;

    if (linkedWorkItem) {
      const knownLinks = {
        blocks: { typeName: 'Blocks', outwardIssue: { key: issueKey }, inwardIssue: { key: linkedWorkItem } },
        is_blocked_by: { typeName: 'Blocks', outwardIssue: { key: linkedWorkItem }, inwardIssue: { key: issueKey } },
        relates_to: { typeName: 'Relates', outwardIssue: { key: issueKey }, inwardIssue: { key: linkedWorkItem } },
      };

      const linkConfig = knownLinks[linkedWorkType] || knownLinks.blocks;
      await axios.post(
        `https://${process.env.JIRA_DOMAIN}/rest/api/3/issueLink`,
        {
          type: { name: linkConfig.typeName },
          inwardIssue: linkConfig.inwardIssue,
          outwardIssue: linkConfig.outwardIssue,
        },
        { headers: jiraHeaders() }
      );
    }

    res.json({ success: true, issueKey, issueUrl });
  } catch (error) {
    console.error('create-bug error', error.response?.data || error.message);
    res.status(500).json({ error: 'Unable to create Jira bug', details: error.response?.data || error.message });
  }
});

export default router;
