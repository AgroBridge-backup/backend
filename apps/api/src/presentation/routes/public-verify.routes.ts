/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - PUBLIC BLOCKCHAIN VERIFICATION ROUTES
 * Phase 1: Revenue Sprint - Blockchain-Verified Trust Layer
 *
 * PUBLIC endpoints - NO authentication required
 * Allows anyone (buyers, customs, auditors) to verify blockchain records
 *
 * @module presentation/routes/public-verify
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../infrastructure/logging/logger.js';
// P1 FIX: Import use cases and repositories for clean architecture
import { PrismaInvoiceRepository } from '../../infrastructure/database/prisma/repositories/PrismaInvoiceRepository.js';
import { PrismaReferralRepository } from '../../infrastructure/database/prisma/repositories/PrismaReferralRepository.js';
import { VerifyInvoiceUseCase } from '../../application/use-cases/public-verify/VerifyInvoiceUseCase.js';
import { VerifyReferralUseCase } from '../../application/use-cases/public-verify/VerifyReferralUseCase.js';

const router = Router();
const prisma = new PrismaClient();

// P1 FIX: Initialize repositories and use cases
const invoiceRepository = new PrismaInvoiceRepository(prisma);
const referralRepository = new PrismaReferralRepository(prisma);
const verifyInvoiceUseCase = new VerifyInvoiceUseCase(invoiceRepository);
const verifyReferralUseCase = new VerifyReferralUseCase(referralRepository);

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BLOCKCHAIN_CONFIG = {
  network: process.env.BLOCKCHAIN_NETWORK || 'polygon',
  explorerUrl: process.env.BLOCKCHAIN_EXPLORER_URL || 'https://polygonscan.com',
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify batch authenticity via blockchain
 * PUBLIC - No authentication required
 */
router.get('/batch/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Get batch from database with related data
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        producer: {
          select: {
            businessName: true,
            state: true,
            municipality: true,
            certifications: {
              where: { isActive: true },
              select: {
                type: true,
                certifier: true,
                certificateNumber: true,
                issuedAt: true,
                expiresAt: true,
                ipfsHash: true,
              },
            },
          },
        },
        events: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            eventType: true,
            timestamp: true,
            locationName: true,
            latitude: true,
            longitude: true,
            temperature: true,
            humidity: true,
            blockchainTxHash: true,
            isVerified: true,
            photos: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado / Batch not found',
        code: 'BATCH_NOT_FOUND',
      });
    }

    // 2. Build blockchain verification info
    const blockchainInfo = {
      verified: !!batch.blockchainHash,
      hash: batch.blockchainHash,
      network: BLOCKCHAIN_CONFIG.network,
      explorerUrl: batch.blockchainHash
        ? `${BLOCKCHAIN_CONFIG.explorerUrl}/tx/${batch.blockchainHash}`
        : null,
      timestamp: batch.createdAt,
    };

    // 3. Build response (for HTML or JSON based on Accept header)
    const verificationData = {
      success: true,
      batch: {
        id: batch.id,
        product: batch.variety,
        origin: batch.origin,
        weightKg: Number(batch.weightKg),
        harvestDate: batch.harvestDate,
        status: batch.status,
        createdAt: batch.createdAt,
      },
      producer: {
        name: batch.producer.businessName,
        location: `${batch.producer.municipality}, ${batch.producer.state}`,
        certifications: batch.producer.certifications.map((cert) => ({
          type: cert.type,
          certifier: cert.certifier,
          number: cert.certificateNumber,
          valid: new Date(cert.expiresAt) > new Date(),
          expiresAt: cert.expiresAt,
        })),
      },
      blockchain: blockchainInfo,
      timeline: batch.events.map((event) => ({
        id: event.id,
        type: event.eventType,
        timestamp: event.timestamp,
        location: event.locationName || 'Unknown',
        coordinates: {
          lat: Number(event.latitude),
          lng: Number(event.longitude),
        },
        conditions: {
          temperature: event.temperature ? Number(event.temperature) : null,
          humidity: event.humidity ? Number(event.humidity) : null,
        },
        verified: event.isVerified,
        txHash: event.blockchainTxHash,
        photoCount: event.photos?.length || 0,
      })),
      verification: {
        isAuthentic: !!batch.blockchainHash,
        message: batch.blockchainHash
          ? 'Este lote ha sido verificado en blockchain y es auténtico.'
          : 'Este lote aún no ha sido registrado en blockchain.',
        verifiedAt: new Date().toISOString(),
      },
    };

    // Check Accept header for HTML rendering
    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateBatchVerificationHTML(verificationData));
    }

    res.json(verificationData);
  } catch (error) {
    logger.error('Batch verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar el lote',
      code: 'VERIFICATION_ERROR',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify certificate authenticity
 * PUBLIC - No authentication required
 */
router.get('/certificate/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.certification.findUnique({
      where: { id },
      include: {
        producer: {
          select: {
            businessName: true,
            state: true,
            municipality: true,
          },
        },
      },
    });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificado no encontrado / Certificate not found',
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }

    const isValid = certificate.isActive && new Date(certificate.expiresAt) > new Date();

    const verificationData = {
      success: true,
      certificate: {
        id: certificate.id,
        type: certificate.type,
        certifier: certificate.certifier,
        number: certificate.certificateNumber,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        isActive: certificate.isActive,
        isValid,
      },
      producer: {
        name: certificate.producer.businessName,
        location: `${certificate.producer.municipality}, ${certificate.producer.state}`,
      },
      blockchain: {
        verified: !!certificate.ipfsHash,
        ipfsHash: certificate.ipfsHash,
        ipfsUrl: certificate.ipfsHash
          ? `https://ipfs.io/ipfs/${certificate.ipfsHash}`
          : null,
      },
      verification: {
        isAuthentic: isValid && !!certificate.ipfsHash,
        status: isValid ? 'VALID' : 'EXPIRED',
        message: isValid
          ? 'Este certificado es válido y verificable.'
          : 'Este certificado ha expirado o no está activo.',
        verifiedAt: new Date().toISOString(),
      },
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateCertificateVerificationHTML(verificationData));
    }

    res.json(verificationData);
  } catch (error) {
    logger.error('Certificate verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar el certificado',
      code: 'VERIFICATION_ERROR',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify traceability event
 * PUBLIC - No authentication required
 */
router.get('/event/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.traceabilityEvent.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            id: true,
            variety: true,
            origin: true,
            blockchainHash: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento no encontrado / Event not found',
        code: 'EVENT_NOT_FOUND',
      });
    }

    const verificationData = {
      success: true,
      event: {
        id: event.id,
        type: event.eventType,
        timestamp: event.timestamp,
        location: {
          name: event.locationName,
          coordinates: {
            lat: Number(event.latitude),
            lng: Number(event.longitude),
          },
        },
        conditions: {
          temperature: event.temperature ? Number(event.temperature) : null,
          humidity: event.humidity ? Number(event.humidity) : null,
        },
        notes: event.notes,
        photoCount: event.photos?.length || 0,
        recordedBy: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
        signedByBiometric: event.signedByBiometric,
      },
      batch: event.batch,
      blockchain: {
        verified: event.isVerified,
        txHash: event.blockchainTxHash,
        eventId: event.blockchainEventId,
        explorerUrl: event.blockchainTxHash
          ? `${BLOCKCHAIN_CONFIG.explorerUrl}/tx/${event.blockchainTxHash}`
          : null,
        ipfsHash: event.ipfsHash,
      },
      verification: {
        isAuthentic: event.isVerified && !!event.blockchainTxHash,
        message: event.isVerified
          ? 'Este evento ha sido verificado en blockchain.'
          : 'Este evento aún no ha sido verificado en blockchain.',
        verifiedAt: new Date().toISOString(),
      },
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateEventVerificationHTML(verificationData));
    }

    res.json(verificationData);
  } catch (error) {
    logger.error('Event verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar el evento',
      code: 'VERIFICATION_ERROR',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify invoice integrity via blockchain
 * PUBLIC - No authentication required
 * P1 FIX: Now using VerifyInvoiceUseCase for clean architecture
 */
router.get('/invoice/:uuid', async (req: Request, res: Response) => {
  try {
    const { uuid } = req.params;

    // Use the use case instead of direct Prisma access
    const result = await verifyInvoiceUseCase.execute({ uuid });

    const verificationData = {
      success: true,
      invoice: result.invoice,
      producer: result.producer,
      blockchain: {
        ...result.blockchain,
        explorerUrl: result.blockchain.txHash
          ? `${BLOCKCHAIN_CONFIG.explorerUrl}/tx/${result.blockchain.txHash}`
          : null,
      },
      verification: result.verification,
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateInvoiceVerificationHTML(verificationData));
    }

    res.json(verificationData);
  } catch (error: any) {
    // Handle NotFoundError from use case
    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada / Invoice not found',
        code: 'INVOICE_NOT_FOUND',
      });
    }

    logger.error('Invoice verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar la factura',
      code: 'VERIFICATION_ERROR',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFERRAL VERIFICATION (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify referral on blockchain
 * PUBLIC - No authentication required
 * P1 FIX: Now using VerifyReferralUseCase for clean architecture
 */
router.get('/referral/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use the use case instead of direct Prisma access
    const result = await verifyReferralUseCase.execute({ referralId: id });

    const verificationData = {
      success: true,
      referral: result.referral,
      blockchain: {
        ...result.blockchain,
        explorerUrl: result.blockchain.txHash
          ? `${BLOCKCHAIN_CONFIG.explorerUrl}/tx/${result.blockchain.txHash}`
          : null,
      },
      referrer: result.referrer,
      verification: result.verification,
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateReferralVerificationHTML(verificationData));
    }

    res.json(verificationData);
  } catch (error: any) {
    // Handle NotFoundError from use case
    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        error: 'Referido no encontrado / Referral not found',
        code: 'REFERRAL_NOT_FOUND',
      });
    }

    logger.error('Referral verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar el referido',
      code: 'VERIFICATION_ERROR',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC LEADERBOARD (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get public referral leaderboard
 * PUBLIC - Anyone can verify counts by checking blockchain
 */
router.get('/leaderboard/:month/:year', async (req: Request, res: Response) => {
  try {
    const { month, year } = req.params;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Formato de fecha inválido',
        code: 'INVALID_DATE',
      });
    }

    const monthYear = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    // Get leaderboard data
    const leaderboard = await prisma.referralLeaderboard.findMany({
      where: { monthYear },
      orderBy: { rank: 'asc' },
      take: 50,
    });

    // If no cached leaderboard, calculate from referral codes
    let entries = leaderboard.map((entry) => ({
      rank: entry.rank,
      name: entry.userName,
      avatar: entry.userAvatar,
      activeReferrals: entry.activeReferrals,
      completedReferrals: entry.completedReferrals,
      totalPoints: entry.totalPoints,
      blockchainVerified: entry.blockchainVerified,
      walletAddress: entry.walletAddress,
      blockchainProof: entry.walletAddress
        ? `${BLOCKCHAIN_CONFIG.explorerUrl}/address/${entry.walletAddress}`
        : null,
    }));

    if (entries.length === 0) {
      // Calculate on-the-fly
      const codes = await prisma.userReferralCode.findMany({
        where: { activeReferrals: { gt: 0 } },
        orderBy: { activeReferrals: 'desc' },
        take: 50,
      });

      entries = await Promise.all(
        codes.map(async (code, index) => {
          const user = await prisma.user.findUnique({
            where: { id: code.userId },
            select: { firstName: true, lastName: true },
          });

          return {
            rank: index + 1,
            name: user ? `${user.firstName} ${user.lastName.charAt(0)}.` : 'Anonymous',
            avatar: null,
            activeReferrals: code.activeReferrals,
            completedReferrals: code.completedReferrals,
            totalPoints: code.activeReferrals * 100 + code.completedReferrals * 50,
            blockchainVerified: !!code.walletAddress,
            walletAddress: code.walletAddress,
            blockchainProof: code.walletAddress
              ? `${BLOCKCHAIN_CONFIG.explorerUrl}/address/${code.walletAddress}`
              : null,
          };
        })
      );
    }

    const response = {
      success: true,
      month: monthNum,
      year: yearNum,
      monthYear,
      leaderboard: entries,
      meta: {
        totalEntries: entries.length,
        verifiable: true,
        blockchainNetwork: 'Polygon',
        note: 'All counts can be independently verified on-chain',
      },
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(generateLeaderboardHTML(response));
    }

    res.json(response);
  } catch (error) {
    logger.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el leaderboard',
      code: 'LEADERBOARD_ERROR',
    });
  }
});

/**
 * Get current month leaderboard (convenience endpoint)
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  const now = new Date();
  res.redirect(`/verify/leaderboard/${now.getMonth() + 1}/${now.getFullYear()}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTML TEMPLATE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

function generateBatchVerificationHTML(data: any): string {
  const batch = data.batch;
  const producer = data.producer;
  const blockchain = data.blockchain;
  const timeline = data.timeline;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación Blockchain - Lote #${batch.id.substring(0, 8)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 24px;
      margin-bottom: 20px;
      transition: transform 0.2s;
    }
    .card:hover { transform: translateY(-2px); }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      margin-bottom: 24px;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 14px;
      margin-bottom: 16px;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; color: #1f2937; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat {
      background: #f9fafb;
      padding: 16px;
      border-radius: 12px;
      border-left: 4px solid #10b981;
    }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 18px; font-weight: 600; color: #1f2937; margin-top: 4px; }
    .timeline { position: relative; padding-left: 24px; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e5e7eb;
    }
    .timeline-item {
      position: relative;
      padding-bottom: 20px;
    }
    .timeline-item::before {
      content: '✓';
      position: absolute;
      left: -24px;
      width: 18px;
      height: 18px;
      background: #10b981;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
    }
    .timeline-item.unverified::before {
      background: #6b7280;
      content: '○';
    }
    .cert-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 500;
      margin: 4px 4px 4px 0;
    }
    .blockchain-box {
      background: #f0fdf4;
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
    }
    .hash {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      word-break: break-all;
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      margin: 8px 0;
    }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 14px;
    }
    .footer a { color: #10b981; font-weight: 500; }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
      h1 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="verified-badge">
        <span>🔐</span>
        <span>${blockchain.verified ? 'VERIFICADO EN BLOCKCHAIN' : 'PENDIENTE DE VERIFICACIÓN'}</span>
      </div>
      <h1>Verificación de Lote</h1>
      <p>ID: ${batch.id}</p>
    </div>

    <div class="card">
      <h2>📦 Información del Lote</h2>
      <div class="grid">
        <div class="stat">
          <div class="stat-label">Producto</div>
          <div class="stat-value">${batch.product}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Origen</div>
          <div class="stat-value">${batch.origin}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Peso</div>
          <div class="stat-value">${batch.weightKg.toLocaleString()} kg</div>
        </div>
        <div class="stat">
          <div class="stat-label">Fecha de Cosecha</div>
          <div class="stat-value">${new Date(batch.harvestDate).toLocaleDateString('es-MX')}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Estado</div>
          <div class="stat-value">${batch.status}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🏢 Productor</h2>
      <div class="stat" style="margin-bottom: 16px;">
        <div class="stat-label">Nombre</div>
        <div class="stat-value">${producer.name}</div>
      </div>
      <div class="stat" style="margin-bottom: 16px;">
        <div class="stat-label">Ubicación</div>
        <div class="stat-value">${producer.location}</div>
      </div>
      ${producer.certifications.length > 0 ? `
      <div>
        <div class="stat-label" style="margin-bottom: 8px;">Certificaciones</div>
        ${producer.certifications.map((cert: any) => `
          <span class="cert-badge">${cert.type} ${cert.valid ? '✓' : '(Expirado)'}</span>
        `).join('')}
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>⛓️ Prueba Blockchain</h2>
      <div class="blockchain-box">
        <p><strong>Red:</strong> ${blockchain.network}</p>
        ${blockchain.hash ? `
        <p><strong>Transaction Hash:</strong></p>
        <div class="hash">${blockchain.hash}</div>
        <p><a href="${blockchain.explorerUrl}" target="_blank" rel="noopener">🔗 Ver en explorador de blockchain →</a></p>
        ` : `
        <p style="color: #6b7280;">Este lote aún no ha sido registrado en blockchain.</p>
        `}
      </div>
    </div>

    ${timeline.length > 0 ? `
    <div class="card">
      <h2>📍 Línea de Tiempo</h2>
      <div class="timeline">
        ${timeline.map((event: any) => `
          <div class="timeline-item ${event.verified ? '' : 'unverified'}">
            <strong>${event.type}</strong><br>
            <small style="color: #6b7280;">${event.location} • ${new Date(event.timestamp).toLocaleString('es-MX')}</small>
            ${event.conditions.temperature ? `<br><small>🌡️ ${event.conditions.temperature}°C</small>` : ''}
            ${event.verified ? '<span class="cert-badge" style="background: #d1fae5; color: #065f46;">Verificado ✓</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="card" style="background: #f9fafb; border: 1px solid #e5e7eb;">
      <h2>🔍 ¿Qué significa esto?</h2>
      <p style="color: #4b5563; line-height: 1.6;">
        Esta información está registrada en la blockchain de <strong>${blockchain.network}</strong>,
        una base de datos pública y descentralizada. Una vez registrado, el contenido
        <strong>NO puede ser modificado ni borrado</strong> por nadie, ni siquiera por AgroBridge.
      </p>
      <p style="color: #4b5563; line-height: 1.6; margin-top: 12px;">
        Esto garantiza que la información de origen, calidad y trazabilidad de este producto
        agrícola es auténtica y puede ser verificada independientemente por cualquier comprador,
        auditor o autoridad.
      </p>
    </div>

    <div class="footer">
      <p>Powered by <a href="https://agrobridge.io" target="_blank"><strong>AgroBridge</strong></a></p>
      <p>Blockchain: ${blockchain.network} • Verificado: ${new Date().toLocaleString('es-MX')}</p>
    </div>
  </div>
</body>
</html>`;
}

function generateCertificateVerificationHTML(data: any): string {
  const cert = data.certificate;
  const producer = data.producer;
  const blockchain = data.blockchain;
  const verification = data.verification;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación de Certificado - ${cert.type}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 32px;
      text-align: center;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      margin: 0 auto 20px;
    }
    .valid { background: #d1fae5; }
    .invalid { background: #fee2e2; }
    h1 { color: #1f2937; margin-bottom: 8px; }
    .cert-type {
      display: inline-block;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 8px 16px;
      border-radius: 100px;
      font-weight: 500;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; color: #1f2937; }
    .footer { margin-top: 24px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="status-icon ${verification.status === 'VALID' ? 'valid' : 'invalid'}">
        ${verification.status === 'VALID' ? '✓' : '✗'}
      </div>
      <h1>Certificado ${verification.status === 'VALID' ? 'Válido' : 'Expirado'}</h1>
      <div class="cert-type">${cert.type}</div>

      <div style="text-align: left; margin-top: 24px;">
        <div class="info-row">
          <span class="info-label">Emisor</span>
          <span class="info-value">${cert.certifier}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Número</span>
          <span class="info-value">${cert.number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Productor</span>
          <span class="info-value">${producer.name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ubicación</span>
          <span class="info-value">${producer.location}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Emitido</span>
          <span class="info-value">${new Date(cert.issuedAt).toLocaleDateString('es-MX')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Expira</span>
          <span class="info-value">${new Date(cert.expiresAt).toLocaleDateString('es-MX')}</span>
        </div>
        ${blockchain.verified ? `
        <div class="info-row">
          <span class="info-label">IPFS Hash</span>
          <span class="info-value" style="font-size: 10px; word-break: break-all;">${blockchain.ipfsHash}</span>
        </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Powered by <strong>AgroBridge</strong></p>
        <p>Verificado: ${new Date().toLocaleString('es-MX')}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateEventVerificationHTML(data: any): string {
  const event = data.event;
  const batch = data.batch;
  const blockchain = data.blockchain;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación de Evento - ${event.type}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 24px;
      margin-bottom: 20px;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .verified { color: #10b981; }
    .unverified { color: #6b7280; }
    h1 { font-size: 24px; color: #1f2937; }
    .event-type {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 500;
      margin: 12px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .info-box {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
    }
    .info-label { font-size: 12px; color: #6b7280; }
    .info-value { font-size: 16px; font-weight: 500; color: #1f2937; margin-top: 4px; }
    .hash-box {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
      margin-top: 8px;
    }
    a { color: #3b82f6; }
    .footer { text-align: center; margin-top: 24px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <span class="${blockchain.verified ? 'verified' : 'unverified'}" style="font-size: 48px;">
          ${blockchain.verified ? '✓' : '○'}
        </span>
        <h1>${blockchain.verified ? 'Evento Verificado' : 'Evento Pendiente'}</h1>
        <div class="event-type">${event.type}</div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">Fecha y Hora</div>
          <div class="info-value">${new Date(event.timestamp).toLocaleString('es-MX')}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Ubicación</div>
          <div class="info-value">${event.location.name || 'No especificada'}</div>
        </div>
        ${event.conditions.temperature ? `
        <div class="info-box">
          <div class="info-label">Temperatura</div>
          <div class="info-value">${event.conditions.temperature}°C</div>
        </div>
        ` : ''}
        ${event.conditions.humidity ? `
        <div class="info-box">
          <div class="info-label">Humedad</div>
          <div class="info-value">${event.conditions.humidity}%</div>
        </div>
        ` : ''}
        <div class="info-box">
          <div class="info-label">Registrado por</div>
          <div class="info-value">${event.recordedBy}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Firma Biométrica</div>
          <div class="info-value">${event.signedByBiometric ? 'Sí ✓' : 'No'}</div>
        </div>
      </div>

      ${blockchain.txHash ? `
      <div style="margin-top: 24px;">
        <div class="info-label">Transaction Hash</div>
        <div class="hash-box">${blockchain.txHash}</div>
        <p style="margin-top: 8px;">
          <a href="${blockchain.explorerUrl}" target="_blank">🔗 Ver en blockchain →</a>
        </p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Lote: ${batch.id}</p>
        <p>Powered by <strong>AgroBridge</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateReferralVerificationHTML(data: any): string {
  const referral = data.referral;
  const blockchain = data.blockchain;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación de Referido - AgroBridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 32px;
      text-align: center;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      margin: 0 auto 20px;
      background: ${blockchain.verified ? '#d1fae5' : '#fef3c7'};
    }
    h1 { color: #1f2937; margin-bottom: 8px; }
    .code-badge {
      display: inline-block;
      background: #e0e7ff;
      color: #4338ca;
      padding: 8px 20px;
      border-radius: 100px;
      font-weight: 600;
      font-size: 18px;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; color: #1f2937; }
    .blockchain-box {
      margin-top: 20px;
      padding: 16px;
      background: ${blockchain.verified ? '#f0fdf4' : '#fefce8'};
      border-radius: 12px;
      border: 2px solid ${blockchain.verified ? '#10b981' : '#fbbf24'};
    }
    a { color: #3b82f6; }
    .footer { margin-top: 24px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="status-icon">
        ${blockchain.verified ? '✓' : '⏳'}
      </div>
      <h1>Referido ${blockchain.verified ? 'Verificado' : 'Pendiente'}</h1>
      <div class="code-badge">${referral.code}</div>

      <div style="text-align: left; margin-top: 24px;">
        <div class="info-row">
          <span class="info-label">Estado</span>
          <span class="info-value">${referral.status}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Puntuación de Actividad</span>
          <span class="info-value">${referral.activityScore} puntos</span>
        </div>
        <div class="info-row">
          <span class="info-label">Registrado</span>
          <span class="info-value">${new Date(referral.createdAt).toLocaleDateString('es-MX')}</span>
        </div>
        ${referral.completedAt ? `
        <div class="info-row">
          <span class="info-label">Completado</span>
          <span class="info-value">${new Date(referral.completedAt).toLocaleDateString('es-MX')}</span>
        </div>
        ` : ''}
      </div>

      <div class="blockchain-box">
        <strong>${blockchain.verified ? '🔐 Verificado en Blockchain' : '⏳ Pendiente de Verificación'}</strong>
        ${blockchain.txHash ? `
        <p style="margin-top: 8px; font-size: 12px; word-break: break-all;">
          TX: ${blockchain.txHash}
        </p>
        <p style="margin-top: 8px;">
          <a href="${blockchain.explorerUrl}" target="_blank">Ver en blockchain →</a>
        </p>
        ` : ''}
      </div>

      <div class="footer">
        <p>Powered by <strong>AgroBridge</strong></p>
        <p>Verificado: ${new Date().toLocaleString('es-MX')}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateLeaderboardHTML(data: any): string {
  const { month, year, leaderboard, meta } = data;
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leaderboard de Referidos - ${monthNames[month - 1]} ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 32px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .leaderboard-row {
      display: flex;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      transition: background 0.2s;
    }
    .leaderboard-row:hover { background: #f9fafb; }
    .rank {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 16px;
    }
    .rank-1 { background: linear-gradient(135deg, #ffd700, #ffec8b); color: #92400e; }
    .rank-2 { background: linear-gradient(135deg, #c0c0c0, #e5e5e5); color: #374151; }
    .rank-3 { background: linear-gradient(135deg, #cd7f32, #daa520); color: white; }
    .rank-other { background: #f3f4f6; color: #6b7280; }
    .user-info { flex: 1; }
    .user-name { font-weight: 600; color: #1f2937; }
    .user-stats { font-size: 14px; color: #6b7280; }
    .points {
      font-size: 20px;
      font-weight: bold;
      color: #7c3aed;
    }
    .verified-badge {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 12px;
      margin-left: 8px;
    }
    .footer {
      padding: 16px 24px;
      background: #f9fafb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .footer a { color: #7c3aed; }
    .empty-state {
      padding: 60px 24px;
      text-align: center;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏆 Leaderboard de Referidos</h1>
      <p>${monthNames[month - 1]} ${year}</p>
    </div>

    <div class="card">
      ${leaderboard.length > 0 ? leaderboard.map((entry: any, index: number) => `
        <div class="leaderboard-row">
          <div class="rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">
            ${entry.rank}
          </div>
          <div class="user-info">
            <div class="user-name">
              ${entry.name}
              ${entry.blockchainVerified ? '<span class="verified-badge">✓ On-chain</span>' : ''}
            </div>
            <div class="user-stats">
              ${entry.activeReferrals} referidos activos • ${entry.completedReferrals} completados
            </div>
          </div>
          <div class="points">${entry.totalPoints}</div>
        </div>
      `).join('') : `
        <div class="empty-state">
          <p style="font-size: 48px; margin-bottom: 16px;">📭</p>
          <p>No hay datos de referidos para este mes</p>
        </div>
      `}

      <div class="footer">
        <p>Todos los datos son verificables en <strong>${meta.blockchainNetwork}</strong></p>
        <p style="margin-top: 8px;">
          Powered by <a href="https://agrobridge.io" target="_blank"><strong>AgroBridge</strong></a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateInvoiceVerificationHTML(data: any): string {
  const invoice = data.invoice;
  const producer = data.producer;
  const blockchain = data.blockchain;
  const verification = data.verification;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación de Factura - ${invoice.folio}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 32px;
      margin-bottom: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      margin: 0 auto 20px;
      background: ${verification.isAuthentic ? '#d1fae5' : '#fef3c7'};
    }
    h1 { color: #1f2937; margin-bottom: 8px; }
    .folio-badge {
      display: inline-block;
      background: #e0e7ff;
      color: #4338ca;
      padding: 8px 20px;
      border-radius: 100px;
      font-weight: 600;
      font-size: 14px;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; color: #1f2937; text-align: right; }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 16px 0;
      font-size: 20px;
      font-weight: bold;
    }
    .total-label { color: #1f2937; }
    .total-value { color: #10b981; }
    .blockchain-box {
      margin-top: 20px;
      padding: 16px;
      background: ${blockchain.verified ? '#f0fdf4' : '#fefce8'};
      border-radius: 12px;
      border: 2px solid ${blockchain.verified ? '#10b981' : '#fbbf24'};
    }
    .hash {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      word-break: break-all;
      background: #f3f4f6;
      padding: 8px;
      border-radius: 6px;
      margin: 8px 0;
    }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 24px; color: #6b7280; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="status-icon">
          ${verification.isAuthentic ? '✓' : '⏳'}
        </div>
        <h1>Factura ${verification.isAuthentic ? 'Verificada' : 'Pendiente'}</h1>
        <div class="folio-badge">${invoice.folio}</div>
      </div>

      <div class="info-row">
        <span class="info-label">UUID Fiscal</span>
        <span class="info-value" style="font-size: 10px; max-width: 60%; word-break: break-all;">${invoice.uuid}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Estado</span>
        <span class="info-value">${invoice.status}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cliente</span>
        <span class="info-value">${invoice.recipientName}</span>
      </div>
      ${producer ? `
      <div class="info-row">
        <span class="info-label">Emisor</span>
        <span class="info-value">${producer.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Ubicación</span>
        <span class="info-value">${producer.location}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Fecha de Emisión</span>
        <span class="info-value">${invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('es-MX') : 'N/A'}</span>
      </div>

      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">$${invoice.total.toLocaleString('es-MX')} ${invoice.currency}</span>
      </div>

      <div class="blockchain-box">
        <strong>${blockchain.verified ? '⛓️ Verificada en Blockchain' : '⏳ Pendiente de Registro'}</strong>
        ${blockchain.hash ? `
        <p style="margin-top: 8px; font-size: 12px;">Hash:</p>
        <div class="hash">${blockchain.hash}</div>
        ` : ''}
        ${blockchain.txHash ? `
        <p style="margin-top: 8px;">
          <a href="${blockchain.explorerUrl}" target="_blank">🔗 Ver transacción en ${blockchain.network} →</a>
        </p>
        ` : ''}
      </div>

      <div class="footer">
        <p style="margin-bottom: 8px;">${verification.message}</p>
        <p>Verificado: ${verification.verifiedAt}</p>
        <p style="margin-top: 12px;">Powered by <strong>AgroBridge</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default router;
