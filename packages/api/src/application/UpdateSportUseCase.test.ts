import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateSportUseCase } from './UpdateSportUseCase.js';
import { Sport } from '../domain/Sport.js';
import { SportRepository } from '../domain/SportRepository.js';

describe('UpdateSportUseCase', () => {
    const mockSportRepo = {
        create: vi.fn(),
        findByName: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        update: vi.fn(),
        deleteById: vi.fn(),
    } as unknown as SportRepository;

    const useCase = new UpdateSportUseCase(mockSportRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    //test unitario 49 - debe actualizar la descripcion y el cupo maximo de un deporte
    it('debe actualizar la descripcion y el cupo maximo de un deporte', async () => {
        const existingSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Actividad de tenis',
            12,
            1500,
            true,
        );

        const updatedSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Nueva descripcion de tenis',
            20,
            1500,
            true,
        );

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(existingSport);
        vi.mocked(mockSportRepo.update).mockResolvedValueOnce(updatedSport);

        const result = await useCase.execute('sport-id-1', {
            description: ' Nueva descripcion de tenis ',
            max_capacity: 20,
        });

        expect(mockSportRepo.findById).toHaveBeenCalledWith('sport-id-1');
        expect(mockSportRepo.update).toHaveBeenCalledWith('sport-id-1', {
            description: 'Nueva descripcion de tenis',
            max_capacity: 20,
        });
        expect(result).toEqual({
            id: 'sport-id-1',
            name: 'Tenis',
            description: 'Nueva descripcion de tenis',
            max_capacity: 20,
            additional_price: 1500,
            requires_medical_certificate: true,
        });
    });

    //test unitario 50 - debe lanzar error si se intenta modificar el nombre del deporte
    it('debe lanzar error si se intenta modificar el nombre del deporte', async () => {
        await expect(useCase.execute('sport-id-1', {
            name: 'Nuevo nombre',
            description: 'Nueva descripcion',
        })).rejects.toThrow('No se permite modificar el nombre del deporte');

        expect(mockSportRepo.findById).not.toHaveBeenCalled();
        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    //test unitario 51 - debe lanzar error si el deporte no existe
    it('debe lanzar error si el deporte no existe', async () => {
        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('sport-id-inexistente', {
            description: 'Nueva descripcion',
            max_capacity: 15,
        })).rejects.toThrow('El deporte no existe');

        expect(mockSportRepo.findById).toHaveBeenCalledWith('sport-id-inexistente');
        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    //test unitario 52 - debe lanzar error si el cupo maximo no es entero
    it('debe lanzar error si el cupo maximo no es entero', async () => {
        const existingSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Actividad de tenis',
            12,
            1500,
            true,
        );

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(existingSport);

        await expect(useCase.execute('sport-id-1', {
            max_capacity: 12.5,
        })).rejects.toThrow('El cupo maximo debe ser un numero entero mayor a cero');

        expect(mockSportRepo.findById).toHaveBeenCalledWith('sport-id-1');
        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });

    //test unitario 53 - debe lanzar error si el cupo maximo es menor o igual a cero
    it('debe lanzar error si el cupo maximo es menor o igual a cero', async () => {
        const existingSport = new Sport(
            'sport-id-1',
            'Tenis',
            'Actividad de tenis',
            12,
            1500,
            true,
        );

        vi.mocked(mockSportRepo.findById).mockResolvedValueOnce(existingSport);

        await expect(useCase.execute('sport-id-1', {
            max_capacity: 0,
        })).rejects.toThrow('El cupo maximo debe ser un numero entero mayor a cero');

        expect(mockSportRepo.findById).toHaveBeenCalledWith('sport-id-1');
        expect(mockSportRepo.update).not.toHaveBeenCalled();
    });
});
