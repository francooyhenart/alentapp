import { expect, test, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

function uniqueLockerNumber(): number {
  return Math.floor(10000 + Math.random() * 90000);
}

async function waitForLockersPage(page: Page) {
  await page.goto('/lockers');
  await expect(page.getByRole('heading', { name: /Panel de Casilleros/i })).toBeVisible({ timeout: 20000 });
}

async function createLockerByApi(data: { number: number; location: string; status?: 'Available' | 'Occupied' | 'Maintenance'; member_id?: string | null }) {
  const response = await fetch(`${API_URL}/lockers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Available',
      member_id: null,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo preparar el casillero ${data.number}: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  return body.data;
}

function lockerCard(page: Page, lockerNumber: number) {
  return page.locator('div').filter({ has: page.locator('text=' + `Casillero #${lockerNumber}`).first() }).locator('xpath=ancestor::div[button or p][1]').first();
}

test.describe('Lockers Full-Stack E2E', () => {

  test('debe dar de alta un nuevo casillero y mostrarlo en la lista', async ({ page }) => {
    const lockerNumber = uniqueLockerNumber();
    const location = 'Vestuario Masculino de Prueba';

    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('¡Casillero creado con éxito!');
      await dialog.accept();
    });

    await waitForLockersPage(page);

    await page.getByPlaceholder('Ej: 106').fill(String(lockerNumber));
    await page.getByPlaceholder('Ej: Vestuarios').fill(location);
    
    await page.getByRole('button', { name: /Crear Casillero/i }).click();

    const card = page.locator('div').filter({ has: page.locator('text=' + `Casillero #${lockerNumber}`).first() }).locator('xpath=ancestor::div[button or p][1]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(location);
    await expect(card).toContainText('Disponible');
  });

  test('debe mostrar error o alerta si se intenta duplicar un número de casillero', async ({ page }) => {
    const lockerNumber = uniqueLockerNumber();
    
    await createLockerByApi({
      number: lockerNumber,
      location: 'Pasillo Central',
    });

    page.on('dialog', async (dialog) => {
      expect(dialog.message()).not.toContain('¡Casillero creado con éxito!');
      await dialog.accept();
    });

    await waitForLockersPage(page);

    await page.getByPlaceholder('Ej: 106').fill(String(lockerNumber));
    await page.getByPlaceholder('Ej: Vestuarios').fill('Zona de Piletas');
    await page.getByRole('button', { name: /Crear Casillero/i }).click();
  });

  test('debe permitir reservar un casillero disponible asignándolo a un socio', async ({ page }) => {
    const lockerNumber = uniqueLockerNumber();
    
    await createLockerByApi({
      number: lockerNumber,
      location: 'Sector Gimnasio',
      status: 'Available'
    });

    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('reservado con éxito')) {
        await dialog.accept();
      }
    });

    await waitForLockersPage(page);

    const selectMember = page.locator('select');
    await selectMember.waitFor({ state: 'visible' });
    
    await selectMember.selectOption({ label: 'Socio E2E Test' });

    const card = page.locator('div').filter({ has: page.locator('text=' + `Casillero #${lockerNumber}`).first() }).locator('xpath=ancestor::div[button or p][1]').first();
    await card.locator('button', { hasText: /Reservar Casillero/i }).click();

    await expect(card.getByText('Ocupado')).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText('Socio E2E Test');
  });

  test('debe permitir enviar un casillero a mantenimiento y luego rehabilitarlo', async ({ page }) => {
    const lockerNumber = uniqueLockerNumber();

    await createLockerByApi({
      number: lockerNumber,
      location: 'Vestuario Femenino',
      status: 'Available'
    });

    page.on('dialog', (dialog) => dialog.accept());

    await waitForLockersPage(page);
    const card = lockerCard(page, lockerNumber);
    await expect(card).toBeVisible({ timeout: 15000 });

    await card.locator('button', { hasText: /Poner en Mantenimiento/i }).click();
    await expect(card.getByText('Mantenimiento')).toBeVisible({ timeout: 15000 });

    await card.locator('button', { hasText: /Rehabilitar Casillero/i }).click();
    await expect(card.getByText('Disponible')).toBeVisible({ timeout: 15000 });
  });

  test('debe permitir eliminar un casillero si este se encuentra disponible', async ({ page }) => {
    const lockerNumber = uniqueLockerNumber();

    await createLockerByApi({
      number: lockerNumber,
      location: 'Ubicación para borrar',
      status: 'Available'
    });

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await waitForLockersPage(page);
    const card = lockerCard(page, lockerNumber);
    await expect(card).toBeVisible({ timeout: 15000 });

    await card.locator('button[aria-label="Eliminar casillero"]').click();

    await expect(card).toBeHidden({ timeout: 15000 });
  });
});