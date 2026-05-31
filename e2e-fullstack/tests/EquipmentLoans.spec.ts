import { test, expect } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Préstamos de Equipamiento.
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5173
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * El global-setup se encarga de limpiar la DB antes de correr la suite,
 * por lo que cada test empieza desde un estado conocido y limpio.
 */

test.describe('EquipmentLoans Full-Stack E2E', () => {

    // test e2e 87 - debe mostrar el estado vacío cuando no hay préstamos en la DB
    test('debe mostrar el estado vacío cuando no hay préstamos en la DB', async ({ page }) => {
        await page.goto('/equipment-loans');
        await expect(
            page.getByText('No se encontraron préstamos registrados.')
        ).toBeVisible({ timeout: 10000 });
    });

    // test e2e 88 - debe registrar un préstamo real y mostrarlo en la tabla
    test('debe registrar un préstamo real y mostrarlo en la tabla', async ({ page }) => {
        await page.goto('/equipment-loans');

        // Abrir modal de creación
        await page.getByRole('button', { name: 'Registrar Préstamo' }).click();
        await expect(page.getByText('Registrar Nuevo Préstamo')).toBeVisible();

        // Llenar formulario
        await page.getByPlaceholder('Ej. Paleta de Pádel').fill('Raqueta E2E Test');
        await page.getByPlaceholder('Ej. 45123456').fill('12345678');

        // Confirmar
        await page.getByRole('button', { name: 'Crear Préstamo' }).click();

        // El modal debe cerrarse y el préstamo aparecer en la tabla
        await expect(page.getByRole('button', { name: 'Crear Préstamo' })).toBeHidden();
        await expect(page.getByText('Raqueta E2E Test')).toBeVisible({ timeout: 10000 });

        // El badge de estado debe ser "Prestado"
        await expect(page.getByText('Prestado').first()).toBeVisible();
    });

    // test e2e 89 - debe devolver el préstamo creado y reflejar el cambio de estado en la tabla
    test('debe devolver el préstamo creado y reflejar el cambio de estado en la tabla', async ({ page }) => {
        await page.goto('/equipment-loans');

        // El préstamo del test anterior debe estar visible
        await expect(page.getByText('Raqueta E2E Test')).toBeVisible({ timeout: 10000 });

        // Clic en "Devolver" de la primera fila activa
        await page.getByRole('button', { name: 'Devolver' }).first().click();
        await expect(page.getByText('Devolver Equipamiento')).toBeVisible();

        // Seleccionar "Buen Estado" (ya viene seleccionado por defecto) y confirmar
        await page.getByRole('button', { name: 'Confirmar Devolución' }).click();

        // El modal debe cerrarse y el estado cambiar a "Devuelto"
        await expect(page.getByRole('button', { name: 'Confirmar Devolución' })).toBeHidden();
        await expect(page.getByText('Devuelto').first()).toBeVisible({ timeout: 10000 });

        // El préstamo ya no debe mostrar los botones de acción activos
        await expect(page.getByText('Finalizado').first()).toBeVisible();
    });

});