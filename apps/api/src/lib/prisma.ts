import { PrismaClient } from '@prisma/client';

// This ensures we don't create too many connections during hot-reload
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;