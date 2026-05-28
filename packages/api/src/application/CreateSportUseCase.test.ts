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
});
