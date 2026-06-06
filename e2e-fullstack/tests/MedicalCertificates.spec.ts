import { expect, test, type Page } from '@playwright/test';

/**
 * Tests E2E Full-Stack para la vista de Certificados Médicos.
 * No usa mocks: Playwright interactúa con el frontend real, la API real
 * y la base de datos PostgreSQL de test levantada con Docker Compose.
 *
 * Cada test prepara sus propios datos para no depender del orden de ejecución.
 */

const API_URL = 'http://localhost:3001/api/v1';
const TEST_MEMBER_DNI = '12345678';

function uniqueDoctorLicense(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function getTestMemberId(): Promise<string> {
    // Obtenemos el id del socio precargado por global-setup (DNI 12345678)
    const response = await fetch(`${API_URL}/socios`);
    if (!response.ok) {
        throw new Error(`No se pudo obtener la lista de socios: ${response.status}`);
    }
    const body = await response.json();
    const members = body.data || body;
    const testMember = members.find((m: any) => m.dni === TEST_MEMBER_DNI);
    if (!testMember) {
        throw new Error(`No se encontró el socio de prueba con DNI ${TEST_MEMBER_DNI}`);
    }
    return testMember.id;
}

async function createCertificateByApi(data: {
    doctorLicense: string;
    memberId?: string;
    issueDate?: string;
    expiryDate?: string;
}) {
    const memberId = data.memberId || await getTestMemberId();
    const response = await fetch(`${API_URL}/medical-certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            memberId,
            issueDate: data.issueDate || '2026-06-01',
            expiryDate: data.expiryDate || '2027-06-01',
            doctorLicense: data.doctorLicense,
        }),
    });

    if (!response.ok) {
        throw new Error(`No se pudo preparar el certificado: ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    return body.data;
}

async function validateCertificateByApi(certificateId: string) {
    const response = await fetch(`${API_URL}/medical-certificates/${certificateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isValidated: true }),
    });

    if (!response.ok) {
        throw new Error(`No se pudo validar el certificado: ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    return body.data;
}

async function waitForCertificatesPage(page: Page) {
    await page.goto('/medical-certificates');
    // Esperamos a que la página esté lista 
    await page.waitForLoadState('networkidle');
}

function certificateRow(page: Page, doctorLicense: string) {
    return page.locator('tr').filter({ hasText: doctorLicense });
}

test.describe('MedicalCertificates Full-Stack E2E', () => {
    test.setTimeout(60_000);

    // test e2e 110 - debe crear un certificado médico real y mostrarlo en la tabla
    test('debe crear un certificado médico real y mostrarlo en la tabla', async ({ page }) => {
        const doctorLicense = uniqueDoctorLicense('MN-CREATE');

        await waitForCertificatesPage(page);

        // Abrir el modal de creación
        await page.getByRole('button', { name: /Agregar Certificado/i }).click();
        await expect(page.getByText('Agregar Nuevo Certificado Médico')).toBeVisible();

        // Seleccionar el socio del dropdown (el cargado en global-setup)
        await page.getByRole('combobox').click();
        await page.getByText(/Socio E2E Test/).click();

        // Llenar las fechas y la matrícula
        await page.getByLabel(/Fecha de Emisión/i).fill('2026-06-01');
        await page.getByLabel(/Fecha de Vencimiento/i).fill('2027-06-01');
        await page.getByPlaceholder('Ej. MN-12345').fill(doctorLicense);

        // Confirmar la creación
        await page.getByRole('button', { name: 'Crear Certificado' }).click();

        // El modal debe cerrarse y el certificado aparecer en la tabla
        await expect(page.getByRole('button', { name: 'Crear Certificado' })).toBeHidden();
        await expect(page.getByText(doctorLicense)).toBeVisible({ timeout: 10000 });
        const row = certificateRow(page, doctorLicense);
        await expect(row).toContainText('Socio E2E Test');
        await expect(row).toContainText('Pendiente');
    });
});

