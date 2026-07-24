import pool from './db.js';

/**
 * Fetches the integration credentials for a given user from the database.
 * Returns the row as a plain object — tokens are stored in plain text.
 *
 * @param {number|string} userId - The user ID to look up.
 * @returns {Promise<Object>} The user's integration row.
 * @throws {Error} If no integrations are found for the user.
 */
export async function getUserIntegrations(userId) {
  const [rows] = await pool.execute(
    `SELECT jira_email, jira_api_token, jira_domain, jira_project_key,
            tempo_token, author_account_id, tempo_account, jira_reporter_account_id
     FROM user_integrations
     WHERE user_id = ?`,
    [userId]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const fallback = {
    jira_email: process.env.JIRA_EMAIL,
    jira_api_token: process.env.JIRA_API_TOKEN,
    jira_domain: process.env.JIRA_DOMAIN,
    jira_project_key: process.env.JIRA_PROJECT_KEY,
    tempo_token: process.env.TEMPO_TOKEN,
    author_account_id: process.env.AUTHOR_ACCOUNT_ID,
    tempo_account: process.env.TEMPO_ACCOUNT,
    jira_reporter_account_id: process.env.JIRA_REPORTER_ACCOUNT_ID,
  };

  const hasBasicJiraCreds = Boolean(fallback.jira_email && fallback.jira_api_token && fallback.jira_domain && fallback.jira_project_key);
  const hasTempoCreds = Boolean(fallback.tempo_token);

  if (!hasBasicJiraCreds || !hasTempoCreds) {
    const error = new Error('No integrations configured for this user. Please set up your Jira and Tempo credentials.');
    error.statusCode = 404;
    throw error;
  }

  return fallback;
}
