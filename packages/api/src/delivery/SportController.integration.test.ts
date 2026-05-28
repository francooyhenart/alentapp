import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { CreateSportRequest } from '@alentapp/shared';
import { buildApp } from '../app.js';

vi.mock('../infrastructure/PostgresMemberRepository.js', () => {
    return {
        PostgresMemberRepository: class {
            async findAll() { return []; }
            async findById() { return null; }
            async findByDni() { return null; }
            async findByEmail() { return null; }
            async create(data: any) { return { id: 'member-id', ...data }; }
            async update(id: string, data: any) { return { id, ...data }; }
            async delete() { return; }
        },
    };
});

vi.mock('../infrastructure/PrismaLockerRepository.js', () => {
    return {
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
    };
});

vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => {
    return {
        PostgresMedicalCertificateRepository: class {
            async create(data: any) { return { id: 'certificate-id', ...data, isValidated: false }; }
            async findAll() { return []; }
            async findById() { return null; }
            async findByMemberId() { return []; }
            async update(id: string, data: any) { return { id, ...data }; }
            async delete() { return; }
        },
    };
});

vi.mock('../infrastructure/di/container.js', () => {
    class MockDependencyContainer {
        static getInstance() {
            return new MockDependencyContainer();
        }

        getEquipmentLoanController() {
            return {
                list: async (_request: any, reply: any) => reply.status(200).send({ data: [] }),
                create: async (_request: any, reply: any) => reply.status(201).send({ data: {} }),
                returnLoan: async (_request: any, reply: any) => reply.status(200).send({ data: {} }),
                cancelLoan: async (_request: any, reply: any) => reply.status(200).send({ data: {} }),
            };
        }
    }

    return {
        DependencyContainer: MockDependencyContainer,
    };
});

vi.mock('../infrastructure/PrismaSportRepository.js', () => {
    return {
        PrismaSportRepository: class {
            async findAll(name?: string) {
                if (name === 'Tenis') {
                    return [
                        {
                            id: 'sport-id-2',
                            name: 'Tenis',
                            description: 'Actividad de tenis',
                            max_capacity: 12,
                            additional_price: 1500,
                            requires_medical_certificate: true,
                        },
                    ];
                }

                return [
                    {
                        id: 'sport-id-1',
                        name: 'Basquet',
                        description: 'Actividad de basquet',
                        max_capacity: 20,
                        additional_price: 1000,
                        requires_medical_certificate: false,
                    },
                    {
                        id: 'sport-id-2',
                        name: 'Tenis',
                        description: 'Actividad de tenis',
                        max_capacity: 12,
                        additional_price: 1500,
                        requires_medical_certificate: true,
                    },
                ];
            }
            async findByName(name: string) {
                return name === 'Deporte duplicado'
                    ? {
                        id: 'existing-sport-id',
                        name: 'Deporte duplicado',
                        description: 'Actividad existente',
                        max_capacity: 10,
                        additional_price: 500,
                        requires_medical_certificate: false,
                    }
                    : null;
            }
            async findById() { return null; }
            async create(data: any) {
                return {
                    ...data,
                    id: 'new-sport-id',
                };
            }
            async update(id: string, data: any) { return { id, name: 'Tenis', additional_price: 1500, requires_medical_certificate: true, ...data }; }
            async deleteById() { return; }
        },
    };
});

describe('Sport API Integration Tests', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app?.close();
    });

    describe('POST /api/v1/sports', () => {
        //test de integración 29 - POST: debe crear un deporte correctamente
        it('debe crear un deporte correctamente', async () => {
            const payload: CreateSportRequest = {
                name: 'Tenis',
                description: 'Actividad de tenis',
                max_capacity: 20,
                additional_price: 1500,
                requires_medical_certificate: true,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data).toEqual({
                id: 'new-sport-id',
                name: 'Tenis',
                description: 'Actividad de tenis',
                max_capacity: 20,
                additional_price: 1500,
                requires_medical_certificate: true,
            });
        });

        //test de integración 30 - POST: debe retornar 400 si el nombre del deporte esta vacio
        it('debe retornar 400 si el nombre del deporte esta vacio', async () => {
            const payload: CreateSportRequest = {
                name: '   ',
                description: 'Actividad sin nombre',
                max_capacity: 20,
                additional_price: 1500,
                requires_medical_certificate: true,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('El nombre del deporte es obligatorio');
        });

        //test de integración 31 - POST: debe retornar 400 si el cupo maximo es menor o igual a cero
        it('debe retornar 400 si el cupo maximo es menor o igual a cero', async () => {
            const payload: CreateSportRequest = {
                name: 'Basquet',
                description: 'Actividad de basquet',
                max_capacity: 0,
                additional_price: 1500,
                requires_medical_certificate: false,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('El cupo maximo debe ser mayor a cero');
        });

        //test de integración 32 - POST: debe retornar 409 si ya existe un deporte con el mismo nombre
        it('debe retornar 409 si ya existe un deporte con el mismo nombre', async () => {
            const payload: CreateSportRequest = {
                name: 'Deporte duplicado',
                description: 'Actividad duplicada',
                max_capacity: 15,
                additional_price: 1000,
                requires_medical_certificate: false,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(409);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Ya existe un deporte con ese nombre');
        });

        //test de integración 33 - POST: debe retornar 400 si el precio adicional es negativo
        it('debe retornar 400 si el precio adicional es negativo', async () => {
            const payload: CreateSportRequest = {
                name: 'Hockey',
                description: 'Actividad de hockey',
                max_capacity: 18,
                additional_price: -1,
                requires_medical_certificate: true,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('El precio adicional no puede ser negativo');
        });

        //test de integración 34 - POST: debe retornar 400 si el cupo maximo no es entero
        it('debe retornar 400 si el cupo maximo no es entero', async () => {
            const payload: CreateSportRequest = {
                name: 'Voley',
                description: 'Actividad de voley',
                max_capacity: 12.5,
                additional_price: 900,
                requires_medical_certificate: false,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('El cupo maximo debe ser un numero entero');
        });

        //test de integración 35 - POST: debe crear un deporte con precio adicional por defecto en cero
        it('debe crear un deporte con precio adicional por defecto en cero', async () => {
            const payload: CreateSportRequest = {
                name: 'Rugby',
                description: 'Actividad de rugby',
                max_capacity: 25,
                requires_medical_certificate: false,
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/sports',
                payload,
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data).toEqual({
                id: 'new-sport-id',
                name: 'Rugby',
                description: 'Actividad de rugby',
                max_capacity: 25,
                additional_price: 0,
                requires_medical_certificate: false,
            });
        });
    });

    describe('GET /api/v1/sports', () => {
        //test de integración 42 - GET: debe retornar el listado de deportes
        it('debe retornar el listado de deportes', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/sports',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data).toEqual([
                {
                    id: 'sport-id-1',
                    name: 'Basquet',
                    description: 'Actividad de basquet',
                    max_capacity: 20,
                    additional_price: 1000,
                    requires_medical_certificate: false,
                },
                {
                    id: 'sport-id-2',
                    name: 'Tenis',
                    description: 'Actividad de tenis',
                    max_capacity: 12,
                    additional_price: 1500,
                    requires_medical_certificate: true,
                },
            ]);
        });

        //test de integración 43 - GET: debe buscar deportes por nombre
        it('debe buscar deportes por nombre', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/sports?name=Tenis',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data).toEqual([
                {
                    id: 'sport-id-2',
                    name: 'Tenis',
                    description: 'Actividad de tenis',
                    max_capacity: 12,
                    additional_price: 1500,
                    requires_medical_certificate: true,
                },
            ]);
        });
    });
});
