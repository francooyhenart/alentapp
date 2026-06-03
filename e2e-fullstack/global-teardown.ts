/**
 * global-teardown.ts para Playwright Full-Stack E2E.
 * Se ejecuta una vez despues de todos los tests.
 * Limpia la base de datos de test para que no queden datos creados por la suite.
 */
import pg from 'pg';

const DB_URL = 'postgresql://admin:password123@localhost:5433/alentapp_test_db';

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
            console.log(`[E2E Teardown] Tablas limpiadas: ${tables}`);
        }
    } catch (error) {
        console.error('[E2E Teardown] Error al limpiar la base de datos:', error);
        throw error;
    } finally {
        await client.end();
    }
}

export default async function globalTeardown() {
    await cleanDatabase();
}
