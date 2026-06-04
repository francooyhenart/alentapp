import { expect, test, type Page } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Deportes.
 * No usa mocks: Playwright interactua con el frontend real, la API real
 * y la base de datos PostgreSQL de test levantada con Docker Compose.
 *
 * Cada test prepara sus propios datos para no depender del orden de ejecucion.
 */

const API_URL = 'http://localhost:3001/api/v1';

function uniqueSportName(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForSportsPage(page: Page) {
  await page.goto('/sports');
  await expect(page.getByText('Cargando deportes...')).toBeHidden({ timeout: 30000 });
}

async function createSportByApi(data: {
  name: string;
  description: string;
  max_capacity?: number;
  additional_price?: number;
  requires_medical_certificate?: boolean;
}) {
  const response = await fetch(`${API_URL}/sports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_capacity: 12,
      additional_price: 1500,
      requires_medical_certificate: false,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo preparar el deporte ${data.name}: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  return body.data;
}

async function openCreateDialog(page: Page) {
  const addSportButton = page.getByRole('button', { name: /Agregar Deporte/i });
  await expect(addSportButton).toBeEnabled({ timeout: 10000 });
  await addSportButton.click();
  await expect(page.getByText('Agregar Nuevo Deporte')).toBeVisible();
}

async function fillCreateForm(page: Page, data: {
  name: string;
  description: string;
  max_capacity: number;
  additional_price: number;
}) {
  await page.getByRole('textbox', { name: 'Nombre' }).fill(data.name);
  await page.getByRole('textbox', { name: 'Descripcion' }).fill(data.description);
  await page.getByLabel(/Cupo maximo/i).fill(String(data.max_capacity));
  await page.getByLabel(/Precio adicional/i).fill(String(data.additional_price));
}

function sportRow(page: Page, sportName: string) {
  return page.locator('tr').filter({ hasText: sportName });
}

test.describe('Sports Full-Stack E2E', () => {
  test.setTimeout(60_000);

  // test 36 - e2e full-stack POST: debe crear un deporte real y mostrarlo en la tabla
  test('debe crear un deporte real y mostrarlo en la tabla', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Create E2E'),
      description: 'Actividad creada desde Playwright fullstack',
      max_capacity: 12,
      additional_price: 1500,
    };

    await waitForSportsPage(page);
    await openCreateDialog(page);
    await fillCreateForm(page, sport);

    await page.getByRole('button', { name: 'Crear Deporte' }).click();

    await expect(page.getByText(sport.name)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Crear Deporte' })).toBeHidden();
    const row = sportRow(page, sport.name);
    await expect(row).toContainText(sport.description);
    await expect(row).toContainText(String(sport.max_capacity));
    await expect(row).toContainText(`$${sport.additional_price}`);
  });

  // test 37 - e2e full-stack POST: debe mostrar error si el nombre del deporte ya existe
  test('debe mostrar error si se intenta crear un deporte con nombre repetido', async ({ page }) => {
    const sportName = uniqueSportName('Tenis Duplicado E2E');

    await createSportByApi({
      name: sportName,
      description: 'Actividad existente desde setup del test',
    });

    await waitForSportsPage(page);
    await expect(page.getByText(sportName)).toBeVisible({ timeout: 10000 });

    await openCreateDialog(page);
    await fillCreateForm(page, {
      name: sportName,
      description: 'Actividad duplicada desde Playwright fullstack',
      max_capacity: 8,
      additional_price: 1000,
    });

    await page.getByRole('button', { name: 'Crear Deporte' }).click();

    await expect(page.getByText('Ya existe un deporte con ese nombre')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Crear Deporte' })).toBeVisible();
  });

  // test 46 - e2e full-stack GET: debe mostrar el listado de deportes desde la base de datos real
  test('debe mostrar el listado de deportes desde la base de datos real', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Listado E2E'),
      description: 'Actividad listada desde Playwright fullstack',
      max_capacity: 14,
      additional_price: 1700,
    };

    await createSportByApi(sport);
    await waitForSportsPage(page);

    const row = sportRow(page, sport.name);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(sport.description);
    await expect(row).toContainText(String(sport.max_capacity));
    await expect(row).toContainText(`$${sport.additional_price}`);
    await expect(row).toContainText('No requerido');
  });

  // test 47 - e2e full-stack GET: debe buscar deportes por nombre en la base de datos real
  test('debe buscar deportes por nombre en la base de datos real', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Buscar E2E'),
      description: 'Actividad buscada desde Playwright fullstack',
      max_capacity: 10,
      additional_price: 1200,
    };

    await createSportByApi(sport);
    await waitForSportsPage(page);

    await page.getByLabel(/Buscar por nombre/i).fill(sport.name);
    await page.getByRole('button', { name: /Buscar/i }).click();

    const row = sportRow(page, sport.name);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(sport.description);
    await expect(row).toContainText(`$${sport.additional_price}`);
  });

  // test 48 - e2e full-stack GET: debe mostrar error si no hay deportes que coincidan en la base de datos real
  test('debe mostrar error si no hay deportes que coincidan en la base de datos real', async ({ page }) => {
    await waitForSportsPage(page);

    await page.getByLabel(/Buscar por nombre/i).fill(uniqueSportName('Deporte Inexistente Fullstack'));
    await page.getByRole('button', { name: /Buscar/i }).click();

    await expect(page.getByText('No se encontraron deportes')).toBeVisible({ timeout: 10000 });
  });

  // test 60 - e2e full-stack PATCH: debe actualizar un deporte en la base de datos real
  test('debe actualizar un deporte en la base de datos real', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Update E2E'),
      description: 'Actividad original desde Playwright fullstack',
      max_capacity: 12,
      additional_price: 1500,
    };

    await createSportByApi(sport);
    await waitForSportsPage(page);

    const row = sportRow(page, sport.name);
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.getByRole('button', { name: /Editar deporte/i }).click();
    await expect(page.getByText('Editar Deporte')).toBeVisible();

    await page.getByRole('textbox', { name: 'Descripcion' }).fill('Actividad actualizada desde Playwright fullstack');
    await page.getByLabel(/Cupo maximo/i).fill('20');

    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(page.getByRole('button', { name: 'Guardar Cambios' })).toBeHidden();
    await expect(sportRow(page, sport.name)).toContainText('Actividad actualizada desde Playwright fullstack', { timeout: 10000 });
    await expect(sportRow(page, sport.name)).toContainText('20');
  });

  // test 61 - e2e full-stack PATCH: debe impedir modificar el nombre del deporte desde la UI
  test('debe impedir modificar el nombre del deporte desde la UI', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Nombre Bloqueado E2E'),
      description: 'Actividad para validar nombre bloqueado',
    };

    await createSportByApi(sport);
    await waitForSportsPage(page);

    const row = sportRow(page, sport.name);
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.getByRole('button', { name: /Editar deporte/i }).click();
    await expect(page.getByText('Editar Deporte')).toBeVisible();

    const nameInput = page.getByRole('textbox', { name: 'Nombre' });
    await expect(nameInput).toBeDisabled();
    await expect(nameInput).toHaveValue(sport.name);
  });

  // test 67 - e2e full-stack DELETE: debe eliminar un deporte de la base de datos real
  test('debe eliminar un deporte de la base de datos real', async ({ page }) => {
    const sport = {
      name: uniqueSportName('Tenis Delete E2E'),
      description: 'Actividad para eliminar desde Playwright fullstack',
    };

    await createSportByApi(sport);
    await waitForSportsPage(page);

    const row = sportRow(page, sport.name);
    await expect(row).toBeVisible({ timeout: 10000 });

    page.on('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: /Eliminar deporte/i }).click();

    await expect(sportRow(page, sport.name)).toBeHidden({ timeout: 10000 });
  });
});
