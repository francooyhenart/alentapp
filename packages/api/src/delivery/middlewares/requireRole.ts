import { FastifyRequest, FastifyReply } from 'fastify';

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Por ahora solo pasa (para testing)
    return;
  };
};
