import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readEnvTestFile() {
    const envPath = resolve(process.cwd(), 'packages/api/.env.test');

    if (!existsSync(envPath)) {
        return {};
    }

    const envContent = readFileSync(envPath, 'utf8');
    const values: Record<string, string> = {};

    for (const line of envContent.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^["']|["']$/g, '');

        values[key] = value;
    }

    return values;
}

export function getE2eDatabaseUrl() {
    const envTestValues = readEnvTestFile();
    const databaseUrl = process.env.E2E_DATABASE_URL
        ?? envTestValues.DATABASE_URL
        ?? process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL no esta configurada para los tests E2E full-stack. Defini E2E_DATABASE_URL o packages/api/.env.test.');
    }

    return databaseUrl;
}
