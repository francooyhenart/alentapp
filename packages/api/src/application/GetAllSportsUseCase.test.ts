import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllSportsUseCase } from './GetAllSportsUseCase.js';
import { Sport } from '../domain/Sport.js';
import { SportRepository } from '../domain/SportRepository.js';

describe('GetAllSportsUseCase', () => {
    const mockSportRepo = {
        create: vi.fn(),
        findByName: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        update: vi.fn(),
        deleteById: vi.fn(),
    } as unknown as SportRepository;

    const useCase = new GetAllSportsUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    //test unitario 38 - debe retornar todos los deportes
    it('debe retornar todos los deportes', async () => {
        const sports = [
            new Sport('sport-id-1', 'Basquet', 'Actividad de basquet', 20, 1000, false),
            new Sport('sport-id-2', 'Tenis', 'Actividad de tenis', 12, 1500, true),
        ];

        vi.mocked(mockSportRepo.findAll).mockResolvedValueOnce(sports);

        const result = await useCase.execute();

        expect(mockSportRepo.findAll).toHaveBeenCalledWith(undefined);
        expect(result).toEqual([
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

    //test unitario 39 - debe buscar deportes por nombre normalizando espacios
    it('debe buscar deportes por nombre normalizando espacios', async () => {
        const sports = [
            new Sport('sport-id-2', 'Tenis', 'Actividad de tenis', 12, 1500, true),
        ];

        vi.mocked(mockSportRepo.findAll).mockResolvedValueOnce(sports);

        const result = await useCase.execute('  Tenis  ');

        expect(mockSportRepo.findAll).toHaveBeenCalledWith('Tenis');
        expect(result).toEqual([
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

    //test unitario 40 - debe lanzar error si el parametro de busqueda name esta vacio
    it('debe lanzar error si el parametro de busqueda name esta vacio', async () => {
        await expect(useCase.execute('   ')).rejects.toThrow('El parametro de busqueda name no puede estar vacio');
        expect(mockSportRepo.findAll).not.toHaveBeenCalled();
    });
});
