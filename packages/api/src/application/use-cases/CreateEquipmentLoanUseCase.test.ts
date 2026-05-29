import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateEquipmentLoanUseCase } from './CreateEquipmentLoanUseCase.js';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan.js';
import { LoanStatusVO } from '../../domain/value-objects/LoanStatus.js';
import { EquipmentLoanRepository } from '../../domain/ports/EquipmentLoanRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';
import {
    MemberNotFoundError,
    CategoryRestrictionError,
} from '../../domain/errors/EquipmentLoanErrors.js';

const VALID_MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findAll: vi.fn(),
} as unknown as EquipmentLoanRepository;

const mockMemberRepo = {
    findByDni: vi.fn(),
    findById: vi.fn(),
} as unknown as MemberRepository;

describe('CreateEquipmentLoanUseCase', () => {
    const useCase = new CreateEquipmentLoanUseCase(mockLoanRepo, mockMemberRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // test unitario 68 - debe crear un préstamo correctamente cuando el socio existe y no es Cadete
    it('debe crear un préstamo correctamente cuando el socio existe y no es Cadete', async () => {
        const member = { id: VALID_MEMBER_ID, category: 'Adulto' };
        const savedLoan = EquipmentLoan.reconstitute({
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        itemName: 'Raqueta de tenis',
        status: LoanStatusVO.createLoaned(),
        isActive: true,
        loanDate: new Date('2024-01-15'),
        memberId: VALID_MEMBER_ID,
        });

        vi.mocked(mockMemberRepo.findByDni).mockResolvedValueOnce(member as any);
        vi.mocked(mockLoanRepo.create).mockResolvedValueOnce(savedLoan);

        const result = await useCase.execute({
        itemName: '  Raqueta de tenis  ',
        memberDni: '12345678',
        });


        expect(mockMemberRepo.findByDni).toHaveBeenCalledWith('12345678');
        expect(mockLoanRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    itemName: 'Raqueta de tenis',
                    memberId: VALID_MEMBER_ID,
                }),
            );
        expect(result).toMatchObject({ itemName: 'Raqueta de tenis', status: 'Loaned' });
    });

    // test unitario 69 - debe lanzar CategoryRestrictionError cuando el socio es de categoría Cadete
    it('debe lanzar CategoryRestrictionError cuando el socio es de categoría Cadete', async () => {
        const cadetMember = { id: VALID_MEMBER_ID, category: 'Cadete' };
    
        vi.mocked(mockMemberRepo.findByDni).mockResolvedValueOnce(cadetMember as any);
    
        await expect(
        useCase.execute({ itemName: 'Pelota', memberDni: '87654321' }),
        ).rejects.toThrow(CategoryRestrictionError);
    
        expect(mockLoanRepo.create).not.toHaveBeenCalled();
    });

});