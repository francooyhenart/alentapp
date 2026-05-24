import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewLockerUseCase } from './NewLockerUseCase';
import { ReserveLockerUseCase } from './ReserveLockerUseCase';
import { ReleaseLockerUseCase } from './ReleaseLockerUseCase';
import { UpdateLockerStatusUseCase } from './UpdateLockerStatusUseCase';
import { z } from 'zod';

const LockerStatusEnum = z.enum(['Available', 'Occupied', 'Maintenance']);
const LockerValidationSchema = z.object({
  id: z.string().uuid({ message: 'ID inválido' }),
  number: z.number().int().positive({ message: 'El número debe ser positivo' }),
  location: z.string().min(1, { message: 'Ubicación requerida' }),
  status: LockerStatusEnum,
});

describe('🧪 Tests Unitarios — Entidad Lockers (feature/locker-tests)', () => {
  
  let stubLockerRepository: any;

  beforeEach(() => {
    stubLockerRepository = {
      save: vi.fn(), 
      findById: vi.fn(),
      update: vi.fn(),
      findByNumber: vi.fn().mockResolvedValue(null),
    };
  });

  describe('1. Validaciones de Estructura de Datos (Zod)', () => {
    it('1. Debe fallar si el número de casillero es negativo', () => {
      const data = { id: '6815b080-000a-4e45-8325-17856ecdae8e', number: -10, location: 'Vestuario A', status: 'Available' };
      const parsed = LockerValidationSchema.safeParse(data);
      expect(parsed.success).toBe(false);
    });

    it('2. Debe fallar si la ubicación está vacía', () => {
      const data = { id: '6815b080-000a-4e45-8325-17856ecdae8e', number: 105, location: '', status: 'Available' };
      const parsed = LockerValidationSchema.safeParse(data);
      expect(parsed.success).toBe(false);
    });

    it('3. Debe fallar si el formato del ID no cumple con ser un UUID', () => {
      const data = { id: 'id-invalido-1234', number: 105, location: 'Pasillo', status: 'Available' };
      const parsed = LockerValidationSchema.safeParse(data);
      expect(parsed.success).toBe(false);
    });

    it('4. Debe fallar si el estado no coincide con las opciones permitidas', () => {
      const data = { id: '6815b080-000a-4e45-8325-17856ecdae8e', number: 105, location: 'Pasillo', status: 'Roto' };
      const parsed = LockerValidationSchema.safeParse(data);
      expect(parsed.success).toBe(false);
    });
  });

  describe('2. Creación: NewLockerUseCase', () => {
    it('5. Debe retornar el nuevo casillero con estado "Available" por defecto', async () => {
      const useCase = new NewLockerUseCase(stubLockerRepository);
      const fakeInput = { number: 101, location: 'Sector Gimnasio' };
      
      stubLockerRepository.save.mockResolvedValue({
        id: '11111111-2222-3333-4444-555555555555',
        number: 101,
        location: 'Sector Gimnasio',
        status: 'Available',
        member_id: null
      });

      const result = await useCase.execute(fakeInput);
      expect(result.status).toBe('Available');
      expect(result.number).toBe(101);
    });
  });

  describe('3. Reservas: ReserveLockerUseCase', () => {
    it('6. Debe permitir la reserva si el casillero actual está "Available"', async () => {
      const useCase = new ReserveLockerUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';
      const memberId = '99999999-8888-7777-6666-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 5, status: 'Available', member_id: null });
      stubLockerRepository.update.mockResolvedValue({ id: lockerId, number: 5, status: 'Occupied', member_id: memberId });

      const result = await useCase.execute(lockerId, memberId);
      expect(result.status).toBe('Occupied');
      expect(result.member_id).toBe(memberId);
    });

    it('7. Debe arrojar un error si el casillero ya está "Occupied"', async () => {
      const useCase = new ReserveLockerUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 5, status: 'Occupied', member_id: 'otro-socio-uuid' });

      await expect(useCase.execute(lockerId, 'socio-nuevo-uuid')).rejects.toThrow();
    });

    it('8. Debe arrojar un error si el casillero está en "Maintenance"', async () => {
      const useCase = new ReserveLockerUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 5, status: 'Maintenance', member_id: null });

      await expect(useCase.execute(lockerId, 'socio-uuid')).rejects.toThrow();
    });
  });

  describe('4. Liberación: ReleaseLockerUseCase', () => {
    it('9. Debe cambiar el estado a "Available" y limpiar el socio al liberar', async () => {
      const useCase = new ReleaseLockerUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';
      const memberId = '99999999-8888-7777-6666-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 12, status: 'Occupied', member_id: memberId });
      stubLockerRepository.update.mockResolvedValue({ id: lockerId, number: 12, status: 'Available', member_id: null });

      const result = await useCase.execute(lockerId, memberId);
      expect(result.status).toBe('Available');
      expect(result.member_id).toBeNull();
    });

    it('10. Debe arrojar un error si se intenta liberar un casillero que ya estaba "Available"', async () => {
      const useCase = new ReleaseLockerUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 12, status: 'Available', member_id: null });

      await expect(useCase.execute(lockerId, 'socio-uuid')).rejects.toThrow();
    });
  });

  describe('5. Mantenimiento: UpdateLockerStatusUseCase', () => {
    it('11. Debe permitir pasar un casillero disponible a "Maintenance"', async () => {
      const useCase = new UpdateLockerStatusUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 20, status: 'Available', member_id: null });
      stubLockerRepository.update.mockResolvedValue({ id: lockerId, number: 20, status: 'Maintenance', member_id: null });

      const result = await useCase.execute(lockerId, 'Maintenance');
      expect(result.status).toBe('Maintenance');
    });

    it('12. Debe arrojar un error si se intenta pasar a mantenimiento un casillero "Occupied"', async () => {
      const useCase = new UpdateLockerStatusUseCase(stubLockerRepository);
      const lockerId = '11111111-2222-3333-4444-555555555555';

      stubLockerRepository.findById.mockResolvedValue({ id: lockerId, number: 20, status: 'Occupied', member_id: 'socio-uuid' });

      await expect(useCase.execute(lockerId, 'Maintenance')).rejects.toThrow();
    });
  });
});