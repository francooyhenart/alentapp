import { FastifyRequest, FastifyReply } from 'fastify';

export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
    // Por ahora solo pasa (para testing)
  return;
};
