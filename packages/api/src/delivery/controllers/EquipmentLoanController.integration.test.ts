import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan.js';
import { LoanStatusVO } from '../../domain/value-objects/LoanStatus.js';

// ─── Repositorio en memoria ──────────────────────────────────────────────────
// Mockeamos PrismaEquipmentLoanRepository con una implementación en memoria.
// Así el controller real + use cases reales se ejecutan, sin tocar la DB.

const store: Map<string, EquipmentLoan> = new Map();

vi.mock('../../infrastructure/repositories/PrismaEquipmentLoanRepository.js', () => ({
    PrismaEquipmentLoanRepository: class {
        async create(loan: EquipmentLoan): Promise<EquipmentLoan> {
            store.set(loan.id, loan);
            return loan;
        }
        async findById(id: string): Promise<EquipmentLoan | null> {
            return store.get(id) ?? null;
        }
        async update(loan: EquipmentLoan): Promise<EquipmentLoan> {
            store.set(loan.id, loan);
            return loan;
        }
        async findAll(): Promise<EquipmentLoan[]> {
            return Array.from(store.values()).filter(l => l.isActive);
        }
    },
}));

// ─── Mock de PostgresMemberRepository ───────────────────────────────────────
// Simulamos dos socios: uno Pleno (DNI 12345678) y uno Cadete (DNI 99887766).

vi.mock('../../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findByDni(dni: string) {
            if (dni === '12345678') return { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', category: 'Pleno', dni };
            if (dni === '99887766') return { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', category: 'Cadete', dni };
            return null;
        }
        async findAll() { return []; }
        async findById() { return null; }
        async findByEmail() { return null; }
        async create(data: any) { return { id: 'member-id', ...data }; }
        async update(id: string, data: any) { return { id, ...data }; }
        async delete() { return; }
    },
}));

// ─── Mocks de repositorios que buildApp() instancia (no relacionados) ────────

vi.mock('../../infrastructure/PrismaLockerRepository.js', () => ({
    PrismaLockerRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByNumber() { return null; }
        async create(data: any) { return { id: 'locker-id', status: 'Available', ...data }; }
        async deleteById() { return; }
        async update() { return null; }
        async reserve() { return null; }
        async release() { return null; }
        async updateStatus() { return null; }
    },
}));

vi.mock('../../infrastructure/PostgresMedicalCertificateRepository.js', () => ({
    PostgresMedicalCertificateRepository: class {
        async create(data: any) { return { id: 'certificate-id', ...data, isValidated: false }; }
        async findAll() { return []; }
        async findById() { return null; }
        async findByMemberId() { return []; }
        async update(id: string, data: any) { return { id, ...data }; }
        async delete() { return; }
    },
}));

vi.mock('../../infrastructure/PrismaSportRepository.js', () => ({
    PrismaSportRepository: class {
        async findAll() { return []; }
        async findByName() { return null; }
        async findById() { return null; }
        async create(data: any) { return { id: 'sport-id', ...data }; }
        async update(id: string, data: any) { return { id, ...data }; }
        async deleteById() { return; }
    },
}));

// ─── Mock del DependencyContainer ────────────────────────────────────────────
// Lo mockeamos solo para evitar que intente conectarse a Prisma/DB real.
// getEquipmentLoanController() instancia el controller real con los repos mockeados.

vi.mock('../../infrastructure/di/container.js', async (importOriginal) => {
    const { PrismaEquipmentLoanRepository } = await import('../../infrastructure/repositories/PrismaEquipmentLoanRepository.js');
    const { PostgresMemberRepository } = await import('../../infrastructure/PostgresMemberRepository.js');
    const { CreateEquipmentLoanUseCase } = await import('../../application/use-cases/CreateEquipmentLoanUseCase.js');
    const { ReturnEquipmentLoanUseCase } = await import('../../application/use-cases/ReturnEquipmentLoanUseCase.js');
    const { GetEquipmentLoansUseCase } = await import('../../application/use-cases/GetEquipmentLoansUseCase.js');
    const { CancelEquipmentLoanUseCase } = await import('../../application/use-cases/CancelEquipmentLoanUseCase.js');
    const { EquipmentLoanController } = await import('../../delivery/controllers/EquipmentLoanController.js');

    class MockDependencyContainer {
        static getInstance() {
            return new MockDependencyContainer();
        }
        getEquipmentLoanController() {
            const loanRepo = new PrismaEquipmentLoanRepository({} as any);
            const memberRepo = new PostgresMemberRepository();
            return new EquipmentLoanController(
                new CreateEquipmentLoanUseCase(loanRepo, memberRepo),
                new ReturnEquipmentLoanUseCase(loanRepo),
                new GetEquipmentLoansUseCase(loanRepo),
                new CancelEquipmentLoanUseCase(loanRepo),
            );
        }
    }

    return { DependencyContainer: MockDependencyContainer };
});

// ════════════════════════════════════════════════════════════════════════════
// SUITE
// ════════════════════════════════════════════════════════════════════════════

describe('EquipmentLoan API Integration Tests', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        store.clear();
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app?.close();
    });

    // ── POST /api/v1/equipment-loans ────────────────────────────────────────

    describe('POST /api/v1/equipment-loans', () => {

        // test de integración 80 - POST: debe crear un préstamo correctamente y retornar 201
        it('debe crear un préstamo correctamente y retornar 201', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/equipment-loans',
                payload: {
                    itemName: 'Raqueta de tenis',
                    memberDni: '12345678',
                },
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.itemName).toBe('Raqueta de tenis');
            expect(body.status).toBe('Loaned');
            expect(body.isActive).toBe(true);
        });

        // test de integración 81 - POST: debe retornar 403 si el socio es de categoría Cadete
        it('debe retornar 403 si el socio es de categoría Cadete', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/equipment-loans',
                payload: {
                    itemName: 'Pelota de rugby',
                    memberDni: '99887766',
                },
            });

            expect(response.statusCode).toBe(403);
            const body = JSON.parse(response.payload);
            expect(body.code).toBe('CATEGORY_RESTRICTION');
        });

        // test de integración 82 - POST: debe retornar 400 si el itemName tiene menos de 3 caracteres
        it('debe retornar 400 si el itemName tiene menos de 3 caracteres', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/equipment-loans',
                payload: {
                    itemName: 'AB',
                    memberDni: '12345678',
                },
            });

            expect(response.statusCode).toBe(400);
        });
    });

    // ── GET /api/v1/equipment-loans ─────────────────────────────────────────

    describe('GET /api/v1/equipment-loans', () => {

        // test de integración 83 - GET: debe retornar 200 y el listado de préstamos
        it('debe retornar 200 y el listado de préstamos', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/equipment-loans',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(Array.isArray(body)).toBe(true);
        });
    });

    // ── PATCH /api/v1/equipment-loans/:id/return ────────────────────────────

    describe('PATCH /api/v1/equipment-loans/:id/return', () => {

        // test de integración 84 - PATCH return: debe retornar 200 y el préstamo con estado Returned
        it('debe retornar 200 y el préstamo con estado Returned', async () => {
            const created = await app.inject({
                method: 'POST',
                url: '/api/v1/equipment-loans',
                payload: { itemName: 'Paleta de pádel', memberDni: '12345678' },
            });
            const { id } = JSON.parse(created.payload);

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/equipment-loans/${id}/return`,
                payload: { status: 'Returned' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('Returned');
            expect(body.returnDate).not.toBeNull();
        });

        // test de integración 85 - PATCH return: debe retornar 404 si el préstamo no existe
        it('debe retornar 404 si el préstamo no existe', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/equipment-loans/00000000-0000-0000-0000-000000000000/return',
                payload: { status: 'Returned' },
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.payload);
            expect(body.code).toBe('LOAN_NOT_FOUND');
        });
    });

    // ── PATCH /api/v1/equipment-loans/:id/cancel ────────────────────────────

    describe('PATCH /api/v1/equipment-loans/:id/cancel', () => {

        // test de integración 86 - PATCH cancel: debe retornar 200 con isActive en false y estado Canceled
        it('debe retornar 200 con isActive en false y estado Canceled', async () => {
            const created = await app.inject({
                method: 'POST',
                url: '/api/v1/equipment-loans',
                payload: { itemName: 'Casco de ciclismo', memberDni: '12345678' },
            });
            const { id } = JSON.parse(created.payload);

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/equipment-loans/${id}/cancel`,
                payload: { reason: 'Cargado por error' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('Canceled');
            expect(body.isActive).toBe(false);
            expect(body.canceledDate).not.toBeNull();
        });
    });
});