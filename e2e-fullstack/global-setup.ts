/**
 * global-setup.ts para Playwright Full-Stack E2E con Docker Compose.
 *
 * Docker Compose (docker-compose.e2e.yml) se encarga de levantar:
 *   - db-test    → PostgreSQL en localhost:5433
 *   - api-test   → Fastify en localhost:3001
 *   - web-test   → Vite en localhost:5174
 *
 * Este script:
 *   1. Espera a que la API esté respondiendo (poll)
 *   2. Limpia todas las tablas para empezar desde un estado limpio
 *   3. Inserta un socio de prueba con DNI 12345678 para los tests de préstamos
 */
import type { FullConfig } from '@playwright/test';
import pg from 'pg';

const API_URL = 'http://localhost:3001';
const DB_URL = 'postgresql://admin:password123@localhost:5433/alentapp_test_db';
const MAX_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

async function waitForApi(): Promise<void> {
    const start = Date.now();
    process.stdout.write('[E2E Setup] Esperando API...');
    while (Date.now() - start < MAX_WAIT_MS) {
        try {
            const res = await fetch(`${API_URL}/`);
            if (res.ok || res.status < 500) {
                console.log(' ✓ lista.');
                return;
            }
        } catch {
            // API todavía no levantó
        }
        process.stdout.write('.');
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(`[E2E Setup] La API no respondió después de ${MAX_WAIT_MS / 1000}s. ¿Está corriendo docker-compose.e2e.yml?`);
}

async function cleanDatabase(): Promise<void> {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
        const res = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename != '_prisma_migrations';
        `);
        const tables = res.rows.map(row => `"${row.tablename}"`).join(', ');
        if (tables) {
            await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
            console.log(`[E2E Setup] Tablas limpiadas: ${tables}`);
        }
    } catch (error) {
        console.error('[E2E Setup] Error al limpiar la base de datos:', error);
        throw error;
    } finally {
        await client.end();
    }
}

async function seedTestMember(): Promise<void> {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
        await client.query(`
            INSERT INTO members (id, name, dni, email, birthdate, category, status)
            VALUES (
                gen_random_uuid(),
                'Socio E2E Test',
                '12345678',
                'e2e@test.com',
                '1990-01-01',
                'Pleno',
                'Activo'
            )
            ON CONFLICT (dni) DO NOTHING;
        `);
        console.log('[E2E Setup] Socio de prueba creado (DNI: 12345678).');
    } catch (error) {
        console.error('[E2E Setup] Error al crear socio de prueba:', error);
        throw error;
    } finally {
        await client.end();
    }
}

export default async function globalSetup(_config: FullConfig) {
    await waitForApi();
    await cleanDatabase();
    await seedTestMember();
    console.log('[E2E Setup] Listo. Corriendo tests...');
}