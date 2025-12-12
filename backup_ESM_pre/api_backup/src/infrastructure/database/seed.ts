import * as Prisma from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new Prisma.PrismaClient();

async function main() {
  console.log('Start seeding...');

  // --- Seed Admin User ---
  const adminPassword = await bcrypt.hash('test123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: adminPassword,
      role: Prisma.UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    },
  });
  console.log(`Upserted admin user: ${admin.email}`);

  // --- Seed Producer User ---
  const producerPassword = await bcrypt.hash('prodpass', 10);
  const producer = await prisma.user.upsert({
    where: { email: 'producer@test.com' },
    update: {},
    create: {
      email: 'producer@test.com',
      passwordHash: producerPassword,
      role: Prisma.UserRole.PRODUCER,
      firstName: 'Producer',
      lastName: 'User',
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
  console.log(`Upserted producer user: ${producer.email}`);

  // --- Seed Second Producer User ---
  const producer2Password = await bcrypt.hash('prodpass2', 10);
  const producer2 = await prisma.user.upsert({
    where: { email: 'producer2@test.com' },
    update: {},
    create: {
      email: 'producer2@test.com',
      passwordHash: producer2Password,
      role: Prisma.UserRole.PRODUCER,
      firstName: 'Producer',
      lastName: 'Two',
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
    include: {
      producer: true,
    },
  });
  console.log(`Upserted second producer user: ${producer2.email}`);

  console.log('\n--- Verifying Seed Data ---');
  const producers = await prisma.producer.findMany();
  console.log(`Found ${producers.length} producers in database:`);
  console.table(producers.map(p => ({
    id: p.id,
    businessName: p.businessName,
    isWhitelisted: p.isWhitelisted
  })));
  const whitelistedCount = producers.filter(p => p.isWhitelisted).length;
  if (producers.length >= 2 && whitelistedCount >= 1) {
    console.log('[SUCCESS] Seed data verification passed.');
  } else {
    throw new Error('[FAIL] Seed data verification failed.');
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
