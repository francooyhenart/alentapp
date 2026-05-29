import { test, expect } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Deportes.
 * No usa mocks: Playwright interactua con el frontend real, la API real
 * y la base de datos PostgreSQL de test levantada con Docker Compose.
 */

test.describe('Sports Full-Stack E2E', () => {
  // test 36 - e2e full-stack POST: debe crear un deporte real y mostrarlo en la tabla
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

  // test 37 - e2e full-stack POST: debe mostrar error si el nombre del deporte ya existe
  test('debe mostrar error si se intenta crear un deporte con nombre repetido', async ({ page }) => {
    await page.goto('/sports');

    await expect(page.getByText('Tenis Fullstack E2E')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Agregar Deporte")').click();
    await expect(page.getByText('Agregar Nuevo Deporte')).toBeVisible();

    await page.getByRole('textbox', { name: 'Nombre' }).fill('Tenis Fullstack E2E');
    await page.getByRole('textbox', { name: 'Descripcion' }).fill('Actividad duplicada desde Playwright fullstack');
    await page.getByLabel(/Cupo maximo/i).fill('8');
    await page.getByLabel(/Precio adicional/i).fill('1000');

    await page.getByRole('button', { name: 'Crear Deporte' }).click();

    await expect(page.getByText('Ya existe un deporte con ese nombre')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Crear Deporte' })).toBeVisible();
  });

  // test 46 - e2e full-stack GET: debe mostrar el listado de deportes desde la base de datos real
  test('debe mostrar el listado de deportes desde la base de datos real', async ({ page }) => {
    await page.goto('/sports');

    await expect(page.getByText('Tenis Fullstack E2E')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Actividad creada desde Playwright fullstack')).toBeVisible();
    await expect(page.getByText('12')).toBeVisible();
    await expect(page.getByText('$1500')).toBeVisible();
    await expect(page.getByText('No requerido')).toBeVisible();
  });

  // test 47 - e2e full-stack GET: debe buscar deportes por nombre en la base de datos real
  test('debe buscar deportes por nombre en la base de datos real', async ({ page }) => {
    await page.goto('/sports');

    await page.getByLabel(/Buscar por nombre/i).fill('Tenis Fullstack E2E');
    await page.getByRole('button', { name: /Buscar/i }).click();

    await expect(page.getByText('Tenis Fullstack E2E')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Actividad creada desde Playwright fullstack')).toBeVisible();
    await expect(page.getByText('$1500')).toBeVisible();
  });
});
