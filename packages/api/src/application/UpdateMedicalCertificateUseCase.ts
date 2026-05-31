import { MedicalCertificateRepository } from '../domain/MedicalCertificateRepository.js';
import { MedicalCertificateDTO, UpdateMedicalCertificateRequest } from '@alentapp/shared';

export class UpdateMedicalCertificateUseCase {

    constructor(
        private readonly medicalCertificateRepository: MedicalCertificateRepository
    ) {}

    async execute(id: string, data: UpdateMedicalCertificateRequest): Promise<MedicalCertificateDTO> {
        const existing = await this.medicalCertificateRepository.findById(id);
        if (!existing) {
            throw new Error('El certificado médico no existe');
        }

        if (data.isValidated === true) {
            return await this.medicalCertificateRepository.validateAndInvalidateOthers(id, existing.memberId);
        }

        return await this.medicalCertificateRepository.updateValidationStatus(id, data.isValidated);
    }
}