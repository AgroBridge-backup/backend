import * as Prisma from "@prisma/client";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import logger from "../../shared/utils/logger.js";

const prisma = new Prisma.PrismaClient();

export async function runSeed() {
  logger.info("Start seeding...");

  // --- Seed Admin User ---
  const adminPassword = await bcrypt.hash("test123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@test.com",
      passwordHash: adminPassword,
      role: Prisma.UserRole.ADMIN,
      firstName: "Admin",
      lastName: "User",
      isActive: true,
    },
  });
  logger.info(`Upserted admin user: ${admin.email}`);

  // --- Seed Producer User ---
  const producerPassword = await bcrypt.hash("prodpass", 10);
  const producer = await prisma.user.upsert({
    where: { email: "producer@test.com" },
    update: { passwordHash: producerPassword },
    create: {
      email: "producer@test.com",
      passwordHash: producerPassword,
      role: Prisma.UserRole.PRODUCER,
      firstName: "Producer",
      lastName: "User",
      isActive: true,
      producer: {
        create: {
          businessName: "Test Producer Inc.",
          rfc: "PRODTEST123",
          state: "Michoacán",
          municipality: "Uruapan",
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
  const producer2Password = await bcrypt.hash("prodpass2", 10);
  await prisma.user.upsert({
    where: { email: "producer2@test.com" },
    update: { passwordHash: producer2Password },
    create: {
      email: "producer2@test.com",
      passwordHash: producer2Password,
      role: Prisma.UserRole.PRODUCER,
      firstName: "Producer",
      lastName: "Two",
      isActive: true,
      producer: {
        create: {
          businessName: "Test Producer #2",
          rfc: "PRODTEST456",
          state: "Jalisco",
          municipality: "Guadalajara",
          latitude: 20.6597,
          longitude: -103.3496,
          isWhitelisted: false,
        },
      },
    },
  });
  logger.info(`Upserted second producer user: producer2@test.com`);

  // --- Seed Integration Test Users (for critical-flows.test.ts) ---
  const testPassword = await bcrypt.hash("TestPassword123!", 10);

  // Test Admin
  const testAdmin = await prisma.user.upsert({
    where: { email: "admin@test.agrobridge.io" },
    update: { passwordHash: testPassword },
    create: {
      email: "admin@test.agrobridge.io",
      passwordHash: testPassword,
      role: Prisma.UserRole.ADMIN,
      firstName: "Test",
      lastName: "Admin",
      isActive: true,
    },
  });
  logger.info(`Upserted test admin: ${testAdmin.email}`);

  // Test Producer
  const testProducer = await prisma.user.upsert({
    where: { email: "producer@test.agrobridge.io" },
    update: { passwordHash: testPassword },
    create: {
      email: "producer@test.agrobridge.io",
      passwordHash: testPassword,
      role: Prisma.UserRole.PRODUCER,
      firstName: "Test",
      lastName: "Producer",
      isActive: true,
      producer: {
        create: {
          businessName: "Test Agrobridge Producer",
          rfc: "TESTPROD789",
          state: "Michoacán",
          municipality: "Uruapan",
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
    where: { email: "certifier@test.agrobridge.io" },
    update: { passwordHash: testPassword },
    create: {
      email: "certifier@test.agrobridge.io",
      passwordHash: testPassword,
      role: Prisma.UserRole.CERTIFIER,
      firstName: "Test",
      lastName: "Certifier",
      isActive: true,
    },
  });
  logger.info(`Upserted test certifier: ${testCertifier.email}`);

  // Test Buyer
  const testBuyer = await prisma.user.upsert({
    where: { email: "buyer@test.agrobridge.io" },
    update: { passwordHash: testPassword },
    create: {
      email: "buyer@test.agrobridge.io",
      passwordHash: testPassword,
      role: Prisma.UserRole.BUYER,
      firstName: "Test",
      lastName: "Buyer",
      isActive: true,
    },
  });
  logger.info(`Upserted test buyer: ${testBuyer.email}`);

  // ════════════════════════════════════════════════════════════════════════════════
  // CASH FLOW BRIDGE MVP DATA
  // ════════════════════════════════════════════════════════════════════════════════

  logger.info("\n💰 Seeding Cash Flow Bridge MVP data...");

  // --- Create Liquidity Pool ---
  const pool = await prisma.liquidityPool.upsert({
    where: { id: "pilot-pool-001" },
    update: {
      availableCapital: 75000,
      deployedCapital: 0,
      reservedCapital: 0,
    },
    create: {
      id: "pilot-pool-001",
      name: "AgroBridge Pilot Pool",
      description: "Initial liquidity pool for Cash Flow Bridge pilot program",
      totalCapital: 75000,
      availableCapital: 75000,
      deployedCapital: 0,
      reservedCapital: 0,
      riskTier: "B",
      targetReturnRate: 15,
      actualReturnRate: 0,
      status: "ACTIVE",
      minAdvanceAmount: 3000,
      maxAdvanceAmount: 20000,
      maxExposureLimit: 60000,
      autoRebalanceEnabled: true,
      minReserveRatio: 15,
      currency: "MXN",
    },
  });
  logger.info(
    `✅ Liquidity Pool created: ${pool.name} ($${pool.totalCapital})`,
  );

  // --- Create Farmers with Credit Scores ---
  const farmersData = [
    {
      email: "juan.excellent@test.agrobridge.io",
      firstName: "Juan",
      lastName: "Pérez",
      businessName: "Aguacates Juan Pérez",
      rfc: "PEJM850101ABC",
      state: "Michoacán",
      municipality: "Uruapan",
      latitude: 19.4167,
      longitude: -102.05,
      creditScore: {
        totalOrdersCompleted: 25,
        totalOrdersDefaulted: 0,
        deliverySuccessRate: 96,
        averageQualityScore: 92,
        averageDeliveryDelay: 0,
        totalVolumeDelivered: 50000,
        totalValueDelivered: 500000,
        advancesCompleted: 8,
        advancesDefaulted: 0,
        deliveryScore: 95,
        qualityScore: 92,
        paymentScore: 100,
        volumeScore: 85,
        blockchainScore: 70,
        overallScore: 92,
        riskTier: "A" as const,
        maxAdvanceAmount: 20000,
        availableCredit: 20000,
        trend: "STABLE" as const,
      },
    },
    {
      email: "maria.good@test.agrobridge.io",
      firstName: "María",
      lastName: "González",
      businessName: "Berries González",
      rfc: "GOME900215XYZ",
      state: "Jalisco",
      municipality: "Zapopan",
      latitude: 20.7214,
      longitude: -103.3848,
      creditScore: {
        totalOrdersCompleted: 15,
        totalOrdersDefaulted: 1,
        deliverySuccessRate: 85,
        averageQualityScore: 82,
        averageDeliveryDelay: 2,
        totalVolumeDelivered: 30000,
        totalValueDelivered: 250000,
        advancesCompleted: 4,
        advancesDefaulted: 0,
        deliveryScore: 82,
        qualityScore: 80,
        paymentScore: 85,
        volumeScore: 70,
        blockchainScore: 55,
        overallScore: 78,
        riskTier: "B" as const,
        maxAdvanceAmount: 15000,
        availableCredit: 15000,
        trend: "IMPROVING" as const,
      },
    },
    {
      email: "carlos.new@test.agrobridge.io",
      firstName: "Carlos",
      lastName: "Ramírez",
      businessName: "Productos Ramírez",
      rfc: "RAMC950320DEF",
      state: "Sinaloa",
      municipality: "Culiacán",
      latitude: 24.8091,
      longitude: -107.394,
      creditScore: {
        totalOrdersCompleted: 3,
        totalOrdersDefaulted: 0,
        deliverySuccessRate: 100,
        averageQualityScore: 75,
        averageDeliveryDelay: 0,
        totalVolumeDelivered: 5000,
        totalValueDelivered: 45000,
        advancesCompleted: 0,
        advancesDefaulted: 0,
        deliveryScore: 70,
        qualityScore: 75,
        paymentScore: 70,
        volumeScore: 40,
        blockchainScore: 40,
        overallScore: 65,
        riskTier: "C" as const,
        maxAdvanceAmount: 8000,
        availableCredit: 8000,
        trend: "STABLE" as const,
      },
    },
    {
      email: "ana.medium@test.agrobridge.io",
      firstName: "Ana",
      lastName: "López",
      businessName: "Frutas Ana López",
      rfc: "LOAM880612GHI",
      state: "Guanajuato",
      municipality: "León",
      latitude: 21.125,
      longitude: -101.686,
      creditScore: {
        totalOrdersCompleted: 12,
        totalOrdersDefaulted: 1,
        deliverySuccessRate: 80,
        averageQualityScore: 78,
        averageDeliveryDelay: 3,
        totalVolumeDelivered: 20000,
        totalValueDelivered: 180000,
        advancesCompleted: 2,
        advancesDefaulted: 0,
        deliveryScore: 75,
        qualityScore: 78,
        paymentScore: 80,
        volumeScore: 60,
        blockchainScore: 55,
        overallScore: 74,
        riskTier: "B" as const,
        maxAdvanceAmount: 12000,
        availableCredit: 12000,
        trend: "STABLE" as const,
      },
    },
    {
      email: "pedro.strong@test.agrobridge.io",
      firstName: "Pedro",
      lastName: "Sánchez",
      businessName: "Exportadora Sánchez",
      rfc: "SAPM750830JKL",
      state: "Michoacán",
      municipality: "Tancítaro",
      latitude: 19.3456,
      longitude: -102.365,
      creditScore: {
        totalOrdersCompleted: 20,
        totalOrdersDefaulted: 0,
        deliverySuccessRate: 90,
        averageQualityScore: 88,
        averageDeliveryDelay: 1,
        totalVolumeDelivered: 40000,
        totalValueDelivered: 400000,
        advancesCompleted: 6,
        advancesDefaulted: 0,
        deliveryScore: 88,
        qualityScore: 86,
        paymentScore: 95,
        volumeScore: 80,
        blockchainScore: 70,
        overallScore: 87,
        riskTier: "B" as const,
        maxAdvanceAmount: 18000,
        availableCredit: 18000,
        trend: "IMPROVING" as const,
      },
    },
  ];

  const createdProducers: Array<{
    id: string;
    email: string;
    producerId: string;
  }> = [];

  for (const farmerData of farmersData) {
    const password = await bcrypt.hash("FarmerTest123!", 10);

    const user = await prisma.user.upsert({
      where: { email: farmerData.email },
      update: {},
      create: {
        email: farmerData.email,
        passwordHash: password,
        role: Prisma.UserRole.PRODUCER,
        firstName: farmerData.firstName,
        lastName: farmerData.lastName,
        isActive: true,
        producer: {
          create: {
            businessName: farmerData.businessName,
            rfc: farmerData.rfc,
            state: farmerData.state,
            municipality: farmerData.municipality,
            latitude: farmerData.latitude,
            longitude: farmerData.longitude,
            isWhitelisted: true,
            whitelistedAt: new Date(),
            cropTypes: ["Aguacate Hass", "Berries"],
          },
        },
      },
      include: {
        producer: true,
      },
    });

    if (user.producer) {
      // Create or update credit score
      await prisma.creditScore.upsert({
        where: { producerId: user.producer.id },
        update: farmerData.creditScore,
        create: {
          producerId: user.producer.id,
          ...farmerData.creditScore,
          blockchainVerifications: [],
          modelVersion: "1.0.0",
        },
      });

      createdProducers.push({
        id: user.id,
        email: user.email,
        producerId: user.producer.id,
      });
    }

    logger.info(
      `✅ Farmer created: ${farmerData.firstName} ${farmerData.lastName} (Score: ${farmerData.creditScore.overallScore}, Tier ${farmerData.creditScore.riskTier})`,
    );
  }

  // --- Create Test Buyer ---
  const buyerPassword = await bcrypt.hash("BuyerTest123!", 10);
  const buyer = await prisma.user.upsert({
    where: { email: "buyer@wholesale.test.agrobridge.io" },
    update: {},
    create: {
      email: "buyer@wholesale.test.agrobridge.io",
      passwordHash: buyerPassword,
      role: Prisma.UserRole.BUYER,
      firstName: "Distribuidora",
      lastName: "Nacional",
      isActive: true,
    },
  });
  logger.info(`✅ Buyer created: ${buyer.firstName} ${buyer.lastName}`);

  // --- Create Confirmed Orders (ready for advance requests) ---
  const ordersToCreate = [
    {
      producerIndex: 0, // Juan (Tier A)
      productType: "Aguacate Hass",
      quantity: 2000,
      pricePerUnit: 45,
      deliveryDays: 45,
      location: "CDMX",
      qualityReq: "Grade A, Caliber 32-36",
    },
    {
      producerIndex: 1, // María (Tier B)
      productType: "Fresa",
      quantity: 1500,
      pricePerUnit: 80,
      deliveryDays: 30,
      location: "Guadalajara",
      qualityReq: "Fresh, Grade A",
    },
    {
      producerIndex: 4, // Pedro (Tier B, strong)
      productType: "Aguacate Hass",
      quantity: 3000,
      pricePerUnit: 42,
      deliveryDays: 50,
      location: "Monterrey",
      qualityReq: "Grade A/B Mix",
    },
  ];

  for (let i = 0; i < ordersToCreate.length; i++) {
    const orderData = ordersToCreate[i];
    const producer = createdProducers[orderData.producerIndex];
    const totalAmount = orderData.quantity * orderData.pricePerUnit;
    const orderNumber = `ORD-CFB-${Date.now()}-${i + 1}`.slice(0, 20);

    await prisma.order.upsert({
      where: { orderNumber },
      update: {},
      create: {
        orderNumber,
        producerId: producer.producerId,
        buyerId: buyer.id,
        productType: orderData.productType,
        quantity: orderData.quantity,
        unitPrice: orderData.pricePerUnit,
        totalAmount,
        currency: "MXN",
        status: "CONFIRMED",
        expectedDeliveryDate: new Date(
          Date.now() + orderData.deliveryDays * 24 * 60 * 60 * 1000,
        ),
        advanceEligible: true,
        advanceRequested: false,
      },
    });

    logger.info(
      `✅ Order created: ${orderNumber} - $${totalAmount} MXN (${orderData.productType})`,
    );
  }

  // --- Summary ---
  logger.info("\n📊 Cash Flow Bridge MVP Seed Summary:");
  logger.info(`   💰 Liquidity Pool: $${pool.totalCapital} available`);
  logger.info(
    `   👨‍🌾 Farmers: ${createdProducers.length} (1 Tier A, 3 Tier B, 1 Tier C)`,
  );
  logger.info(
    `   📦 Orders: ${ordersToCreate.length} confirmed and advance-eligible`,
  );
  logger.info("   ✅ Ready for advance requests!");

  logger.info("\nSeeding finished.");
}

// Allow the script to be run directly (ES module compatible)
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runSeed()
    .catch((e) => {
      logger.error("Error during seeding:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
