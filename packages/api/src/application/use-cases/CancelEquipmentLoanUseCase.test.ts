import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelEquipmentLoanUseCase } from './CancelEquipmentLoanUseCase.js';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan.js';
import { LoanStatusVO } from '../../domain/value-objects/LoanStatus.js';
import { EquipmentLoanRepository } from '../../domain/ports/EquipmentLoanRepository.js';
import {
    LoanNotFoundError,
    AlreadyCanceledError,
} from '../../domain/errors/EquipmentLoanErrors.js';

const VALID_MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_LOAN_ID   = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const mockLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
} as unknown as EquipmentLoanRepository;

describe('CancelEquipmentLoanUseCase', () => {
    const useCase = new CancelEquipmentLoanUseCase(mockLoanRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // test unitario 77 - debe cancelar un préstamo activo en estado Loaned correctamente
    it('debe cancelar un préstamo activo en estado Loaned correctamente', async () => {
        const loan = EquipmentLoan.reconstitute({
        id: VALID_LOAN_ID,
        itemName: 'Raqueta de tenis',
        status: LoanStatusVO.createLoaned(),
        isActive: true,
        loanDate: new Date('2024-01-15'),
        memberId: VALID_MEMBER_ID,
        });
        const canceledLoan = EquipmentLoan.reconstitute({
        id: VALID_LOAN_ID,
        itemName: 'Raqueta de tenis',
        status: LoanStatusVO.createCanceled(),
        isActive: false,
        loanDate: new Date('2024-01-15'),
        canceledDate: new Date(),
        memberId: VALID_MEMBER_ID,
        });

        vi.mocked(mockLoanRepo.findById).mockResolvedValueOnce(loan);
        vi.mocked(mockLoanRepo.update).mockResolvedValueOnce(canceledLoan);

        const result = await useCase.execute(VALID_LOAN_ID, { reason: 'Solicitud del socio' });

        expect(mockLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_ID);
        expect(mockLoanRepo.update).toHaveBeenCalledOnce();
        expect(result.status).toBe('Canceled');
        expect(result.isActive).toBe(false);
    });
});