import * as Prisma from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import logger from '../../shared/utils/logger.js';

const prisma = new Prisma.PrismaClient();

export async function runSeed() {
  logger.info('Start seeding...');

  // --- Seed Admin User ---
  const adminPassword = await bcrypt.hash('test123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash: adminPassword },
    create: {
      email: 'admin@test.com',
      passwordHash: adminPassword,
      role: Prisma.UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    },
  });
  logger.info(`Upserted admin user: ${admin.email}`);

  // --- Seed Producer User ---
  const producerPassword = await bcrypt.hash('prodpass', 10);
  const producer = await prisma.user.upsert({
    where: { email: 'producer@test.com' },
    update: { passwordHash: producerPassword },
    create: {
      email: 'producer@test.com',
      passwordHash: producerPassword,
      role: Prisma.UserRole.PRODUCER,
      firstName: 'Producer',
      lastName: 'User',
      isActive: true,
      producer: {
        create: {
          businessName: 'Test Producer Inc.',
          rfc: 'PRODTEST123',
          state: 'Michoacán',
          municipality: 'Uruapan',
          latitude: 19.4136,
          longitude: -102.062,
          isWhitelisted: true,
        },
      },
    },
    include: {
      producer: true,
    },
  });
  logger.info(`Upserted producer user: ${producer.email}`);

  // --- Seed Second Producer User ---
  const producer2Password = await bcrypt.hash('prodpass2', 10);
  await prisma.user.upsert({
    where: { email: 'producer2@test.com' },
    update: { passwordHash: producer2Password },
    create: {
      email: 'producer2@test.com',
      passwordHash: producer2Password,
      role: Prisma.UserRole.PRODUCER,
      firstName: 'Producer',
      lastName: 'Two',
      isActive: true,
      producer: {
        create: {
          businessName: 'Test Producer #2',
          rfc: 'PRODTEST456',
          state: 'Jalisco',
          municipality: 'Guadalajara',
          latitude: 20.6597,
          longitude: -103.3496,
          isWhitelisted: false,
        },
      },
    },
  });
  logger.info(`Upserted second producer user: producer2@test.com`);

  // --- Seed Integration Test Users (for critical-flows.test.ts) ---
  const testPassword = await bcrypt.hash('TestPassword123!', 10);

  // Test Admin
  const testAdmin = await prisma.user.upsert({
    where: { email: 'admin@test.agrobridge.io' },
    update: { passwordHash: testPassword },
    create: {
      email: 'admin@test.agrobridge.io',
      passwordHash: testPassword,
      role: Prisma.UserRole.ADMIN,
      firstName: 'Test',
      lastName: 'Admin',
      isActive: true,
    },
  });
  logger.info(`Upserted test admin: ${testAdmin.email}`);

  // Test Producer
  const testProducer = await prisma.user.upsert({
    where: { email: 'producer@test.agrobridge.io' },
    update: { passwordHash: testPassword },
    create: {
      email: 'producer@test.agrobridge.io',
      passwordHash: testPassword,
      role: Prisma.UserRole.PRODUCER,
      firstName: 'Test',
      lastName: 'Producer',
      isActive: true,
      producer: {
        create: {
          businessName: 'Test Agrobridge Producer',
          rfc: 'TESTPROD789',
          state: 'Michoacán',
          municipality: 'Uruapan',
          latitude: 19.4136,
          longitude: -102.062,
          isWhitelisted: true,
          whitelistedAt: new Date(),
        },
      },
    },
  });
  logger.info(`Upserted test producer: ${testProducer.email}`);

  // Test Certifier
  const testCertifier = await prisma.user.upsert({
    where: { email: 'certifier@test.agrobridge.io' },
    update: { passwordHash: testPassword },
    create: {
      email: 'certifier@test.agrobridge.io',
      passwordHash: testPassword,
      role: Prisma.UserRole.CERTIFIER,
      firstName: 'Test',
      lastName: 'Certifier',
      isActive: true,
    },
  });
  logger.info(`Upserted test certifier: ${testCertifier.email}`);

  // Test Buyer
  const testBuyer = await prisma.user.upsert({
    where: { email: 'buyer@test.agrobridge.io' },
    update: { passwordHash: testPassword },
    create: {
      email: 'buyer@test.agrobridge.io',
      passwordHash: testPassword,
      role: Prisma.UserRole.BUYER,
      firstName: 'Test',
      lastName: 'Buyer',
      isActive: true,
    },
  });
  logger.info(`Upserted test buyer: ${testBuyer.email}`);

  logger.info('Seeding finished.');
}

// Allow the script to be run directly (ES module compatible)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runSeed()
    .catch((e) => {
      logger.error('Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
