import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReturnEquipmentLoanUseCase } from './ReturnEquipmentLoanUseCase.js';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan.js';
import { LoanStatusVO } from '../../domain/value-objects/LoanStatus.js';
import { EquipmentLoanRepository } from '../../domain/ports/EquipmentLoanRepository.js';
import {
    LoanNotFoundError,
    MissingNotesError,
} from '../../domain/errors/EquipmentLoanErrors.js';

const VALID_MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_LOAN_ID   = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const mockLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
} as unknown as EquipmentLoanRepository;

describe('ReturnEquipmentLoanUseCase', () => {
    const useCase = new ReturnEquipmentLoanUseCase(mockLoanRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // test unitario 74 - debe marcar el préstamo como Returned correctamente
    it('debe marcar el préstamo como Returned correctamente', async () => {
        const loan = EquipmentLoan.reconstitute({
        id: VALID_LOAN_ID,
        itemName: 'Raqueta de tenis',
        status: LoanStatusVO.createLoaned(),
        isActive: true,
        loanDate: new Date('2024-01-15'),
        memberId: VALID_MEMBER_ID,
        });
        const updatedLoan = EquipmentLoan.reconstitute({
        id: VALID_LOAN_ID,
        itemName: 'Raqueta de tenis',
        status: LoanStatusVO.create('Returned'),
        isActive: true,
        loanDate: new Date('2024-01-15'),
        returnDate: new Date(),
        memberId: VALID_MEMBER_ID,
        });

        vi.mocked(mockLoanRepo.findById).mockResolvedValueOnce(loan);
        vi.mocked(mockLoanRepo.update).mockResolvedValueOnce(updatedLoan);

        const result = await useCase.execute(VALID_LOAN_ID, { status: 'Returned' });

        expect(mockLoanRepo.findById).toHaveBeenCalledWith(VALID_LOAN_ID);
        expect(mockLoanRepo.update).toHaveBeenCalledOnce();
        expect(result.status).toBe('Returned');
    });

    // test unitario 75 - debe lanzar LoanNotFoundError si el préstamo no existe
    it('debe lanzar LoanNotFoundError si el préstamo no existe', async () => {
        vi.mocked(mockLoanRepo.findById).mockResolvedValueOnce(null);

        await expect(
        useCase.execute('id-inexistente', { status: 'Returned' }),
        ).rejects.toThrow(LoanNotFoundError);

        expect(mockLoanRepo.update).not.toHaveBeenCalled();
    });

    // test unitario 76 - debe lanzar MissingNotesError al reportar daño sin notas suficientes
    it('debe lanzar MissingNotesError al reportar daño sin notas suficientes', async () => {
        await expect(
        useCase.execute(VALID_LOAN_ID, { status: 'Damaged', notes: 'corto' }),
        ).rejects.toThrow(MissingNotesError);

        expect(mockLoanRepo.findById).not.toHaveBeenCalled();
        expect(mockLoanRepo.update).not.toHaveBeenCalled();
    });
});