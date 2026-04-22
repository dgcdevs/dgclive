import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ override: true });

// This ensures we don't create too many connections during hot-reload
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;