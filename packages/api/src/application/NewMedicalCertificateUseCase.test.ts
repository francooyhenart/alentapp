import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateMedicalCertificateUseCase } from './NewMedicalCertificateUseCase.js';
import { MedicalCertificateRepository } from '../domain/MedicalCertificateRepository.js';
import { MedicalCertificateValidator } from '../domain/services/MedicalCertificateValidator.js';
import { CreateMedicalCertificateRequest, MedicalCertificateDTO } from '@alentapp/shared';

describe('CreateMedicalCertificateUseCase', () => {
    // 1. Mocks de las dependencias (puerto del repositorio y validador del dominio)
    const mockMedicalCertificateRepo = {
        createAndInvalidatePrevious: vi.fn(),
        findAll: vi.fn(),
        findById: vi.fn(),
        updateValidationStatus: vi.fn(),
        validateAndInvalidateOthers: vi.fn(),
        softDelete: vi.fn(),
    } as unknown as MedicalCertificateRepository;

    const mockValidator = {
        validateDateRange: vi.fn(),
        validateNotExpiredOnCreation: vi.fn(),
        validateMemberExists: vi.fn(),
    } as unknown as MedicalCertificateValidator;

    // 2. Instanciamos el caso de uso inyectando los mocks
    const useCase = new CreateMedicalCertificateUseCase(mockMedicalCertificateRepo, mockValidator);

    // 3. Datos de prueba reutilizables
    const validRequest: CreateMedicalCertificateRequest = {
        memberId: '550e8400-e29b-41d4-a716-446655440000',
        issueDate: '2026-06-01',
        expiryDate: '2027-06-01',
        doctorLicense: 'MN-12345',
    };

    const mockCertificateResponse: MedicalCertificateDTO = {
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

    it('debe crear un certificado exitosamente con datos válidos', async () => {
        vi.mocked(mockMedicalCertificateRepo.createAndInvalidatePrevious).mockResolvedValueOnce(mockCertificateResponse);

        const result = await useCase.execute(validRequest);

        expect(mockValidator.validateDateRange).toHaveBeenCalled();
        expect(mockValidator.validateNotExpiredOnCreation).toHaveBeenCalled();
        expect(mockValidator.validateMemberExists).toHaveBeenCalledWith(validRequest.memberId);
        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).toHaveBeenCalledWith(validRequest);
        expect(result).toEqual(mockCertificateResponse);
        expect(result.isValidated).toBe(false);
    });

    it('debe lanzar error si la fecha de vencimiento es anterior o igual a la de emisión', async () => {
        const invalidRequest: CreateMedicalCertificateRequest = {
            ...validRequest,
            issueDate: '2027-06-01',
            expiryDate: '2026-06-01',
        };

        vi.mocked(mockValidator.validateDateRange).mockImplementationOnce(() => {
            throw new Error('La fecha de vencimiento debe ser posterior a la de emisión');
        });

        await expect(useCase.execute(invalidRequest)).rejects.toThrow('La fecha de vencimiento debe ser posterior a la de emisión');
        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).not.toHaveBeenCalled();
    });

    it('debe lanzar error si el certificado tiene una fecha de vencimiento ya pasada', async () => {
        const expiredRequest: CreateMedicalCertificateRequest = {
            ...validRequest,
            issueDate: '2020-01-01',
            expiryDate: '2021-01-01',
        };

        vi.mocked(mockValidator.validateNotExpiredOnCreation).mockImplementationOnce(() => {
            throw new Error('El certificado no puede tener una fecha de vencimiento ya pasada');
        });

        await expect(useCase.execute(expiredRequest)).rejects.toThrow('El certificado no puede tener una fecha de vencimiento ya pasada');
        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).not.toHaveBeenCalled();
    });

    it('debe lanzar error si el socio referenciado no existe', async () => {
        vi.mocked(mockValidator.validateMemberExists).mockRejectedValueOnce(new Error('El socio referenciado no existe'));

        await expect(useCase.execute(validRequest)).rejects.toThrow('El socio referenciado no existe');
        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).not.toHaveBeenCalled();
    });

    it('debe invocar al repositorio con los datos exactos del request para garantizar la transacción atómica', async () => {
        vi.mocked(mockMedicalCertificateRepo.createAndInvalidatePrevious).mockResolvedValueOnce(mockCertificateResponse);

        await useCase.execute(validRequest);

        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).toHaveBeenCalledTimes(1);
        expect(mockMedicalCertificateRepo.createAndInvalidatePrevious).toHaveBeenCalledWith({
            memberId: validRequest.memberId,
            issueDate: validRequest.issueDate,
            expiryDate: validRequest.expiryDate,
            doctorLicense: validRequest.doctorLicense,
        });
    });
});