import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { PostgresMemberRepository } from './infrastructure/PostgresMemberRepository.js';
import { MemberValidator } from './domain/services/MemberValidator.js';
import { LockerController } from './delivery/LockerController.js';
import { PrismaLockerRepository } from './infrastructure/PrismaLockerRepository.js';
import { NewLockerUseCase } from './application/NewLockerUseCase.js';
import { DeleteLockerUseCase } from './application/DeleteLockerUseCase.js';
import { CreateMemberUseCase } from './application/NewMemberUseCase.js';
import { GetMembersUseCase } from './application/GetMembersUseCase.js';
import { UpdateMemberUseCase } from './application/UpdateMemberUseCase.js';
import { DeleteMemberUseCase } from './application/DeleteMemberUseCase.js';
import { MemberController } from './delivery/MemberController.js';

const DeleteLockerParamsSchema = z.object({
  id: z.string().uuid({ message: 'El formato del ID de locker no es válido (debe ser UUID)' })
});

export function buildApp() {
    const server = Fastify({
        logger: {
            level: 'info',
            transport: process.env.NODE_ENV === 'development' 
            ? {
                target: 'pino-pretty',
                options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
                } 
            : undefined,
        },
    });

    server.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    const memberRepo = new PostgresMemberRepository();
    const memberValidator = new MemberValidator(memberRepo);
    
    const createMemberUseCase = new CreateMemberUseCase(memberRepo, memberValidator);
    const getMembersUseCase = new GetMembersUseCase(memberRepo);
    const updateMemberUseCase = new UpdateMemberUseCase(memberRepo, memberValidator);
    const deleteMemberUseCase = new DeleteMemberUseCase(memberRepo);
    const lockerRepo = new PrismaLockerRepository();
    const newLockerUseCase = new NewLockerUseCase(lockerRepo);
    const deleteLockerUseCase = new DeleteLockerUseCase(lockerRepo);

    const memberController = new MemberController(
        createMemberUseCase, 
        getMembersUseCase,
        updateMemberUseCase,
        deleteMemberUseCase
    );

    server.get('/api/v1/socios', memberController.getAll.bind(memberController));
    server.post('/api/v1/socios', memberController.create.bind(memberController));
    server.put('/api/v1/socios/:id', memberController.update.bind(memberController));
    server.delete('/api/v1/socios/:id', memberController.delete.bind(memberController));
    
    server.post('/api/v1/lockers', async (request, reply) => {
        const body = request.body as any;
        const result = await newLockerUseCase.execute({
            number: Number(body.number),
            location: body.location
        });
        return reply.status(201).send(result);
    });

    server.delete('/api/v1/lockers/:id', async (request, reply) => {
        try {
            const result = DeleteLockerParamsSchema.safeParse(request.params);
            if (!result.success) {
                return reply.status(400).send({ error: result.error.errors[0].message });
            }
            await deleteLockerUseCase.execute(result.data.id);
            return reply.status(204).send();
        } catch (error: any) {
            const statusCode = error.statusCode || 500;
            return reply.status(statusCode).send({ error: error.message });
        }
    });

    server.get('/', async (req, rep) => {
        rep.status(200).send({ msg: 'asd' })
    });

    return server;
}

if (process.argv[1] && process.argv[1].endsWith('app.ts')) {
    const server = buildApp();
    const port = parseInt(process.env.PORT || '3000', 10);

    server.listen({ port, host: '0.0.0.0' }, () =>
        server.log.info(`API server running on http://localhost:${port}`)
    );

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
        process.on(signal, async () => {
            await server.close();
            process.exit(0);
        });
    });
}
