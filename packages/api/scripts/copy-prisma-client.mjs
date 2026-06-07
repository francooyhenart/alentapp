import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '..');
const source = resolve(apiRoot, 'src/generated/client');
const target = resolve(apiRoot, 'dist/generated/client');

if (!existsSync(source)) {
    throw new Error('Prisma client not found. Run npm run prisma:generate -w packages/api before building.');
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
