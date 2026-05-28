import { test, expect } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Deportes.
 * No usa mocks: Playwright interactua con el frontend real, la API real
 * y la base de datos PostgreSQL de test levantada con Docker Compose.
 */

test.describe('Sports Full-Stack E2E', () => {
  test('debe crear un deporte real y mostrarlo en la tabla', async ({ page }) => {
    await page.goto('/sports');

    await page.locator('button:has-text("Agregar Deporte")').click();
    await expect(page.getByText('Agregar Nuevo Deporte')).toBeVisible();

    await page.getByRole('textbox', { name: 'Nombre' }).fill('Tenis Fullstack E2E');
    await page.getByRole('textbox', { name: 'Descripcion' }).fill('Actividad creada desde Playwright fullstack');
    await page.getByLabel(/Cupo maximo/i).fill('12');
    await page.getByLabel(/Precio adicional/i).fill('1500');

    await page.getByRole('button', { name: 'Crear Deporte' }).click();

    await expect(page.getByRole('button', { name: 'Crear Deporte' })).toBeHidden();
    await expect(page.getByText('Tenis Fullstack E2E')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Actividad creada desde Playwright fullstack')).toBeVisible();
    await expect(page.getByText('12')).toBeVisible();
    await expect(page.getByText('$1500')).toBeVisible();
  });
});
