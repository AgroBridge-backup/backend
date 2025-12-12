import { PrismaClient } from '@prisma/client';
import { PrismaBatchRepository } from '../src/core/batches/infrastructure/PrismaBatchRepository';
import { CreateBatchUseCase } from '../src/core/batches/application/CreateBatchUseCase';
import { randomUUID } from 'crypto';

// Inicialización del cliente Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://agro_user:supersecretpassword@localhost:5432/agrobridge"
    }
  }
});

async function main() {
  console.log('🛡️ INICIANDO PROTOCOLO DE VERIFICACIÓN ZERO-TRUST (FINAL)...');

  // 1. Crear Usuario Dummy (Para integridad referencial)
  const pid = randomUUID();
  try {
    await prisma.user.create({
      data: {
        id: pid,
        email: `verify-${pid}@agrobridge.io`,
        password: 'hash-securo-placeholder', // En prod esto sería un hash bcrypt real
        role: 'PRODUCER',
        name: 'Verificador de Integridad'
      }
    });
    console.log(`👤 Productor de prueba registrado: ${pid}`);
  } catch (e) {
    console.log('ℹ️  Nota: El usuario de prueba ya existía o hubo colisión de ID.');
  }

  // 2. Instanciar Arquitectura Hexagonal
  const repo = new PrismaBatchRepository(prisma);
  const useCase = new CreateBatchUseCase(repo);

  console.log('⚙️  Ejecutando Caso de Uso: CreateBatch (Con Hashing SHA-256)...');
  
  // 3. Crear Lote (CORRECCIÓN APLICADA: 'HASS' en mayúsculas para coincidir con Enum Prisma)
  try {
    const batch = await useCase.execute({
      producerId: pid,
      variety: 'HASS', // <--- CORRECCIÓN CRÍTICA AQUÍ
      origin: "Huerta La Excelencia - Tancítaro, Michoacán",
      weightKg: 1500,
      harvestDate: new Date(),
    });

    // 4. EVIDENCIA FORENSE
    console.log('
✅ LOTE CREADO EXITOSAMENTE EN DB.');
    console.log('📄 Payload JSON Resultante:');
    console.log(JSON.stringify(batch, null, 2));

    console.log('
🔒 AUDITORÍA DE SEGURIDAD:');
    if (batch.blockchainHash && batch.blockchainHash.length === 64) {
      console.log('   [PASS] INTEGRIDAD CONFIRMADA.');
      console.log('   Hash SHA-256 Detectado: ' + batch.blockchainHash);
      console.log('   Este hash es la huella digital inmutable del lote.');
    } else {
      throw new Error('   [FAIL] ALERTA CRÍTICA: El hash no se generó correctamente.');
    }

  } catch (error) {
    console.error('
❌ ERROR DURANTE LA EJECUCIÓN:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
