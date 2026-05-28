import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSportRequest } from '@alentapp/shared';
import { CreateSportUseCase } from './CreateSportUseCase.js';
import { Sport } from '../domain/Sport.js';
import { SportRepository } from '../domain/SportRepository.js';

describe('CreateSportUseCase', () => {
    const mockSportRepo = {
        create: vi.fn(),
        findByName: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        update: vi.fn(),
        deleteById: vi.fn(),
    } as unknown as SportRepository;

    const useCase = new CreateSportUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    //test unitario 22 - debe crear un deporte correctamente
    it('debe crear un deporte correctamente', async () => {
        const request: CreateSportRequest = {
            name: ' Tenis ',
            description: ' Actividad de tenis ',
            max_capacity: 20,
            additional_price: 1500,
            requires_medical_certificate: true,
        };

        const createdSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Actividad de tenis',
            20,
            1500,
            true,
        );

        vi.mocked(mockSportRepo.findByName).mockResolvedValueOnce(null);
        vi.mocked(mockSportRepo.create).mockResolvedValueOnce(createdSport);

        const result = await useCase.execute(request);

        expect(mockSportRepo.findByName).toHaveBeenCalledWith('Tenis');
        expect(mockSportRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Tenis',
            description: 'Actividad de tenis',
            max_capacity: 20,
            additional_price: 1500,
            requires_medical_certificate: true,
        }));
        expect(result).toEqual({
            id: 'sport-id-1',
            name: 'Tenis',
            description: 'Actividad de tenis',
            max_capacity: 20,
            additional_price: 1500,
            requires_medical_certificate: true,
        });
    });

    //test unitario 23 - debe crear un deporte con precio adicional por defecto en cero
    it('debe crear un deporte con precio adicional por defecto en cero', async () => {
        const request: CreateSportRequest = {
            name: 'Futbol',
            description: 'Actividad de futbol',
            max_capacity: 30,
            requires_medical_certificate: false,
        };

        const createdSport = new Sport(
            'sport-id-2',
            'Futbol',
            'Actividad de futbol',
            30,
            0,
            false,
        );

        vi.mocked(mockSportRepo.findByName).mockResolvedValueOnce(null);
        vi.mocked(mockSportRepo.create).mockResolvedValueOnce(createdSport);

        const result = await useCase.execute(request);

        expect(mockSportRepo.findByName).toHaveBeenCalledWith('Futbol');
        expect(mockSportRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Futbol',
            description: 'Actividad de futbol',
            max_capacity: 30,
            additional_price: 0,
            requires_medical_certificate: false,
        }));
        expect(result.additional_price).toBe(0);
    });

    //test unitario 24 - debe lanzar error si el nombre del deporte esta vacio
    it('debe lanzar error si el nombre del deporte esta vacio', async () => {
        const request: CreateSportRequest = {
            name: '   ',
            description: 'Actividad sin nombre',
            max_capacity: 10,
            additional_price: 500,
            requires_medical_certificate: false,
        };

        await expect(useCase.execute(request)).rejects.toThrow('El nombre del deporte es obligatorio');
        expect(mockSportRepo.findByName).not.toHaveBeenCalled();
        expect(mockSportRepo.create).not.toHaveBeenCalled();
    });
});
