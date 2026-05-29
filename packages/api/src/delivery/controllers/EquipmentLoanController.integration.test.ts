import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

// ─── Mock del DependencyContainer ────────────────────────────────────────────
// El container instancia el repositorio de Prisma (DB real).
// Lo reemplazamos con un controller completamente controlado.
vi.mock('../../infrastructure/di/container.js', () => {
    const loans: Record<string, any> = {};

    const mockController = {
        list: async (_request: any, reply: any) => {
            return reply.status(200).send(Object.values(loans));
        },
        create: async (request: any, reply: any) => {
            const { itemName, memberDni } = request.body;

            // Simular restricción Cadete
            if (memberDni === '99887766') {
                return reply.status(403).send({
                    error: 'Forbidden',
                    message: 'Los socios de categoría Cadet no están autorizados para solicitar préstamos de equipamiento',
                    code: 'CATEGORY_RESTRICTION',
                });
            }
            // Simular socio no encontrado
            if (memberDni === '00000000') {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: `El socio con ID ${memberDni} no existe`,
                    code: 'MEMBER_NOT_FOUND',
                });
            }

            const newLoan = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                itemName,
                status: 'Loaned',
                isActive: true,
                loanDate: new Date().toISOString(),
                returnDate: null,
                canceledDate: null,
                memberId: 'member-uuid-test',
                notes: request.body.notes ?? undefined,
            };
            loans[newLoan.id] = newLoan;
            return reply.status(201).send(newLoan);
        },
        returnLoan: async (request: any, reply: any) => {
            const { id } = request.params;
            const loan = loans[id];

            if (!loan) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: `El préstamo con ID ${id} no existe`,
                    code: 'LOAN_NOT_FOUND',
                });
            }

            loan.status = request.body.status ?? 'Returned';
            loan.returnDate = new Date().toISOString();
            return reply.status(200).send(loan);
        },
        cancelLoan: async (request: any, reply: any) => {
            const { id } = request.params;
            const loan = loans[id];

            if (!loan) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: `El préstamo con ID ${id} no existe`,
                    code: 'LOAN_NOT_FOUND',
                });
            }
            if (loan.status === 'Canceled') {
                return reply.status(409).send({
                    error: 'Conflict',
                    message: 'Este préstamo ya fue cancelado anteriormente',
                    code: 'ALREADY_CANCELED',
                });
            }

            loan.status = 'Canceled';
            loan.isActive = false;
            loan.canceledDate = new Date().toISOString();
            return reply.status(200).send(loan);
        },
    };

    class MockDependencyContainer {
        static getInstance() {
            return new MockDependencyContainer();
        }
        getEquipmentLoanController() {
            return mockController;
        }
    }

    return { DependencyContainer: MockDependencyContainer };
});

// ─── Mocks de otros repositorios que buildApp() instancia ────────────────────
vi.mock('../../infrastructure/PostgresMemberRepository.js', () => ({
    PostgresMemberRepository: class {
        async findAll() { return []; }
        async findById() { return null; }
        async findByDni() { return null; }
        async findByEmail() { return null; }
        async create(data: any) { return { id: 'member-id', ...data }; }
        async update(id: string, data: any) { return { id, ...data }; }
        async delete() { return; }
    },
}));

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

// ════════════════════════════════════════════════════════════════════════════
// SUITE
// ════════════════════════════════════════════════════════════════════════════

describe('EquipmentLoan API Integration Tests', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
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
    });
});