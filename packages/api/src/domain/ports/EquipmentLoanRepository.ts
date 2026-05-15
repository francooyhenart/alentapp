import { EquipmentLoan } from '../entities/EquipmentLoan';

export interface EquipmentLoanRepository {

  create(loan: EquipmentLoan): Promise<EquipmentLoan>;

  findById(id: string): Promise<EquipmentLoan | null>;

  update(loan: EquipmentLoan): Promise<EquipmentLoan>;
}
