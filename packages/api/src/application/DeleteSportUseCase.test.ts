import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteSportUseCase } from './DeleteSportUseCase.js';
import { Sport } from '../domain/Sport.js';
import { SportRepository } from '../domain/SportRepository.js';

describe('DeleteSportUseCase', () => {
    const mockSportRepo = {
        create: vi.fn(),
        findByName: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        update: vi.fn(),
        deleteById: vi.fn(),
    } as unknown as SportRepository;

    const useCase = new DeleteSportUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    //test unitario 62 - debe eliminar un deporte existente
    it('debe eliminar un deporte existente', async () => {
        const existingSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Actividad de tenis',
            12,
            1500,
            true,
        );

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(existingSport);
        vi.mocked(mockSportRepo.deleteById).mockResolvedValueOnce();

        await useCase.execute('sport-id-1');

        expect(mockSportRepo.findById).toHaveBeenCalledWith('sport-id-1');
        expect(mockSportRepo.deleteById).toHaveBeenCalledWith('sport-id-1');
    });
});
