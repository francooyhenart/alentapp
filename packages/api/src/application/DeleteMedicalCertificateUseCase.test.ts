import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMedicalCertificateUseCase } from './DeleteMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO } from '@alentapp/shared';

describe('DeleteMedicalCertificateUseCase', () => {
    // 1. Mock del repositorio con todos sus métodos
    const mockMedicalCertificateRepo = {
        createAndInvalidatePrevious: vi.fn(),
        findAll: vi.fn(),
        findById: vi.fn(),
        updateValidationStatus: vi.fn(),
        validateAndInvalidateOthers: vi.fn(),
        softDelete: vi.fn(),
    } as unknown as MedicalCertificateRepository;

    // 2. Instanciamos el caso de uso inyectando el mock
    const useCase = new DeleteMedicalCertificateUseCase(mockMedicalCertificateRepo);

    // 3. Datos de prueba reutilizables
    const existingCertificate: MedicalCertificateDTO = {
        id: 'cert-uuid-1',
        memberId: '550e8400-e29b-41d4-a716-446655440000',
        issueDate: '2026-06-01',
        expiryDate: '2027-06-01',
        doctorLicense: 'MN-12345',
        isValidated: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe eliminar lógicamente un certificado existente', async () => {
        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(existingCertificate);
        vi.mocked(mockMedicalCertificateRepo.softDelete).mockResolvedValueOnce(undefined);

        await useCase.execute('cert-uuid-1');

        expect(mockMedicalCertificateRepo.findById).toHaveBeenCalledWith('cert-uuid-1');
        expect(mockMedicalCertificateRepo.softDelete).toHaveBeenCalledWith('cert-uuid-1');
        expect(mockMedicalCertificateRepo.softDelete).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar error si el certificado no existe', async () => {
        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-inexistente'))
            .rejects.toThrow('El certificado médico no existe');

        expect(mockMedicalCertificateRepo.softDelete).not.toHaveBeenCalled();
    });

    it('debe ser idempotente: lanzar error si el certificado ya fue eliminado lógicamente', async () => {
        // findById ya filtra los registros con deletedAt no nulo, devolviendo null
        // Esto simula intentar eliminar dos veces el mismo certificado
        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-ya-eliminado'))
            .rejects.toThrow('El certificado médico no existe');

        expect(mockMedicalCertificateRepo.softDelete).not.toHaveBeenCalled();
    });
});