import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import bugRoutes from './bugRoutes.js';

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

// Save Jira email to .env file
app.post('/api/save-email', (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email is required' });
        }

        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }

        // Update or append JIRA_EMAIL
        if (envContent.match(/^JIRA_EMAIL=.*/m)) {
            envContent = envContent.replace(/^JIRA_EMAIL=.*/m, `JIRA_EMAIL=${email}`);
        } else {
            envContent = envContent.trimEnd() + `\nJIRA_EMAIL=${email}\n`;
        }

        fs.writeFileSync(envPath, envContent, 'utf-8');

        // Reload env vars into process.env
        dotenv.config({ path: envPath, override: true });

        res.json({ success: true, email });
    } catch (error) {
        console.error('Failed to save email:', error.message);
        res.status(500).json({ error: 'Failed to save email', details: error.message });
    }
});

// Helper to encode Jira Basic Auth
const getJiraAuthHeader = () => {
    const credentials = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

app.post('/api/log-work', async (req, res) => {
    try {
        const { userInput } = req.body;
        if (!userInput) return res.status(400).json({ error: "Input is required" });

        // 1. Extract Data using Gemini (JSON Mode)
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

        // 2. Generate Professional Description
        const descPrompt = `
            Convert the following QA activity into a professional Tempo worklog.
            Rules: 2 to 4 concise sentences. Professional language. Suitable for Jira Tempo. Mention validation/testing if relevant. Do not exaggerate.
            Activity: ${parsedData.activityDescription}
        `;
        const descResult = await model.generateContent(descPrompt);
        const finalDescription = descResult.response.text().trim();

        // 3. Lookup Jira Issue ID
        const jiraResponse = await axios.get(
            `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue/${parsedData.issueKey}`,
            { headers: { 'Authorization': getJiraAuthHeader(), 'Accept': 'application/json' } }
        );
        const issueId = jiraResponse.data.id;

        // 4. Create Tempo Worklog
        const timeSpentSeconds = parsedData.durationHours * 3600;
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const tempoPayload = {
            issueId: parseInt(issueId),
            authorAccountId: process.env.AUTHOR_ACCOUNT_ID,
            timeSpentSeconds: timeSpentSeconds,
            startDate: currentDate,
            startTime: parsedData.startTime,
            description: finalDescription,
            attributes: [
                { key: "_Account_", value: process.env.TEMPO_ACCOUNT }
            ]
        };

        const tempoResponse = await axios.post(
            'https://api.tempo.io/4/worklogs',
            tempoPayload,
            { headers: { 'Authorization': `Bearer ${process.env.TEMPO_TOKEN}`, 'Content-Type': 'application/json' } }
        );

        // 5. Return Success
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
        res.status(500).json({ 
            error: "Failed to log work", 
            details: error.response?.data || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));