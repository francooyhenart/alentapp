import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * Tests E2E Full-Stack para la vista de Préstamos de Equipamiento.
 * No usa mocks: Playwright interactúa con el frontend real, la API real
 * y la base de datos PostgreSQL de test levantada con Docker Compose.
 *
 * Cada test prepara sus propios datos para no depender del orden de ejecución.
 */

const API_URL = 'http://localhost:3001/api/v1';
const DB_URL = 'postgresql://admin:password123@localhost:5433/alentapp_test_db';

function uniqueItemName(prefix: string) {
    return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForLoansPage(page: Page) {
    await page.goto('/equipment-loans');
    await expect(page.getByText('Cargando préstamos...')).toBeHidden({ timeout: 30000 });
}

async function cleanLoansTable() {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
        await client.query('TRUNCATE TABLE "equipment_loans" RESTART IDENTITY CASCADE');
    } finally {
        await client.end();
    }
}

async function createLoanByApi(data: { itemName: string; memberDni: string; notes?: string }) {
    const response = await fetch(`${API_URL}/equipment-loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`No se pudo preparar el préstamo ${data.itemName}: ${response.status} ${await response.text()}`);
    }

    return await response.json();
}

function loanRow(page: Page, itemName: string) {
    return page.locator('tr').filter({ hasText: itemName });
}

test.describe('EquipmentLoans Full-Stack E2E', () => {
    test.setTimeout(60_000);

    test.beforeEach(async () => {
        await cleanLoansTable();
    });

    // test e2e 87 - debe mostrar el estado vacío cuando no hay préstamos en la DB
    test('debe mostrar el estado vacío cuando no hay préstamos en la DB', async ({ page }) => {
        await waitForLoansPage(page);
        await expect(
            page.getByText('No se encontraron préstamos registrados.')
        ).toBeVisible({ timeout: 10000 });
    });

    // test e2e 88 - debe registrar un préstamo real y mostrarlo en la tabla
    test('debe registrar un préstamo real y mostrarlo en la tabla', async ({ page }) => {
        const itemName = uniqueItemName('Raqueta E2E');

        await waitForLoansPage(page);

        // Abrir modal de creación
        await page.getByRole('button', { name: 'Registrar Préstamo' }).click();
        await expect(page.getByText('Registrar Nuevo Préstamo')).toBeVisible();

        // Llenar formulario
        await page.getByPlaceholder('Ej. Paleta de Pádel').fill(itemName);
        await page.getByPlaceholder('Ej. 45123456').fill('12345678');

        // Confirmar
        await page.getByRole('button', { name: 'Crear Préstamo' }).click();

        // El modal debe cerrarse y el préstamo aparecer en la tabla
        await expect(page.getByRole('button', { name: 'Crear Préstamo' })).toBeHidden();
        await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });

        // El badge de estado debe ser "Prestado"
        const row = loanRow(page, itemName);
        await expect(row).toContainText('Prestado');
    });

    // test e2e 89 - debe devolver un préstamo y reflejar el cambio de estado en la tabla
    test('debe devolver un préstamo y reflejar el cambio de estado en la tabla', async ({ page }) => {
        const itemName = uniqueItemName('Paleta Devolucion E2E');

        // Preparar datos propios vía API sin depender del test anterior
        await createLoanByApi({ itemName, memberDni: '12345678' });

        await waitForLoansPage(page);

        const row = loanRow(page, itemName);
        await expect(row).toBeVisible({ timeout: 10000 });
        await expect(row).toContainText('Prestado');

        // Clic en "Devolver" de la fila específica
        await row.getByRole('button', { name: 'Devolver' }).click();
        await expect(page.getByText('Devolver Equipamiento')).toBeVisible();

        // Confirmar devolución en buen estado
        await page.getByRole('button', { name: 'Confirmar Devolución' }).click();

        // El modal debe cerrarse y el estado cambiar a "Devuelto"
        await expect(page.getByRole('button', { name: 'Confirmar Devolución' })).toBeHidden();
        await expect(row).toContainText('Devuelto', { timeout: 10000 });
        await expect(row).toContainText('Finalizado');
    });
});