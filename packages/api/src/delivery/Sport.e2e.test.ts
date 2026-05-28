import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { config } from 'dotenv';

config({ path: '.env.test' });

describe('Sport API End-to-End Tests', () => {
    let app: FastifyInstance;
    let prisma: PrismaClient;
    let createdSportId: string;

    const randomSuffix = Math.floor(Math.random() * 100000).toString();
    const testSportName = `Deporte E2E ${randomSuffix}`;

    beforeAll(async () => {
        const { buildApp } = await import('../app.js');
        app = buildApp();
        await app.ready();

        prisma = new PrismaClient({
            adapter: new PrismaPg(process.env.DATABASE_URL as any),
        });
        await prisma.$connect();
    });

    afterAll(async () => {
        if (createdSportId) {
            await prisma.sport.deleteMany({
                where: { id: createdSportId },
            });
        }

        await prisma?.$disconnect();
        await app?.close();
    });

    //test 36 - e2e POST: debe crear un deporte en la base de datos real
    it('debe crear un deporte en la base de datos real', async () => {
        const payload = {
            name: testSportName,
            description: 'Actividad creada desde test e2e',
            max_capacity: 20,
            additional_price: 1500,
            requires_medical_certificate: true,
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload,
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.data.id).toBeDefined();
        expect(body.data.name).toBe(testSportName);

        createdSportId = body.data.id;

        const dbSport = await prisma.sport.findUnique({
            where: { id: createdSportId },
        });

        expect(dbSport).not.toBeNull();
        expect(dbSport?.name).toBe(testSportName);
        expect(dbSport?.description).toBe('Actividad creada desde test e2e');
        expect(dbSport?.max_capacity).toBe(20);
        expect(Number(dbSport?.additional_price)).toBe(1500);
        expect(dbSport?.requires_medical_certificate).toBe(true);
    });

    //test 37 - e2e POST: debe fallar si el nombre del deporte ya existe en la base de datos real
    it('debe fallar si el nombre del deporte ya existe en la base de datos real', async () => {
        const payload = {
            name: testSportName,
            description: 'Actividad duplicada desde test e2e',
            max_capacity: 15,
            additional_price: 500,
            requires_medical_certificate: false,
        };

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/sports',
            payload,
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.payload);
        expect(body.error).toBe('Ya existe un deporte con ese nombre');

        const dbSports = await prisma.sport.findMany({
            where: { name: testSportName },
        });

        expect(dbSports).toHaveLength(1);
    });
});
