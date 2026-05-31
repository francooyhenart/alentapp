import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateMedicalCertificateUseCase } from './UpdateMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO, UpdateMedicalCertificateRequest } from '@alentapp/shared';

describe('UpdateMedicalCertificateUseCase', () => {
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
    const useCase = new UpdateMedicalCertificateUseCase(mockMedicalCertificateRepo);

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

    it('debe validar un certificado pendiente llamando a validateAndInvalidateOthers', async () => {
        const updateRequest: UpdateMedicalCertificateRequest = { isValidated: true };
        const validatedCertificate = { ...existingCertificate, isValidated: true };

        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(existingCertificate);
        vi.mocked(mockMedicalCertificateRepo.validateAndInvalidateOthers).mockResolvedValueOnce(validatedCertificate);

        const result = await useCase.execute('cert-uuid-1', updateRequest);

        expect(mockMedicalCertificateRepo.findById).toHaveBeenCalledWith('cert-uuid-1');
        expect(mockMedicalCertificateRepo.validateAndInvalidateOthers).toHaveBeenCalledWith('cert-uuid-1', existingCertificate.memberId);
        expect(mockMedicalCertificateRepo.updateValidationStatus).not.toHaveBeenCalled();
        expect(result.isValidated).toBe(true);
    });

    it('debe desvalidar un certificado llamando a updateValidationStatus', async () => {
        const validatedCert = { ...existingCertificate, isValidated: true };
        const updateRequest: UpdateMedicalCertificateRequest = { isValidated: false };
        const unvalidatedCertificate = { ...existingCertificate, isValidated: false };

        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(validatedCert);
        vi.mocked(mockMedicalCertificateRepo.updateValidationStatus).mockResolvedValueOnce(unvalidatedCertificate);

        const result = await useCase.execute('cert-uuid-1', updateRequest);

        expect(mockMedicalCertificateRepo.findById).toHaveBeenCalledWith('cert-uuid-1');
        expect(mockMedicalCertificateRepo.updateValidationStatus).toHaveBeenCalledWith('cert-uuid-1', false);
        expect(mockMedicalCertificateRepo.validateAndInvalidateOthers).not.toHaveBeenCalled();
        expect(result.isValidated).toBe(false);
    });

    it('debe lanzar error si el certificado no existe', async () => {
        const updateRequest: UpdateMedicalCertificateRequest = { isValidated: true };

        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-inexistente', updateRequest))
            .rejects.toThrow('El certificado médico no existe');

        expect(mockMedicalCertificateRepo.updateValidationStatus).not.toHaveBeenCalled();
        expect(mockMedicalCertificateRepo.validateAndInvalidateOthers).not.toHaveBeenCalled();
    });

    it('debe lanzar error si el certificado fue eliminado lógicamente (findById devuelve null)', async () => {
        const updateRequest: UpdateMedicalCertificateRequest = { isValidated: true };

        // findById ya filtra los registros con deletedAt no nulo, devolviendo null
        vi.mocked(mockMedicalCertificateRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute('cert-uuid-eliminado', updateRequest))
            .rejects.toThrow('El certificado médico no existe');

        expect(mockMedicalCertificateRepo.updateValidationStatus).not.toHaveBeenCalled();
        expect(mockMedicalCertificateRepo.validateAndInvalidateOthers).not.toHaveBeenCalled();
    });
});