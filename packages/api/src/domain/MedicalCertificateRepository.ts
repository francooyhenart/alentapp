import { MedicalCertificateDTO, CreateMedicalCertificateRequest } from '@alentapp/shared';

export interface MedicalCertificateRepository {
    createAndInvalidatePrevious(data: CreateMedicalCertificateRequest): Promise<MedicalCertificateDTO>;
    findAll(): Promise<MedicalCertificateDTO[]>;
    findById(id: string): Promise<MedicalCertificateDTO | null>;
    updateValidationStatus(id: string, isValidated: boolean): Promise<MedicalCertificateDTO>;
    validateAndInvalidateOthers(id: string, memberId: string): Promise<MedicalCertificateDTO>;
    softDelete(id: string): Promise<void>;
}