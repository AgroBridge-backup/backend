import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Iniciando deployment de AgroBridge Smart Contracts...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📍 Deploying con la cuenta:", deployer.address);
  console.log("🌍 Red:", network.name, "(Chain ID:", network.chainId.toString() + ")");
  console.log("💰 Balance de la cuenta:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  // --- 1. Deploy ProducerCertification ---
  console.log("📝 Deploying ProducerCertification...");
  const ProducerCertification = await ethers.getContractFactory("ProducerCertification");
  const producerCertification = await upgrades.deployProxy(
    ProducerCertification,
    [deployer.address], // admin
    { kind: "uups", initializer: "initialize" }
  );
  await producerCertification.waitForDeployment();
  const producerCertAddress = await producerCertification.getAddress();
  console.log("✅ ProducerCertification (proxy) deployed a:", producerCertAddress);

  // --- 2. Deploy TraceabilityRegistry ---
  console.log("\n📝 Deploying TraceabilityRegistry...");
  const TraceabilityRegistry = await ethers.getContractFactory("TraceabilityRegistry");
  const traceabilityRegistry = await upgrades.deployProxy(
    TraceabilityRegistry,
    [deployer.address, producerCertAddress], // admin, producerCertificationContractAddress
    { kind: "uups", initializer: "initialize" }
  );
  await traceabilityRegistry.waitForDeployment();
  const traceabilityAddress = await traceabilityRegistry.getAddress();
  console.log("✅ TraceabilityRegistry (proxy) deployed a:", traceabilityAddress);

  // --- 3. Deploy BatchToken (NFT) ---
  const royaltyReceiver = deployer.address; // O una dirección de cooperativa
  const royaltyFeeNumerator = 50; // 0.5% (50 / 10000)
  console.log("\n📝 Deploying BatchToken...");
  const BatchToken = await ethers.getContractFactory("BatchToken");
  const batchToken = await upgrades.deployProxy(
    BatchToken,
    [deployer.address, producerCertAddress, royaltyReceiver, royaltyFeeNumerator], // admin, producerCertAddress, royaltyReceiver, fee
    { kind: "uups", initializer: "initialize" }
  );
  await batchToken.waitForDeployment();
  const batchTokenAddress = await batchToken.getAddress();
  console.log("✅ BatchToken (proxy) deployed a:", batchTokenAddress);
  
  // --- 4. Guardar direcciones e info ---
  console.log("\n📄 Guardando información del deployment...");
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ProducerCertification: {
        address: producerCertAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(producerCertAddress)
      },
      TraceabilityRegistry: {
        address: traceabilityAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(traceabilityAddress)
      },
      BatchToken: {
        address: batchTokenAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(batchTokenAddress)
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const filename = `deployment-${network.name}-${network.chainId}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("   -> Info guardada en:", path.join(deploymentsDir, filename));
  console.log("\n✅ DEPLOYMENT COMPLETO\n");
  console.log("═════════════════════════════════════════════════════════════");
  console.log("DIRECCIONES DE CONTRATOS:");
  console.log("  - ProducerCertification:", producerCertAddress);
  console.log("  - TraceabilityRegistry: ", traceabilityAddress);
  console.log("  - BatchToken:           ", batchTokenAddress);
  console.log("═════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error en deployment:", error);
    process.exit(1);
  });
