import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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