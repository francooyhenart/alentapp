import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';

export const validateSchema = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await schema.parseAsync({
        body: request.body,
        query: request.query,
        params: request.params
      });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Validación fallida',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
  };
};
