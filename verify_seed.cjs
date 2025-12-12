// verify_seed.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('--- Verifying Seed Data ---');
  try {
    const producers = await prisma.producer.findMany();
    console.log('Found ' + producers.length + ' producers:');
    console.table(producers.map(p => ({
        id: p.id,
        businessName: p.businessName,
        isWhitelisted: p.isWhitelisted
    })));

    const whitelistedCount = producers.filter(p => p.isWhitelisted).length;
    const notWhitelistedCount = producers.filter(p => !p.isWhitelisted).length;

    console.log('\nVerification Result:');
    console.log('- Whitelisted Producers: ' + whitelistedCount);
    console.log('- Non-Whitelisted Producers: ' + notWhitelistedCount);

    if (whitelistedCount > 0 && notWhitelistedCount > 0) {
      console.log('\n[SUCCESS] Seed data is correct. Found producers in both whitelisted and non-whitelisted states.');
    } else {
      console.error('\n[FAIL] Seed data is incorrect or missing.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error verifying seed data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();