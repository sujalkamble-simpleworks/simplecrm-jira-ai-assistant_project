import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvContent, serializeEnvEntries } from './envFile.js';

test('parses key/value pairs and ignores comments', () => {
  const content = `
# comment
GEMINI_API_KEY=value123
JIRA_EMAIL = user@example.com
EMPTY=
`;

  const entries = parseEnvContent(content);

  assert.deepEqual(entries, [
    { key: 'GEMINI_API_KEY', value: 'value123' },
    { key: 'JIRA_EMAIL', value: 'user@example.com' },
    { key: 'EMPTY', value: '' },
  ]);
});

test('serializes entries into dotenv-friendly lines', () => {
  const entries = [
    { key: 'GEMINI_API_KEY', value: 'abc123' },
    { key: 'JIRA_DOMAIN', value: 'company.atlassian.net' },
  ];

  assert.equal(serializeEnvEntries(entries), 'GEMINI_API_KEY=abc123\nJIRA_DOMAIN=company.atlassian.net\n');
});
