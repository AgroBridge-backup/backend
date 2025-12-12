import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ProducerCertification } from "../typechain-types";

interface DeploymentInfo {
  network: string;
  contracts: {
    ProducerCertification: { address: string };
  };
}

async function main() {
  console.log("🌱 Seeding productores de prueba...\n");
  const network = await ethers.provider.getNetwork();

  // Cargar dirección del contrato del último deployment
  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFilename = `deployment-${network.name}-${network.chainId}.json`;
  const deploymentFilepath = path.join(deploymentsDir, deploymentFilename);
  
  if (!fs.existsSync(deploymentFilepath)) {
    throw new Error(`No se encontró deployment para la red ${network.name}. Ejecuta 'npx hardhat run scripts/deploy.ts --network ${network.name}' primero.`);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentFilepath, "utf-8")
  );

  const producerCertificationAddress = deploymentInfo.contracts.ProducerCertification.address;
  const producerCertification = await ethers.getContractAt(
    "ProducerCertification",
    producerCertificationAddress
  ) as ProducerCertification;

  const [deployer, certifier] = await ethers.getSigners();
  console.log("Usando cuenta de certifier:", certifier.address);

  // Asignar rol de certificador si es necesario
  const CERTIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("CERTIFIER_ROLE"));
  if (!(await producerCertification.hasRole(CERTIFIER_ROLE, certifier.address))) {
      console.log("Asignando CERTIFIER_ROLE a", certifier.address);
      await producerCertification.connect(deployer).grantRole(CERTIFIER_ROLE, certifier.address);
  }

  const producers = [
    { wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", name: "Agrícola Don Goyo", rfc: "ADG180425HG3" },
    { wallet: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", name: "Exportadora La Meseta", rfc: "EAM190315JK7" },
    { wallet: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", name: "Empacadora Cerro Verde", rfc: "ECV200520MN2" }
  ];

  console.log("\n📋 Agregando productores a la whitelist...\n");

  for (const producer of producers) {
    try {
      if (await producerCertification.isProducerCertified(producer.wallet)) {
        console.log(`⚠️  Productor ${producer.name} (${producer.wallet}) ya está certificado.`);
        continue;
      }
      const tx = await producerCertification.connect(certifier).addProducer(
        producer.wallet,
        producer.name,
        producer.rfc
      );
      await tx.wait();
      console.log(`✅ Productor ${producer.name} agregado. Wallet: ${producer.wallet}`);
    } catch (error: any) {
      console.error(`❌ Error agregando ${producer.name}:`, error.message);
    }
  }

  console.log("\n🌱 Seed completo.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
