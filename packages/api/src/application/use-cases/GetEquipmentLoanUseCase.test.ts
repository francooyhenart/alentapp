import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetEquipmentLoansUseCase } from './GetEquipmentLoansUseCase.js';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan.js';
import { LoanStatusVO } from '../../domain/value-objects/LoanStatus.js';
import { EquipmentLoanRepository } from '../../domain/ports/EquipmentLoanRepository.js';

const VALID_MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
} as unknown as EquipmentLoanRepository;

describe('GetEquipmentLoansUseCase', () => {
    const useCase = new GetEquipmentLoansUseCase(mockLoanRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // test unitario 71 - debe retornar todos los préstamos mapeados a DTOs
    it('debe retornar todos los préstamos mapeados a DTOs', async () => {
        const loans = [
        EquipmentLoan.reconstitute({
            id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            itemName: 'Raqueta de tenis',
            status: LoanStatusVO.createLoaned(),
            isActive: true,
            loanDate: new Date('2024-01-15'),
            memberId: VALID_MEMBER_ID,
        }),
        EquipmentLoan.reconstitute({
            id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            itemName: 'Pelota de fútbol',
            status: LoanStatusVO.createLoaned(),
            isActive: true,
            loanDate: new Date('2024-01-16'),
            memberId: VALID_MEMBER_ID,
        }),
        ];

        vi.mocked(mockLoanRepo.findAll).mockResolvedValueOnce(loans);

        const result = await useCase.execute();

        expect(mockLoanRepo.findAll).toHaveBeenCalledOnce();
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ status: 'Loaned', isActive: true });
    });

    // test unitario 72 - debe retornar un array vacío cuando no existen préstamos
    it('debe retornar un array vacío cuando no existen préstamos', async () => {
        vi.mocked(mockLoanRepo.findAll).mockResolvedValueOnce([]);

        const result = await useCase.execute();

        expect(mockLoanRepo.findAll).toHaveBeenCalledOnce();
        expect(result).toEqual([]);
    });

    // test unitario 73 - debe incluir préstamos en distintos estados en la respuesta
    it('debe incluir préstamos en distintos estados en la respuesta', async () => {
        const loans = [
        EquipmentLoan.reconstitute({
            id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            itemName: 'Raqueta de tenis',
            status: LoanStatusVO.createLoaned(),
            isActive: true,
            loanDate: new Date('2024-01-15'),
            memberId: VALID_MEMBER_ID,
        }),
        EquipmentLoan.reconstitute({
            id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            itemName: 'Pelota de fútbol',
            status: LoanStatusVO.create('Returned'),
            isActive: false,
            loanDate: new Date('2024-01-10'),
            returnDate: new Date('2024-01-20'),
            memberId: VALID_MEMBER_ID,
        }),
        ];

        vi.mocked(mockLoanRepo.findAll).mockResolvedValueOnce(loans);

        const result = await useCase.execute();

        const statuses = result.map(r => r.status);
        expect(statuses).toContain('Loaned');
        expect(statuses).toContain('Returned');
    });
});