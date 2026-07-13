import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

export function parseEnvContent(content = '') {
  const lines = content.split(/\r?\n/);
  const entries = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    entries.push({ key, value });
  }

  return entries;
}

export function serializeEnvEntries(entries) {
  return entries
    .filter((entry) => entry?.key)
    .map((entry) => `${entry.key}=${entry.value ?? ''}`)
    .join('\n') + '\n';
}

export function readEnvFile(filePath = envPath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseEnvContent(content);
}

export function writeEnvFile(entries, filePath = envPath) {
  const content = serializeEnvEntries(entries);
  fs.writeFileSync(filePath, content, 'utf-8');
  return content;
}

export function updateEnvFile(filePath = envPath, key, value) {
  const existingEntries = readEnvFile(filePath);
  const nextEntries = [...existingEntries];
  const index = nextEntries.findIndex((entry) => entry.key === key);

  if (index >= 0) {
    nextEntries[index] = { ...nextEntries[index], value: String(value) };
  } else {
    nextEntries.push({ key, value: String(value) });
  }

  writeEnvFile(nextEntries, filePath);
  return nextEntries;
}
