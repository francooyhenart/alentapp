import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { CreateMedicalCertificateRequest } from '@alentapp/shared';

// Mockeamos el repositorio del módulo de Members (lo usa el validador para verificar existencia)
vi.mock('../infrastructure/PostgresMemberRepository.js', () => {
    return {
        PostgresMemberRepository: class {
            async findAll() { return []; }
            async findById(id: string) {
                if (id === '550e8400-e29b-41d4-a716-446655440000') {
                    return { id, name: 'Socio Existente', dni: '12345678', email: 'socio@test.com', birthdate: '1990-01-01', category: 'Pleno', status: 'Activo' };
                }
                return null;
            }
            async findByDni() { return null; }
            async create(data: any) { return { id: 'new-uuid', ...data }; }
            async update(id: string, data: any) { return { id, ...data }; }
            async delete() { return; }
        }
    };
});

// Mockeamos el repositorio de Medical Certificate (estado en memoria para simular la BD)
vi.mock('../infrastructure/PostgresMedicalCertificateRepository.js', () => {
    // Estado interno del mock que persiste entre llamadas
    let certificatesStore: any[] = [];

    return {
        PostgresMedicalCertificateRepository: class {
            async findAll() {
                return certificatesStore.filter(c => c.deletedAt === null);
            }

            async findById(id: string) {
                const cert = certificatesStore.find(c => c.id === id);
                if (!cert || cert.deletedAt !== null) return null;
                return cert;
            }

            async createAndInvalidatePrevious(data: any) {
                // Invalidamos los certificados validados previos del mismo socio
                certificatesStore = certificatesStore.map(c => {
                    if (c.memberId === data.memberId && c.isValidated && c.deletedAt === null) {
                        return { ...c, isValidated: false };
                    }
                    return c;
                });

                const newCert = {
                    id: 'cert-' + (certificatesStore.length + 1),
                    memberId: data.memberId,
                    issueDate: data.issueDate,
                    expiryDate: data.expiryDate,
                    doctorLicense: data.doctorLicense,
                    isValidated: false,
                    deletedAt: null,
                };
                certificatesStore.push(newCert);
                return newCert;
            }

            async updateValidationStatus(id: string, isValidated: boolean) {
                const cert = certificatesStore.find(c => c.id === id);
                if (!cert) throw new Error('No encontrado');
                cert.isValidated = isValidated;
                return cert;
            }

            async validateAndInvalidateOthers(id: string, memberId: string) {
                // Invalidamos los otros certificados validados del mismo socio
                certificatesStore = certificatesStore.map(c => {
                    if (c.memberId === memberId && c.id !== id && c.isValidated && c.deletedAt === null) {
                        return { ...c, isValidated: false };
                    }
                    return c;
                });

                const cert = certificatesStore.find(c => c.id === id);
                if (!cert) throw new Error('No encontrado');
                cert.isValidated = true;
                return cert;
            }

            async softDelete(id: string) {
                const cert = certificatesStore.find(c => c.id === id);
                if (!cert) throw new Error('No encontrado');
                cert.deletedAt = new Date();
            }

            // Método auxiliar SOLO para tests: limpia el estado entre tests
            static _reset() {
                certificatesStore = [];
            }

            // Método auxiliar SOLO para tests: precarga datos
            static _preload(certs: any[]) {
                certificatesStore = certs;
            }
        }
    };
});

describe('MedicalCertificate API Integration Tests', () => {
    let app: FastifyInstance;
    const validMemberId = '550e8400-e29b-41d4-a716-446655440000';

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Reseteamos el estado del mock antes de cada test
        const { PostgresMedicalCertificateRepository } = await import('../infrastructure/PostgresMedicalCertificateRepository.js');
        (PostgresMedicalCertificateRepository as any)._reset();
    });

    describe('POST /api/v1/medical-certificates', () => {
        it('debe crear un certificado exitosamente con datos válidos', async () => {
            const payload: CreateMedicalCertificateRequest = {
                memberId: validMemberId,
                issueDate: '2026-06-01',
                expiryDate: '2027-06-01',
                doctorLicense: 'MN-12345',
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/medical-certificates',
                payload,
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);
            expect(body.data.memberId).toBe(validMemberId);
            expect(body.data.isValidated).toBe(false);
            expect(body.data.doctorLicense).toBe('MN-12345');
        });

        it('debe retornar 400 si la fecha de vencimiento es anterior a la de emisión', async () => {
            const payload: CreateMedicalCertificateRequest = {
                memberId: validMemberId,
                issueDate: '2027-06-01',
                expiryDate: '2026-06-01',
                doctorLicense: 'MN-12345',
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/medical-certificates',
                payload,
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.payload);
            expect(body.error).toContain('debe ser posterior');
        });
    });

    describe('PATCH /api/v1/medical-certificates/:id', () => {
        it('debe validar un certificado existente', async () => {
            // Setup: primero crear un certificado
            const { PostgresMedicalCertificateRepository } = await import('../infrastructure/PostgresMedicalCertificateRepository.js');
            (PostgresMedicalCertificateRepository as any)._preload([{
                id: 'cert-1',
                memberId: validMemberId,
                issueDate: '2026-06-01',
                expiryDate: '2027-06-01',
                doctorLicense: 'MN-12345',
                isValidated: false,
                deletedAt: null,
            }]);

            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/medical-certificates/cert-1',
                payload: { isValidated: true },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.data.isValidated).toBe(true);
        });

        it('debe retornar 404 si el certificado no existe', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/medical-certificates/cert-inexistente',
                payload: { isValidated: true },
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.payload);
            expect(body.error).toContain('no existe');
        });
    });

    describe('DELETE /api/v1/medical-certificates/:id', () => {
        it('debe eliminar lógicamente un certificado existente', async () => {
            // Setup: precargar un certificado
            const { PostgresMedicalCertificateRepository } = await import('../infrastructure/PostgresMedicalCertificateRepository.js');
            (PostgresMedicalCertificateRepository as any)._preload([{
                id: 'cert-2',
                memberId: validMemberId,
                issueDate: '2026-06-01',
                expiryDate: '2027-06-01',
                doctorLicense: 'MN-12345',
                isValidated: false,
                deletedAt: null,
            }]);

            const response = await app.inject({
                method: 'DELETE',
                url: '/api/v1/medical-certificates/cert-2',
            });

            expect(response.statusCode).toBe(204);
            expect(response.payload).toBe('');
        });

        it('debe retornar 404 si el certificado no existe', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/v1/medical-certificates/cert-inexistente',
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.payload);
            expect(body.error).toContain('no existe');
        });
    });
});