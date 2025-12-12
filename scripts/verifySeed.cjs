// scripts/verifySeed.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('--- Verifying Seed Data ---');
  const producers = await prisma.producer.findMany();
  console.log("Producers in DB:", producers);
  const whitelistedCount = producers.filter(p => p.isWhitelisted).length;
  if (producers.length >= 2 && whitelistedCount >= 1) {
      console.log(`[SUCCESS] Found ${producers.length} producers, including ${whitelistedCount} whitelisted. Data is valid.`);
  } else {
      console.error(`[FAIL] Data validation failed. Found ${producers.length} producers and ${whitelistedCount} whitelisted.`);
      process.exit(1);
  }
}
main().finally(() => prisma.$disconnect());
