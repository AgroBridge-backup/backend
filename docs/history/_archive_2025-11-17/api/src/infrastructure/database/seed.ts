import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
      role: UserRole.ADMIN,
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
      role: UserRole.PRODUCER,
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
