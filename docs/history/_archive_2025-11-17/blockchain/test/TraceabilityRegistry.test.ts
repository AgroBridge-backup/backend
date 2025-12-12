import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { keccak256, toUtf8Bytes, ZeroAddress, isBytesLike, isAddressable, anyValue } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ProducerCertification, TraceabilityRegistry, BatchToken } from "../typechain-types";

describe("AgroBridge Full System Test", function () {
  let producerCertification: ProducerCertification;
  let traceabilityRegistry: TraceabilityRegistry;
  let batchToken: BatchToken;
  let admin: SignerWithAddress;
  let producer1: SignerWithAddress;
  let producer2: SignerWithAddress;
  let certifier: SignerWithAddress;
  let otherUser: SignerWithAddress;

  const CERTIFIER_ROLE = keccak256(toUtf8Bytes("CERTIFIER_ROLE"));

  async function deploySystemFixture() {
    const [admin, producer1, producer2, certifier, otherUser] = await ethers.getSigners();

    // 1. Deploy ProducerCertification
    const ProducerCertificationFactory = await ethers.getContractFactory("ProducerCertification");
    const producerCertificationDeployed = await upgrades.deployProxy(
      ProducerCertificationFactory,
      [admin.address],
      { kind: "uups" }
    );
    await producerCertificationDeployed.waitForDeployment();
    const producerCertification = await ethers.getContractAt(
      "ProducerCertification",
      await producerCertificationDeployed.getAddress()
    ) as ProducerCertification;

    // 2. Deploy TraceabilityRegistry
    const TraceabilityRegistryFactory = await ethers.getContractFactory("TraceabilityRegistry");
    const traceabilityRegistryDeployed = await upgrades.deployProxy(
      TraceabilityRegistryFactory,
      [admin.address, await producerCertification.getAddress()],
      { kind: "uups" }
    );
    await traceabilityRegistryDeployed.waitForDeployment();
    const traceabilityRegistry = await ethers.getContractAt(
      "TraceabilityRegistry",
      await traceabilityRegistryDeployed.getAddress()
    ) as TraceabilityRegistry;

    // 3. Deploy BatchToken
    const BatchTokenFactory = await ethers.getContractFactory("BatchToken");
    const batchTokenDeployed = await upgrades.deployProxy(
      BatchTokenFactory,
      [admin.address, await producerCertification.getAddress(), admin.address, 50], // admin, producerCert, royaltyReceiver, fee
      { kind: "uups" }
    );
    await batchTokenDeployed.waitForDeployment();
    const batchToken = await ethers.getContractAt(
      "BatchToken",
      await batchTokenDeployed.getAddress()
    ) as BatchToken;

    // 4. Grant roles
    await producerCertification.grantRole(CERTIFIER_ROLE, certifier.address);
    const certifierProducerCertificationFactory = await ethers.getContractFactory("ProducerCertification", certifier);
    const certifierProducerCertification = certifierProducerCertificationFactory.attach(await producerCertification.getAddress()) as ProducerCertification;
    await certifierProducerCertification.whitelistProducer(producer1.address, "Producer One", "P1-RFC", "State1", "Municipality1", 0, 0);
    await certifierProducerCertification.whitelistProducer(producer2.address, "Producer Two", "P2-RFC", "State2", "Municipality2", 0, 0);

    await batchToken.grantRole(batchToken.MINTER_ROLE(), producer1.address);

    return { traceabilityRegistry, producerCertification, batchToken, admin, producer1, producer2, certifier, otherUser };
  }

  describe("Deployment & Setup", function () {
    it("Debe deployar todos los contratos y asignar roles correctamente", async function () {
      const { producerCertification, admin, certifier, producer1 } = await loadFixture(deploySystemFixture);
      expect(await producerCertification.hasRole(await producerCertification.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await producerCertification.hasRole(CERTIFIER_ROLE, certifier.address)).to.be.true;
      expect(await producerCertification.isProducerCertified(producer1.address)).to.be.true;
    });
  });

  describe("TraceabilityRegistry: Registro de Eventos", function () {
    const batchId = "AVD-2025-URU-001";
    const eventType = "HARVEST";
    const latitude = 19702400;
    const longitude = -101554900;
    const ipfsHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    it("Debe permitir a un productor certificado registrar un evento", async function () {
      const { traceabilityRegistry, producer1 } = await loadFixture(deploySystemFixture);
      await expect(traceabilityRegistry.connect(producer1).registerEvent(eventType, batchId, latitude, longitude, ipfsHash))
        .to.emit(traceabilityRegistry, "EventRegistered");
    });

    it("Debe rechazar registro de un productor no certificado", async function () {
      const { traceabilityRegistry, producerCertification, otherUser } = await loadFixture(deploySystemFixture);
      expect(await producerCertification.isProducerCertified(otherUser.address)).to.be.false;
      await expect(
        traceabilityRegistry.connect(otherUser).registerEvent(eventType, batchId, latitude, longitude, ipfsHash)
).to.be.revertedWithCustomError(traceabilityRegistry, "NotACertifiedProducer");
    });

    it("Debe crear una cadena de eventos con hashes correctos", async function () {
        const { traceabilityRegistry, producer1 } = await loadFixture(deploySystemFixture);
        const tx1 = await traceabilityRegistry.connect(producer1).registerEvent("HARVEST", batchId, latitude, longitude, ipfsHash);
        const receipt1 = await tx1.wait();
        const event1Id = (receipt1?.logs.find(e => (e as any).fragment?.name === 'EventRegistered') as any)?.args[0];

        const tx2 = await traceabilityRegistry.connect(producer1).registerEvent("PROCESSING", batchId, latitude, longitude, ipfsHash);
        const history = await traceabilityRegistry.getBatchHistory(batchId);
        
        expect(history.length).to.equal(2);
        expect(history[1].previousEventHash).to.equal(event1Id);
    });
  });

  describe("ProducerCertification: Gestión de Productores", function () {


    it("Un no-certificador no debe poder agregar productores", async function () {
      const { producerCertification, otherUser } = await loadFixture(deploySystemFixture);
      const otherUserProducerCertificationFactory = await ethers.getContractFactory("ProducerCertification", otherUser);
      const otherUserProducerCertification = otherUserProducerCertificationFactory.attach(await producerCertification.getAddress()) as ProducerCertification;
      await expect(
        otherUserProducerCertification.whitelistProducer(otherUser.address, "Fake Producer", "FAKE-RFC", "StateX", "MunicipalityX", 0, 0)
      ).to.be.revertedWithCustomError(otherUserProducerCertification, "AccessControlUnauthorizedAccount");
    });
  });

  describe("BatchToken: Minting de NFTs", function () {
    it("Productor certificado debe poder mintear un Batch NFT", async function () {
        const { batchToken, producer1 } = await loadFixture(deploySystemFixture);
        const tokenURI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
        const producer1BatchTokenFactory = await ethers.getContractFactory("BatchToken", producer1);
        const producer1BatchToken = producer1BatchTokenFactory.attach(await batchToken.getAddress()) as BatchToken;
        await expect(producer1BatchToken.mintBatch(producer1.address, "BATCH-001", tokenURI))
            .to.emit(batchToken, "Transfer")
            .withArgs(ZeroAddress, producer1.address, 0);
        expect(await batchToken.ownerOf(0)).to.equal(producer1.address);
        expect(await batchToken.tokenURI(0)).to.equal(tokenURI);
    });

    it("Un no-productor no debe poder mintear un Batch NFT", async function () {
        const { batchToken, otherUser } = await loadFixture(deploySystemFixture);
        const tokenURI = "ipfs://some_uri";
        const otherUserBatchTokenFactory = await ethers.getContractFactory("BatchToken", otherUser);
        const otherUserBatchToken = otherUserBatchTokenFactory.attach(await batchToken.getAddress()) as BatchToken;
        await expect(
            otherUserBatchToken.mintBatch(otherUser.address, "BATCH-002", tokenURI)
        ).to.be.reverted;
    });
  });

  describe("Pausabilidad y Seguridad", function () {
    it("Admin debe poder pausar y despausar TraceabilityRegistry", async function () {
      const { traceabilityRegistry, admin, producer1 } = await loadFixture(deploySystemFixture);
      await traceabilityRegistry.connect(admin).pause();
      await expect(
        traceabilityRegistry.connect(producer1).registerEvent("HARVEST", "B001", 0, 0, "hash")
      ).to.be.reverted;
      
      await traceabilityRegistry.connect(admin).unpause();
      await expect(
        traceabilityRegistry.connect(producer1).registerEvent("HARVEST", "B001", 0, 0, "hash")
      ).to.not.be.reverted;
    });
  });

  describe("Upgradeability", function () {
    it("Debe preservar el estado después de un upgrade", async function () {
      const { traceabilityRegistry, producer1 } = await loadFixture(deploySystemFixture);
      const batchId = "UPG-TEST-001";
      await traceabilityRegistry.connect(producer1).registerEvent("HARVEST", batchId, 0, 0, "hash1");
      
      const TraceabilityRegistryV2 = await ethers.getContractFactory("TraceabilityRegistry"); // Assuming same contract for test
      const upgradedRegistry = await upgrades.upgradeProxy(await traceabilityRegistry.getAddress(), TraceabilityRegistryV2);

      const history = await upgradedRegistry.getBatchHistory(batchId);
      expect(history.length).to.equal(1);
      expect(history[0].producer).to.equal(producer1.address);
    });
  });
});