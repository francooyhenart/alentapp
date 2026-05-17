export enum LoanStatus {
  LOANED = 'Loaned',
  RETURNED = 'Returned',
  DAMAGED = 'Damaged',
  CANCELED = 'Canceled'
}

export class LoanStatusVO {
  private constructor(private readonly value: LoanStatus) {}

  static create(status: string): LoanStatusVO {
    if (!Object.values(LoanStatus).includes(status as LoanStatus)) {
      throw new Error(`Invalid loan status: ${status}`);
    }
    return new LoanStatusVO(status as LoanStatus);
  }

  static createLoaned(): LoanStatusVO {
    return new LoanStatusVO(LoanStatus.LOANED);
  }

  getValue(): LoanStatus {
    return this.value;
  }

  isLoaned(): boolean {
    return this.value === LoanStatus.LOANED;
  }

  isReturned(): boolean {
    return this.value === LoanStatus.RETURNED;
  }

  isDamaged(): boolean {
    return this.value === LoanStatus.DAMAGED;
  }

  isCanceled(): boolean {
    return this.value === LoanStatus.CANCELED;
  }

  toString(): string {
    return this.value;
  }
}
