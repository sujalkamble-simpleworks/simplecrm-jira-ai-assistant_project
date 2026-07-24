import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import authMiddleware from './authMiddleware.js';
import { getUserIntegrations } from './getUserIntegrations.js';

//Contains logic for parsing bugs, generating test cases, and interacting with Jira and Google Sheets APIs.

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

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

const getSheetsClient = async () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.join(__dirname, 'credentials.json');

  const hasCredentialsFile = credentialsPath && fs.existsSync(credentialsPath);
  if (hasCredentialsFile) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!clientEmail || !privateKey) {
    throw new Error('Google service account credentials are not configured');
  }

  const auth = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
};

const appendTestCaseToSheet = async (testCase) => {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not configured');
  }

  const sheets = await getSheetsClient();
  const values = [
    testCase.ModuleView || '',
    testCase.Subject || '',
    testCase.Scenario || '',
    testCase.AcceptanceCriteria || '',
    testCase.Prerequisites || '',
    testCase.StepsToFollow || '',
    testCase.ExpectedOutput || '',
    testCase.ActualOutput || '',
    testCase.TestType || '',
    testCase.Priority || '',
    testCase.TestStatus || '',
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!C6:L6',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [values],
    },
  });

  return response.data;
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

const normalizeDescriptionField = (text) => {
  const value = String(text || '').trim();
  if (!value) {
    return '';
  }

  const withoutLeadingTitle = value.replace(/^\s*Description\s*:\s*/i, '');
  const withBlankLineBeforeSections = withoutLeadingTitle.replace(/\n\s*(Expected Result|Actual Result)\s*:/gi, '\n\n$1:');

  return withBlankLineBeforeSections.trim();
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

/**
 * Builds Jira request headers from per-user credentials.
 * @param {Object} userCreds - The user's integration row from the DB.
 * @returns {Object} Headers object for Axios Jira requests.
 */
const buildJiraHeaders = (userCreds) => {
  const credentials = `${userCreds.jira_email}:${userCreds.jira_api_token}`;
  return {
    Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
};

router.get('/jira-metadata', authMiddleware, async (req, res) => {
  try {
    const userCreds = await getUserIntegrations(req.user_id);

    if (!userCreds.jira_domain || !userCreds.jira_api_token) {
      return res.status(400).json({ error: 'Please configure your Jira integration first.' });
    }

    const headers = buildJiraHeaders(userCreds);
    const projectKey = userCreds.jira_project_key;

    const componentsResponse = await axios.get(
      `https://${userCreds.jira_domain}/rest/api/3/project/${projectKey}/components`,
      { headers }
    );

    const prioritiesResponse = await axios.get(
      `https://${userCreds.jira_domain}/rest/api/3/priority`,
      { headers }
    );

    const labels = ['bug', 'ui-glitch', 'high-priority', 'regression', 'blocking', 'needs-investigation'];

    const createMetaResponse = await axios.get(
      `https://${userCreds.jira_domain}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=Bug&expand=projects.issuetypes.fields`,
      { headers }
    );

    const fields = createMetaResponse.data.projects?.[0]?.issuetypes?.[0]?.fields || {};
    const issueTypeOptions = (createMetaResponse.data.projects?.[0]?.issuetypes || []).map((issueType) => ({
      id: issueType.id,
      value: issueType.name,
    }));
    const accountOptions = extractFieldOptions(fields, ['account', 'customer', 'organization', 'company']);
    const bugTypeOptions = extractFieldOptions(fields, ['bug type', 'issue type', 'type']).length
      ? extractFieldOptions(fields, ['bug type', 'issue type', 'type'])
      : issueTypeOptions;
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
    res.status(error.statusCode || 500).json({ error: 'Unable to load Jira metadata', details: error.response?.data || error.message });
  }
});

router.get('/user-search', authMiddleware, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.json([]);
    }

    const userCreds = await getUserIntegrations(req.user_id);
    const headers = buildJiraHeaders(userCreds);

    const response = await axios.get(
      `https://${userCreds.jira_domain}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`,
      { headers }
    );

    res.json(response.data.map((user) => ({
      accountId: user.accountId,
      displayName: user.displayName,
      emailAddress: user.emailAddress,
      avatarUrl: user.avatarUrls?.['48x48'] || null,
    })));
  } catch (error) {
    console.error('user-search error', error.response?.data || error.message);
    res.status(error.statusCode || 500).json({ error: 'Unable to search Jira users', details: error.response?.data || error.message });
  }
});

router.post('/parse-bug', authMiddleware, async (req, res) => {
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
- Do not include the literal heading "Description:" at the start of the description field.
- Start the description field directly with the description paragraph.
- If Expected Result and Actual Result exist, keep them in the same description field and place one blank line between the description paragraph and the Expected Result / Actual Result sections.
- Use plain text labels only for the section names inside the description field, for example: Expected Result:, Actual Result:
- Do not add horizontal lines
- Keep language simple, technical and professional
- Do not change bug meaning
- Add numbering in Steps to Reproduce
- Keep Acceptance Criteria clear and measurable
- Do not add extra sections unless provided

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
    parsed.description = normalizeDescriptionField(parsed.description);
    parsed.labels = normalizeArray(parsed.labels);
    parsed.linkedWorkType = parsed.linkedWorkType || 'blocks';

    res.json(parsed);
  } catch (error) {
    console.error('parse-bug error', error.response?.data || error.message);
    res.status(error.statusCode || 500).json({ error: 'Unable to parse bug description', details: error.response?.data || error.message });
  }
});

router.post('/generate-testcase', authMiddleware, async (req, res) => {
  try {
    const { scenario, history } = req.body;
    if (!scenario || !String(scenario).trim()) {
      return res.status(400).json({ error: 'scenario is required' });
    }

    const model = getGeminiModel();

    // Build history context from client-provided history array
    const safeHistory = Array.isArray(history) ? history.slice(-5) : [];
    const historyContext = safeHistory.length
      ? `Here are the last ${safeHistory.length} generated test cases for structure and clarity:\n${safeHistory
          .map((entry, index) => `${index + 1}. ${JSON.stringify(entry)}`)
          .join('\n')}\n\n`
      : '';

    const prompt = `You are an expert QA Engineer.

${historyContext}Convert the following software testing scenario into a single valid JSON object with ONLY the following keys:

{
  "ModuleView": "",
  "Subject": "",
  "Scenario": "",
  "AcceptanceCriteria": "",
  "Prerequisites": "",
  "StepsToFollow": "",
  "ExpectedOutput": "",
  "ActualOutput": "",
  "TestType": "",
  "Priority": "",
  "TestStatus": ""
}

Rules:

- Return ONLY valid JSON.
- Do NOT include markdown, explanations, comments, code fences, or additional text.
- Use professional QA language suitable for Jira, TestRail, Zephyr, Xray, Google Sheets, and Excel.
- Keep every field concise and technically accurate.

Field Rules:

1. ModuleView
- Extract the module or view where the test is performed.

2. Subject
- Represent the exact feature or functionality being validated.

3. Scenario
- Begin with words like "Ensure", "Validate", or "Confirm".
- Never start with "Verify".
- Keep it concise and generic unless specific values are essential.

4. AcceptanceCriteria
- Write a single short sentence describing the expected successful behavior.

5. Prerequisites
- Mention only the required setup, permissions, configurations, or existing records.

6. StepsToFollow
- Return as ONE single string.
- Format exactly like:
  "1. Step one. 2. Step two. 3. Step three."
- Do NOT use arrays.
- Do NOT use "\\\\n", "/n", or multiline text.

7. ExpectedOutput
- Describe the correct system behavior.

8. ActualOutput
- For positive scenarios, describe the successful behavior.
- For negative scenarios, clearly describe the observed issue.

9. TestType
Choose ONLY one of:
- "Functionality"
- "Issue"

Rules:
- Use "Functionality" for positive validations, successful workflows, enhancements, or expected behavior.
- Use "Issue" for bugs, failures, incorrect behavior, missing functionality, UI issues, logging issues, validation failures, audit issues, API failures, etc.

10. Priority
Choose ONLY one of:
- "Critical"
- "High"
- "Medium"
- "Low"

Priority Guidelines:
- Critical → Application crash, security issue, data corruption/loss, workflow completely blocked, authentication failure, production blocker.
- High → Core functionality broken, audit/logging failure, API integration failure, import/export failure, workflow not working, incorrect business logic.
- Medium → UI issue affecting usability, validation issue, incorrect messages, partial functionality failure, filter/search issue, audit display issue.
- Low → Cosmetic issue, alignment issue, tooltip issue, spelling mistake, enhancement, minor usability improvement.

11. TestStatus
Choose ONLY one of:
- "Passed"
- "Failed"

Rules:
- Use "Passed" when the scenario describes expected or successful behavior.
- Use "Failed" when the scenario describes an observed bug or incorrect behavior.

Additional Rules:

- Preserve module names, field names, API names, events, and technical terminology exactly as provided.
- Make scenarios generic whenever possible unless specific values are important.
- Do not invent unnecessary details.
- Keep the JSON values concise, clear, and professional.
- Ensure the output is valid JSON that can be parsed directly.

Scenario:
${String(scenario).trim()}
`;
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const rawText = await result.response.text();
    const testCase = JSON.parse(rawText);

    let sheetResult = null;
    let sheetError = null;

    try {
      await appendTestCaseToSheet(testCase);
      sheetResult = 'Saved to spreadsheet successfully.';
    } catch (sheetWriteError) {
      console.warn('Spreadsheet write warning:', sheetWriteError.message);
      sheetError = sheetWriteError.message;
    }

    res.json({ success: true, data: testCase, sheetResult, sheetError });
  } catch (error) {
    console.error('generate-testcase error', error.response?.data || error.message);
    res.status(error.statusCode || 500).json({ error: 'Unable to generate testcase', details: error.response?.data || error.message });
  }
});

router.post('/create-bug', authMiddleware, async (req, res) => {
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

    // Fetch per-user Jira credentials
    const userCreds = await getUserIntegrations(req.user_id);

    if (!userCreds.jira_domain || !userCreds.jira_api_token) {
      return res.status(400).json({ error: 'Please configure your Jira integration first.' });
    }

    const headers = buildJiraHeaders(userCreds);

    const resolvedStartDate = startDate || new Date().toISOString().split('T')[0];
    const descriptionString = description || '';

    const fields = {
      project: { key: userCreds.jira_project_key },
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
    if (userCreds.jira_reporter_account_id) {
      fields.reporter = { accountId: userCreds.jira_reporter_account_id };
    }

    const issuePayload = { fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)) };

    const issueResponse = await axios.post(
      `https://${userCreds.jira_domain}/rest/api/3/issue`,
      issuePayload,
      { headers }
    );

    const issueKey = issueResponse.data.key;
    const issueUrl = `https://${userCreds.jira_domain}/browse/${issueKey}`;

    if (linkedWorkItem) {
      const knownLinks = {
        blocks: { typeName: 'Blocks', outwardIssue: { key: issueKey }, inwardIssue: { key: linkedWorkItem } },
        is_blocked_by: { typeName: 'Blocks', outwardIssue: { key: linkedWorkItem }, inwardIssue: { key: issueKey } },
        relates_to: { typeName: 'Relates', outwardIssue: { key: issueKey }, inwardIssue: { key: linkedWorkItem } },
      };

      const linkConfig = knownLinks[linkedWorkType] || knownLinks.blocks;
      await axios.post(
        `https://${userCreds.jira_domain}/rest/api/3/issueLink`,
        {
          type: { name: linkConfig.typeName },
          inwardIssue: linkConfig.inwardIssue,
          outwardIssue: linkConfig.outwardIssue,
        },
        { headers }
      );
    }

    res.json({ success: true, issueKey, issueUrl });
  } catch (error) {
    console.error('create-bug error', error.response?.data || error.message);
    res.status(error.statusCode || 500).json({ error: 'Unable to create Jira bug', details: error.response?.data || error.message });
  }
});

export default router;