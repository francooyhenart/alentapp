import { PrismaClient } from '@prisma/client';
import { EquipmentLoan } from '../../domain/entities/EquipmentLoan';
import { EquipmentLoanRepository } from '../../domain/ports/EquipmentLoanRepository';
import { EquipmentLoanMapper } from '../../application/mappers/EquipmentLoanMapper';

export class PrismaEquipmentLoanRepository implements EquipmentLoanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(loan: EquipmentLoan): Promise<EquipmentLoan> {
    const data = {
      id: loan.id,
      itemName: loan.itemName,
      status: loan.status.getValue(),
      isActive: loan.isActive,
      loanDate: loan.loanDate,
      returnDate: loan.returnDate,
      canceledDate: loan.canceledDate,
      memberId: loan.memberId,
      notes: loan.notes
    };

    const created = await this.prisma.equipmentLoan.create({
      data
    });

    return EquipmentLoanMapper.toDomain(created);
  }

  async findById(id: string): Promise<EquipmentLoan | null> {
    const loan = await this.prisma.equipmentLoan.findUnique({
      where: { id }
    });

    if (!loan) {
      return null;
    }

    return EquipmentLoanMapper.toDomain(loan);
  }

  async update(loan: EquipmentLoan): Promise<EquipmentLoan> {
    const data = {
      itemName: loan.itemName,
      status: loan.status.getValue(),
      isActive: loan.isActive,
      returnDate: loan.returnDate,
      canceledDate: loan.canceledDate,
      notes: loan.notes
    };

    const updated = await this.prisma.equipmentLoan.update({
      where: { id: loan.id },
      data
    });

    return EquipmentLoanMapper.toDomain(updated);
  }
}
