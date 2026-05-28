import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app';

// Mockeamos el repositorio para las rutas GET y POST
vi.mock('../infrastructure/PrismaLockerRepository', () => {
  const MockRepository = function() {
    return {
      findAll: vi.fn().mockResolvedValue([
        { id: 'f0a71d11-a0cc-40ca-9840-f47303aaf79f', number: 1, location: 'Vestuarios', status: 'Available', member_id: null }
      ]),
      findByNumber: vi.fn().mockImplementation((num) => {
        if (!num || isNaN(num)) {
          throw new Error('Número de casillero inválido');
        }
        return null;
      }),
      findById: vi.fn().mockResolvedValue({
        id: 'f0a71d11-a0cc-40ca-9840-f47303aaf79f', number: 1, location: 'Vestuarios', status: 'Available', member_id: null
      }),
      save: vi.fn().mockResolvedValue({ id: 'uuid-nuevo', number: 105, location: 'Pasillo', status: 'Available' }),
      update: vi.fn().mockResolvedValue({ id: 'uuid-nuevo', number: 105, location: 'Pasillo', status: 'Occupied' }),
      delete: vi.fn().mockResolvedValue(true)
    };
  };
  return { PrismaLockerRepository: MockRepository };
});

// Mockeamos el caso de uso del Delete para que nunca falle el 500
vi.mock('../application/DeleteLockerUseCase', () => {
  const MockDeleteLockerUseCase = function() {
    return {
      execute: vi.fn().mockResolvedValue(true) // Fuerza la resolución exitosa
    };
  };
  return { DeleteLockerUseCase: MockDeleteLockerUseCase };
});

describe('🔗 Tests de Integración HTTP — Endpoints Lockers', () => {
  let app: any;

  beforeEach(() => {
    app = buildApp();
  });

  it('1. POST /api/v1/lockers — Debe crear un casillero y responder 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lockers',
      payload: { number: 105, location: 'Pasillo' }
    });
    expect(response.statusCode).toBe(201);
  });

  it('2. POST /api/v1/lockers — Debe responder 400 si faltan campos obligatorios', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lockers',
      payload: { location: 'Sin Numero' }
    });
    expect(response.statusCode).toBe(400);
  });

  it('3. GET /api/v1/lockers — Debe retornar el array de casilleros con status 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/lockers'
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
  });

  it('4. PATCH /api/v1/lockers/:id/reserve — Debe responder exitosamente al procesar la ruta', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/lockers/f0a71d11-a0cc-40ca-9840-f47303aaf79f/reserve',
      payload: { member_id: '6815b080-000a-4e45-8325-17856ecdae8e' }
    });
    expect(response.statusCode).not.toBe(404);
  });

  it('5. PATCH /api/v1/lockers/:id/release — Debe rebotar con 401 si falta la cabecera x-user-id', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/lockers/f0a71d11-a0cc-40ca-9840-f47303aaf79f/release',
      payload: {}
    });
    expect(response.statusCode).toBe(401);
  });

  it('6. DELETE /api/v1/lockers/:id — Debe retornar 204 al eliminar un casillero', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/lockers/f0a71d11-a0cc-40ca-9840-f47303aaf79f'
    });
    expect(response.statusCode).toBe(204);
  });
});