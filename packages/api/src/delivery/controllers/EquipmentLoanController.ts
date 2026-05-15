import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateEquipmentLoanUseCase } from '../../application/use-cases/CreateEquipmentLoanUseCase';
import { CreateEquipmentLoanBody } from '../validators/EquipmentLoanValidators';
import {
  MemberNotFoundError,
  CategoryRestrictionError,
  InvalidItemNameError,
  InvalidMemberIdError
} from '../../domain/errors/EquipmentLoanErrors';

export class EquipmentLoanController {
  constructor(
    private readonly createEquipmentLoanUseCase: CreateEquipmentLoanUseCase
  ) {}

  async create(
    request: FastifyRequest<{ Body: CreateEquipmentLoanBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await this.createEquipmentLoanUseCase.execute(request.body);

      return reply.status(201).send(result);
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  private handleError(error: unknown, reply: FastifyReply): void {
    if (error instanceof CategoryRestrictionError) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message,
        code: 'CATEGORY_RESTRICTION'
      });
    }

    if (error instanceof MemberNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: error.message,
        code: 'MEMBER_NOT_FOUND'
      });
    }

    if (error instanceof InvalidItemNameError || error instanceof InvalidMemberIdError) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: error.message,
        code: 'VALIDATION_ERROR'
      });
    }

    // Error genérico
    console.error('Unexpected error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Ocurrió un error al procesar la solicitud',
      code: 'INTERNAL_ERROR'
    });
  }
}
