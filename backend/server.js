import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import bugRoutes from './bugRoutes.js';
import { readEnvFile, updateEnvFile, writeEnvFile } from './envFile.js';
import { getUserIntegrations } from './getUserIntegrations.js';
import authMiddleware from './authMiddleware.js';
import adminMiddleware from './adminMiddleware.js';
import pool from './db.js';
import jwt from 'jsonwebtoken';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is missing. Please set it in backend/.env or the environment');
}

const projectKey = process.env.JIRA_PROJECT_KEY;

const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', bugRoutes);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    const connection = await pool.getConnection();

    const createAdminAccountsTable = `
      CREATE TABLE IF NOT EXISTS admin_accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createAdminAccountsTable);

    await connection.query(
      `INSERT INTO admin_accounts (email, password)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      [ADMIN_USERNAME, ADMIN_PASSWORD]
    );

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) DEFAULT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createUsersTable);

    const createUserModuleAccessTable = `
      CREATE TABLE IF NOT EXISTS user_module_access (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          module_name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_module (user_id, module_name),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    await connection.query(createUserModuleAccessTable);
    
    const createIntegrationsTable = `
      CREATE TABLE IF NOT EXISTS user_integrations (
          id                        INT AUTO_INCREMENT PRIMARY KEY,
          user_id                   INT NOT NULL,
          jira_email                VARCHAR(255) DEFAULT NULL,
          jira_api_token            TEXT DEFAULT NULL,
          jira_domain               VARCHAR(255) DEFAULT NULL,
          jira_project_key          VARCHAR(50) DEFAULT NULL,
          tempo_token               TEXT DEFAULT NULL,
          author_account_id         VARCHAR(255) DEFAULT NULL,
          tempo_account             VARCHAR(255) DEFAULT NULL,
          jira_reporter_account_id  VARCHAR(255) DEFAULT NULL,
          created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_id (user_id)
      );
    `;
    await connection.query(createIntegrationsTable);
    
    connection.release();
    console.log('✅ Database initialized successfully - all tables are ready');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
}

app.post('/api/save-email', (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email is required' });
        }

        updateEnvFile(envPath, 'JIRA_EMAIL', email);

        // Reload env vars into process.env
        dotenv.config({ path: envPath, override: true });

        res.json({ success: true, email });
    } catch (error) {
        console.error('Failed to save email:', error.message);
        res.status(500).json({ error: 'Failed to save email', details: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid username or password' });
        
        const user = users[0];
        if (user.password !== password) return res.status(401).json({ error: 'Invalid username or password' });
        
        const token = jwt.sign({ user_id: user.id, account_type: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, is_admin: !!user.is_admin });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, email, password } = req.body || {};
        const loginEmail = email || username;

        if (!loginEmail || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const [admins] = await pool.execute('SELECT * FROM admin_accounts WHERE email = ?', [loginEmail]);
        if (admins.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const admin = admins[0];
        if (admin.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ user_id: admin.id, account_type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, is_admin: true });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin User Management Routes
app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            is_admin = false,
            modules = [],
            jira_api_token,
            jira_project_key,
            author_account_id,
            tempo_token,
        } = req.body || {};

        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)',
            [name || null, email, password, is_admin ? 1 : 0]
        );

        const userId = result.insertId;
        const normalizedModules = Array.isArray(modules) ? modules.map((module) => String(module).trim()).filter(Boolean) : [];

        if (normalizedModules.length) {
            await Promise.all(normalizedModules.map((moduleName) =>
                pool.execute(
                    'INSERT INTO user_module_access (user_id, module_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE module_name = VALUES(module_name)',
                    [userId, moduleName]
                )
            ));
        }

        await pool.execute(
            `INSERT INTO user_integrations (
                user_id,
                jira_email,
                jira_api_token,
                jira_domain,
                jira_project_key,
                tempo_token,
                author_account_id,
                tempo_account,
                jira_reporter_account_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                jira_email = VALUES(jira_email),
                jira_api_token = VALUES(jira_api_token),
                jira_domain = VALUES(jira_domain),
                jira_project_key = VALUES(jira_project_key),
                tempo_token = VALUES(tempo_token),
                author_account_id = VALUES(author_account_id),
                tempo_account = VALUES(tempo_account),
                jira_reporter_account_id = VALUES(jira_reporter_account_id)`,
            [
                userId,
                email,
                jira_api_token || null,
                process.env.JIRA_DOMAIN || null,
                jira_project_key || null,
                tempo_token || null,
                author_account_id || null,
                process.env.TEMPO_ACCOUNT || null,
                process.env.JIRA_REPORTER_ACCOUNT_ID || null,
            ]
        );

        res.json({ success: true, userId, modules: normalizedModules });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT u.id, u.name, u.email, u.is_admin, u.created_at,
                   COALESCE(GROUP_CONCAT(uma.module_name ORDER BY uma.module_name SEPARATOR ','), '') AS module_list
            FROM users u
            LEFT JOIN user_module_access uma ON uma.user_id = u.id
            GROUP BY u.id, u.name, u.email, u.is_admin, u.created_at
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: users.map((user) => ({
                ...user,
                is_admin: !!user.is_admin,
                modules: user.module_list ? user.module_list.split(',').filter(Boolean) : []
            }))
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            password,
            is_admin = false,
            modules = [],
            jira_api_token,
            jira_project_key,
            author_account_id,
            tempo_token,
        } = req.body || {};

        if (!email) return res.status(400).json({ error: 'Email and password required' });

        const normalizedModules = Array.isArray(modules)
            ? modules.map((module) => String(module).trim()).filter(Boolean)
            : [];

        const updates = ['name = ?', 'email = ?', 'is_admin = ?'];
        const values = [name || null, email, is_admin ? 1 : 0];

        if (password && String(password).trim()) {
            updates.push('password = ?');
            values.push(password);
        }

        values.push(id);

        await pool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        await pool.execute('DELETE FROM user_module_access WHERE user_id = ?', [id]);

        if (normalizedModules.length) {
            await Promise.all(normalizedModules.map((moduleName) =>
                pool.execute(
                    'INSERT INTO user_module_access (user_id, module_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE module_name = VALUES(module_name)',
                    [id, moduleName]
                )
            ));
        }

        await pool.execute(
            `INSERT INTO user_integrations (
                user_id,
                jira_email,
                jira_api_token,
                jira_domain,
                jira_project_key,
                tempo_token,
                author_account_id,
                tempo_account,
                jira_reporter_account_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                jira_email = VALUES(jira_email),
                jira_api_token = VALUES(jira_api_token),
                jira_domain = VALUES(jira_domain),
                jira_project_key = VALUES(jira_project_key),
                tempo_token = VALUES(tempo_token),
                author_account_id = VALUES(author_account_id),
                tempo_account = VALUES(tempo_account),
                jira_reporter_account_id = VALUES(jira_reporter_account_id)`,
            [
                id,
                email,
                jira_api_token || null,
                process.env.JIRA_DOMAIN || null,
                jira_project_key || null,
                tempo_token || null,
                author_account_id || null,
                process.env.TEMPO_ACCOUNT || null,
                process.env.JIRA_REPORTER_ACCOUNT_ID || null,
            ]
        );

        res.json({ success: true, userId: Number(id), modules: normalizedModules });
    } catch (error) {
        console.error('Update user error:', error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/env', (req, res) => {
    try {
        const entries = readEnvFile(envPath);
        res.json({ success: true, entries });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read environment variables', details: error.message });
    }
});

app.post('/api/admin/env', (req, res) => {
    try {
        const { entries } = req.body || {};
        if (!Array.isArray(entries)) {
            return res.status(400).json({ error: 'entries must be an array' });
        }

        const normalized = entries
            .filter((entry) => entry && entry.key)
            .map((entry) => ({ key: String(entry.key).trim(), value: String(entry.value ?? '') }));

        writeEnvFile(normalized, envPath);
        dotenv.config({ path: envPath, override: true });

        res.json({ success: true, entries: normalized });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save environment variables', details: error.message });
    }
});

app.get('/api/spreadsheet-id', (req, res) => {
    try {
        const entries = readEnvFile(envPath);
        const sheetEntry = entries.find((entry) => entry.key === 'SPREADSHEET_ID');
        res.json({ success: true, spreadsheetId: sheetEntry?.value || '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read spreadsheet ID', details: error.message });
    }
});

app.post('/api/save-spreadsheet', (req, res) => {
    try {
        const { spreadsheetId } = req.body || {};
        if (!spreadsheetId || !String(spreadsheetId).trim()) {
            return res.status(400).json({ error: 'Spreadsheet ID is required' });
        }

        updateEnvFile(envPath, 'SPREADSHEET_ID', String(spreadsheetId).trim());
        dotenv.config({ path: envPath, override: true });

        res.json({ success: true, spreadsheetId: String(spreadsheetId).trim() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save spreadsheet ID', details: error.message });
    }
});



app.post('/api/log-work', authMiddleware, async (req, res) => {
    try {
        const { userInput } = req.body;
        if (!userInput) return res.status(400).json({ error: "Input is required" });

        // 1. Fetch per-user integration credentials from MySQL
        const userCreds = await getUserIntegrations(req.user_id);

        if (!userCreds.jira_domain || !userCreds.jira_api_token) {
            return res.status(400).json({ error: 'Please configure your Jira integration first.' });
        }

        // 2. Build auth header directly (tokens stored in plain text)
        const credentials = `${userCreds.jira_email}:${userCreds.jira_api_token}`;
        const jiraAuthHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

        // 3. Extract Data using Gemini (JSON Mode)
        const model = getGeminiModel();
        const extractPrompt = `
            Extract the following information from the text. Return JSON only.
            Fields:
            - issueKey (string)
            - durationHours (number)
            - startTime (string, format "HH:mm:ss" in 24-hour time. Default to "09:00:00" if not specified)
            - activityDescription (string)
            
            Text: "${userInput}"
        `;
        
        const extractResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        
        const parsedData = JSON.parse(extractResult.response.text());

        // 4. Generate Professional Description
        const descPrompt = `
            Convert the following QA activity into a professional Tempo worklog.
Rules: 2 to 4 concise sentences. Professional language. Suitable for Jira Tempo. Mention validation/testing if relevant. Do not use markdown (no **bold**, no headings). Do not exaggerate.
            Activity: ${parsedData.activityDescription}
        `;
        const descResult = await model.generateContent(descPrompt);
        const finalDescription = descResult.response.text().trim();

        // 5. Lookup Jira Issue ID
        const jiraResponse = await axios.get(
            `https://${userCreds.jira_domain}/rest/api/3/issue/${parsedData.issueKey}`,
            { headers: { 'Authorization': jiraAuthHeader, 'Accept': 'application/json' } }
        );
        const issueId = jiraResponse.data.id;

        // 6. Create Tempo Worklog
        const timeSpentSeconds = parsedData.durationHours * 3600;
        const currentDate = new Date().toISOString().split('T')[0];

        const tempoPayload = {
            issueId: parseInt(issueId),
            authorAccountId: userCreds.author_account_id,
            timeSpentSeconds: timeSpentSeconds,
            startDate: currentDate,
            startTime: parsedData.startTime,
            description: finalDescription,
            attributes: [
                { key: "_Account_", value: userCreds.tempo_account }
            ]
        };

        const tempoResponse = await axios.post(
            'https://api.tempo.io/4/worklogs',
            tempoPayload,
            { headers: { 'Authorization': `Bearer ${userCreds.tempo_token}`, 'Content-Type': 'application/json' } }
        );

        // 7. Return Success
        res.json({
            success: true,
            issueKey: parsedData.issueKey,
            duration: `${parsedData.durationHours}h`,
            tempoWorklogId: tempoResponse.data.tempoWorklogId,
            description: finalDescription,
            startTime: parsedData.startTime
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(error.statusCode || 500).json({ 
            error: "Failed to log work", 
            details: error.response?.data || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
await initializeDatabase();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));