import { test, expect } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Certificados Médicos.
 * NO hay ningún mock de red. Playwright interactúa con:
 *   - El Frontend React en http://localhost:5174
 *   - La API Fastify real en http://localhost:3001
 *   - La base de datos PostgreSQL de test (alentapp_test_db)
 *
 * El global-setup se encarga de limpiar la DB antes de correr la suite
 * y cargar un socio de prueba con DNI 12345678, que se usa para los
 * tests de creación de certificados.
 */

test.describe('MedicalCertificates Full-Stack E2E', () => {

    // test e2e 110 - debe crear un certificado médico real y mostrarlo en la tabla
    test('debe crear un certificado médico real y mostrarlo en la tabla', async ({ page }) => {
        await page.goto('/medical-certificates');

        // Abrir el modal de creación
        await page.getByRole('button', { name: /Agregar Certificado/i }).click();
        await expect(page.getByText('Agregar Nuevo Certificado Médico')).toBeVisible();

        // Seleccionar el socio del dropdown (el cargado en global-setup)
        await page.getByRole('combobox').click();
        await page.getByText(/Socio E2E Test/).click();

        // Llenar las fechas y la matrícula
        await page.getByLabel(/Fecha de Emisión/i).fill('2026-06-01');
        await page.getByLabel(/Fecha de Vencimiento/i).fill('2027-06-01');
        await page.getByPlaceholder('Ej. MN-12345').fill('MN-99999');

        // Confirmar la creación
        await page.getByRole('button', { name: 'Crear Certificado' }).click();

        // El modal debe cerrarse y el certificado aparecer en la tabla
        await expect(page.getByRole('button', { name: 'Crear Certificado' })).toBeHidden();
        await expect(page.getByText('MN-99999')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Socio E2E Test')).toBeVisible();
        await expect(page.getByText('Pendiente').first()).toBeVisible();
    });

    // test e2e 111 - debe validar un certificado pendiente y reflejar el cambio de estado
    test('debe validar un certificado pendiente y reflejar el cambio de estado', async ({ page }) => {
        await page.goto('/medical-certificates');

        // El certificado del test anterior debe estar visible
        await expect(page.getByText('MN-99999')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Pendiente').first()).toBeVisible();

        // Aceptar el confirm del navegador automáticamente
        page.on('dialog', (dialog) => dialog.accept());

        // Clic en el botón "Validar certificado"
        await page.getByRole('button', { name: /Validar certificado/i }).first().click();

        // El estado debe cambiar a "Validado"
        await expect(page.getByText('Validado').first()).toBeVisible({ timeout: 10000 });

        // El botón de validar ya no debe estar visible para este certificado
        await expect(page.getByRole('button', { name: /Validar certificado/i })).toBeHidden();
    });

    // test e2e 112 - debe eliminar un certificado y mostrar el estado vacío
    test('debe eliminar un certificado y mostrar el estado vacío', async ({ page }) => {
        await page.goto('/medical-certificates');

        // El certificado del test anterior debe seguir visible
        await expect(page.getByText('MN-99999')).toBeVisible({ timeout: 10000 });

        // Aceptar el confirm del navegador automáticamente
        page.on('dialog', (dialog) => dialog.accept());

        // Clic en el botón "Eliminar certificado"
        await page.getByRole('button', { name: /Eliminar certificado/i }).first().click();

        // El certificado debe desaparecer de la tabla
        await expect(page.getByText('MN-99999')).toBeHidden({ timeout: 10000 });

        // La tabla debe mostrar el estado vacío
        await expect(page.getByText('No se encontraron certificados médicos.')).toBeVisible();
    });
});