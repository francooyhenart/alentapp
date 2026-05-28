import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { NewLockerUseCase, NewLockerInput } from '../application/NewLockerUseCase.js';
import { DeleteLockerUseCase } from '../application/DeleteLockerUseCase.js';
import { UpdateLockerStatusUseCase } from '../application/UpdateLockerStatusUseCase.js'; // 👈 Importamos el caso de uso
import { PrismaLockerRepository } from '../infrastructure/PrismaLockerRepository.js';

const DeleteLockerParamsSchema = z.object({
  id: z.string().uuid({ message: 'El formato del ID de locker no es válido (debe ser UUID)' })
});

// 👈 Validaciones para el cambio de estado
const UpdateStatusParamsSchema = z.object({
  id: z.string().uuid({ message: 'El formato del ID de locker no es válido (debe ser UUID)' })
});

const UpdateStatusBodySchema = z.object({
  status: z.enum(['Available', 'Maintenance'], { 
    message: 'El estado debe ser estrictamente "Available" o "Maintenance"' 
  })
});

export async function LockerController(fastify: FastifyInstance) {
  
  const lockerRepository = new PrismaLockerRepository();
  const newLockerUseCase = new NewLockerUseCase(lockerRepository);
  const deleteLockerUseCase = new DeleteLockerUseCase(lockerRepository);
  const updateLockerStatusUseCase = new UpdateLockerStatusUseCase(lockerRepository); // 👈 Instanciamos

  // 1. Endpoint POST para crear el locker
  fastify.post('/lockers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as NewLockerInput;
      if (!body.number || !body.location) {
        return reply.status(400).send({ 
          error: 'Faltan datos obligatorios: "number" y "location" son requeridos.' 
        });
      }
      const createdLocker = await newLockerUseCase.execute({
        number: Number(body.number),
        location: body.location
      });
      return reply.status(201).send(createdLocker);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

// 2. Endpoint DELETE para dar de baja un locker
  fastify.delete('/lockers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = DeleteLockerParamsSchema.safeParse(request.params);
      if (!result.success) {
        // 👇 CAMBIAR SOLO ESTA LÍNEA: de .errors a .issues
        const firstError = result.error.issues[0].message;
        return reply.status(400).send({ error: firstError });
      }
      const { id } = result.data;
      await deleteLockerUseCase.execute(id);
      return reply.status(204).send();
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({ error: error.message });
    }
  });

  // 3. Endpoint PATCH para actualizar estado operativo (Mantenimiento)
  fastify.patch('/lockers/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validar Parámetros
      const paramResult = UpdateStatusParamsSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(400).send({ error: paramResult.error.errors[0].message });
      }

      // Validar Body
      const bodyResult = UpdateStatusBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({ error: bodyResult.error.errors[0].message });
      }

      const { id } = paramResult.data;
      const { status } = bodyResult.data;

      // El caso de uso ya se encarga de tirar 409 si está "Occupied"
      const updatedLocker = await updateLockerStatusUseCase.execute(id, status);

      return reply.status(200).send(updatedLocker);

    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({ error: error.message });
    }
  });
}