export class EquipmentLoanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquipmentLoanError';
  }
}

export class MemberNotFoundError extends EquipmentLoanError {
  constructor(memberId: string) {
    super(`El socio con ID ${memberId} no existe`);
    this.name = 'MemberNotFoundError';
  }
}

export class CategoryRestrictionError extends EquipmentLoanError {
  constructor() {
    super('Los socios de categoría Cadet no están autorizados para solicitar préstamos de equipamiento');
    this.name = 'CategoryRestrictionError';
  }
}

export class InvalidItemNameError extends EquipmentLoanError {
  constructor() {
    super('El nombre del ítem debe tener al menos 3 caracteres');
    this.name = 'InvalidItemNameError';
  }
}

export class InvalidMemberIdError extends EquipmentLoanError {
  constructor() {
    super('El ID del socio es inválido');
    this.name = 'InvalidMemberIdError';
  }
}
