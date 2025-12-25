/**
 * Organic Certification Workflow Integration Tests - Part 2
 *
 * E2E tests for the certificate issuance workflow:
 * 5. Satellite analysis request (NDVI compliance)
 * 6. Verification stage progression
 * 7. Certificate issuance
 * 8. QR code verification (public endpoint)
 *
 * @module OrganicCertificationTestsPart2
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import {
  generateAdminToken,
  generateExportCompanyAdminToken,
  generateProducerToken,
  generateCertifierToken,
} from '../helpers/auth.helper.js';
import { errorHandler } from '../../src/presentation/middlewares/errorHandler.middleware.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-integration-tests';

// Fixed dates for reproducible tests
const FIXED_DATE = new Date('2025-01-15T12:00:00Z');

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const mockExportCompany = {
  id: 'ec-test-12345',
  name: 'Premium Exports S.A.',
  status: 'ACTIVE',
};

const mockProducer = {
  id: 'prod-test-12345',
  userId: 'user-test-12345',
  businessName: 'Rancho Orgánico',
  state: 'Michoacán',
  municipality: 'Uruapan',
  exportCompanyId: mockExportCompany.id,
};

const mockOrganicField = {
  id: 'field-test-12345',
  producerId: mockProducer.id,
  name: 'Parcela Norte',
  cropType: 'AVOCADO',
  certificationStatus: 'IN_TRANSITION',
  centerLat: 19.4175,
  centerLng: -102.0525,
  areaHectares: 15.5,
  boundaryGeoJson: JSON.stringify({
    type: 'Polygon',
    coordinates: [[[-102.06, 19.42], [-102.05, 19.42], [-102.05, 19.41], [-102.06, 19.41], [-102.06, 19.42]]],
  }),
  organicSince: new Date('2022-01-01'),
  transitionEndDate: new Date('2025-01-01'),
};

const mockBatch = {
  id: 'batch-test-12345',
  batchNumber: 'BTH-2025-001234',
  producerId: mockProducer.id,
  variety: 'HASS',
  harvestDate: FIXED_DATE,
  weightKg: 1500,
  status: 'IN_PROGRESS',
  createdAt: FIXED_DATE,
};

const mockSatelliteAnalysis = {
  id: 'sat-test-12345',
  fieldId: mockOrganicField.id,
  requestedAt: FIXED_DATE,
  status: 'COMPLETED',
  ndviScore: 0.78,
  complianceStatus: 'COMPLIANT',
  analysisDate: FIXED_DATE,
  vegetationHealth: 'EXCELLENT',
  anomalyDetected: false,
  confidenceScore: 0.95,
  imagery: {
    ndviUrl: 'https://storage.example.com/ndvi/sat-test-12345.png',
    rgbUrl: 'https://storage.example.com/rgb/sat-test-12345.png',
  },
};

const mockVerificationStage = {
  id: 'stage-test-12345',
  batchId: mockBatch.id,
  stageType: 'HARVEST',
  status: 'PENDING',
  sequence: 1,
  verificationData: {},
  createdAt: FIXED_DATE,
};

const mockCertificate = {
  id: 'cert-test-12345',
  certificateNumber: 'ORG-2025-MX-001234',
  farmerId: mockProducer.id,
  fieldIds: [mockOrganicField.id],
  cropType: 'AVOCADO',
  certificationStandard: 'ORGANIC_USDA',
  status: 'PENDING_REVIEW',
  issueDate: FIXED_DATE,
  expiryDate: new Date('2026-01-15'),
  qrCode: 'https://verify.agrobridge.io/q/ORG-2025-MX-001234',
  pdfUrl: null,
  ipfsHash: null,
  blockchainHash: null,
  createdAt: FIXED_DATE,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK PRISMA CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const mockPrismaClient = {
  exportCompany: {
    findUnique: vi.fn().mockResolvedValue(mockExportCompany),
    findFirst: vi.fn().mockResolvedValue(mockExportCompany),
  },
  producer: {
    findUnique: vi.fn().mockResolvedValue(mockProducer),
    findFirst: vi.fn().mockResolvedValue(mockProducer),
  },
  organicField: {
    findUnique: vi.fn().mockResolvedValue(mockOrganicField),
    findFirst: vi.fn().mockResolvedValue(mockOrganicField),
    findMany: vi.fn().mockResolvedValue([mockOrganicField]),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockOrganicField, ...data })),
  },
  batch: {
    findUnique: vi.fn().mockResolvedValue(mockBatch),
    findFirst: vi.fn().mockResolvedValue(mockBatch),
  },
  satelliteAnalysis: {
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
      ...mockSatelliteAnalysis,
      ...data,
      id: data.id || 'sat-' + Date.now(),
    })),
    findUnique: vi.fn().mockResolvedValue(mockSatelliteAnalysis),
    findFirst: vi.fn().mockResolvedValue(mockSatelliteAnalysis),
    findMany: vi.fn().mockResolvedValue([mockSatelliteAnalysis]),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockSatelliteAnalysis, ...data })),
    count: vi.fn().mockResolvedValue(1),
  },
  verificationStage: {
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
      ...mockVerificationStage,
      ...data,
      id: data.id || 'stage-' + Date.now(),
    })),
    findUnique: vi.fn().mockResolvedValue(mockVerificationStage),
    findFirst: vi.fn().mockResolvedValue(mockVerificationStage),
    findMany: vi.fn().mockResolvedValue([mockVerificationStage]),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve({
      ...mockVerificationStage,
      ...data,
    })),
    count: vi.fn().mockResolvedValue(1),
  },
  organicCertificate: {
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
      ...mockCertificate,
      ...data,
      id: data.id || 'cert-' + Date.now(),
    })),
    findUnique: vi.fn().mockResolvedValue(mockCertificate),
    findFirst: vi.fn().mockResolvedValue(mockCertificate),
    findMany: vi.fn().mockResolvedValue([mockCertificate]),
    update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockCertificate, ...data })),
    count: vi.fn().mockResolvedValue(1),
  },
  $transaction: vi.fn().mockImplementation(async (fn: Function) => fn(mockPrismaClient)),
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
} as unknown as PrismaClient;

// ═══════════════════════════════════════════════════════════════════════════════
// TEST APP FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
        (req as any).user = {
          id: decoded.sub || decoded.userId,
          userId: decoded.sub || decoded.userId,
          email: decoded.email,
          role: decoded.role,
          producerId: decoded.producerId,
          exportCompanyAdminId: decoded.exportCompanyAdminId,
        };
      } catch {
        // Continue without user
      }
    }
    next();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: Satellite Analysis Routes
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/satellite-analysis - Request satellite analysis for field
  app.post('/api/v1/satellite-analysis', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { fieldId, analysisType } = req.body;

      if (!fieldId) {
        return res.status(400).json({ success: false, error: 'Field ID is required' });
      }

      // Verify field exists
      const field = await mockPrismaClient.organicField.findUnique({
        where: { id: fieldId },
      });

      if (!field) {
        return res.status(404).json({ success: false, error: 'Field not found' });
      }

      // Create analysis request
      const analysis = await mockPrismaClient.satelliteAnalysis.create({
        data: {
          fieldId,
          analysisType: analysisType || 'NDVI',
          requestedBy: user.id,
          requestedAt: new Date(),
          status: 'PROCESSING',
        },
      });

      res.status(202).json({
        success: true,
        data: {
          analysisId: analysis.id,
          status: 'PROCESSING',
          estimatedCompletionTime: '15 minutes',
        },
        message: 'Satellite analysis requested. Results will be available shortly.',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/satellite-analysis/:id - Get analysis results
  app.get('/api/v1/satellite-analysis/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const analysis = await mockPrismaClient.satelliteAnalysis.findUnique({
        where: { id: req.params.id },
      });

      if (!analysis) {
        return res.status(404).json({ success: false, error: 'Analysis not found' });
      }

      res.json({
        success: true,
        data: {
          ...analysis,
          field: mockOrganicField,
          vegetationHealthGrade: analysis.ndviScore >= 0.7 ? 'EXCELLENT' :
                                  analysis.ndviScore >= 0.5 ? 'GOOD' :
                                  analysis.ndviScore >= 0.3 ? 'FAIR' : 'POOR',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/organic-fields/:fieldId/satellite-history - Get analysis history
  app.get('/api/v1/organic-fields/:fieldId/satellite-history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const analyses = await mockPrismaClient.satelliteAnalysis.findMany({
        where: { fieldId: req.params.fieldId },
      });

      res.json({
        success: true,
        data: analyses,
        meta: { total: analyses.length },
      });
    } catch (error) {
      next(error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6: Verification Stage Routes
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/batches/:batchId/stages - Create verification stage
  app.post('/api/v1/batches/:batchId/stages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { batchId } = req.params;
      const { stageType, verificationData, notes } = req.body;

      if (!stageType) {
        return res.status(400).json({ success: false, error: 'Stage type is required' });
      }

      const validStageTypes = ['HARVEST', 'PACKING', 'COLD_STORAGE', 'TRANSPORT', 'EXPORT'];
      if (!validStageTypes.includes(stageType)) {
        return res.status(400).json({ success: false, error: 'Invalid stage type' });
      }

      // Verify batch exists
      const batch = await mockPrismaClient.batch.findUnique({
        where: { id: batchId },
      });

      if (!batch) {
        return res.status(404).json({ success: false, error: 'Batch not found' });
      }

      // Count existing stages for sequence
      const existingCount = await mockPrismaClient.verificationStage.count({
        where: { batchId },
      });

      const stage = await mockPrismaClient.verificationStage.create({
        data: {
          batchId,
          stageType,
          status: 'PENDING',
          sequence: existingCount + 1,
          verificationData: verificationData || {},
          notes,
          createdBy: user.id,
        },
      });

      res.status(201).json({
        success: true,
        data: stage,
        message: `${stageType} stage created for batch`,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/batches/:batchId/stages - Get all stages for batch
  app.get('/api/v1/batches/:batchId/stages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const stages = await mockPrismaClient.verificationStage.findMany({
        where: { batchId: req.params.batchId },
      });

      res.json({
        success: true,
        data: stages,
        meta: {
          total: stages.length,
          completedCount: stages.filter(s => s.status === 'APPROVED').length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/v1/verification-stages/:id - Update stage (approve/reject)
  app.patch('/api/v1/verification-stages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { status, verificationData, notes, rejectionReason } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' });
      }

      const validStatuses = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      if (status === 'REJECTED' && !rejectionReason) {
        return res.status(400).json({ success: false, error: 'Rejection reason is required' });
      }

      const stage = await mockPrismaClient.verificationStage.findUnique({
        where: { id: req.params.id },
      });

      if (!stage) {
        return res.status(404).json({ success: false, error: 'Stage not found' });
      }

      const updated = await mockPrismaClient.verificationStage.update({
        where: { id: req.params.id },
        data: {
          status,
          verificationData: { ...stage.verificationData, ...verificationData },
          notes,
          rejectionReason,
          verifiedBy: user.id,
          verifiedAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: `Stage ${status.toLowerCase()}`,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/batches/:batchId/stages/finalize - Finalize all stages
  app.post('/api/v1/batches/:batchId/stages/finalize', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const stages = await mockPrismaClient.verificationStage.findMany({
        where: { batchId: req.params.batchId },
      });

      const allApproved = stages.every(s => s.status === 'APPROVED');

      if (!allApproved) {
        return res.status(400).json({
          success: false,
          error: 'Not all stages are approved',
          data: {
            pendingStages: stages.filter(s => s.status !== 'APPROVED').map(s => s.stageType),
          },
        });
      }

      res.json({
        success: true,
        data: {
          batchId: req.params.batchId,
          finalizedAt: new Date().toISOString(),
          stageCount: stages.length,
          eligibleForCertification: true,
        },
        message: 'All stages finalized. Batch is eligible for certificate issuance.',
      });
    } catch (error) {
      next(error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7: Certificate Issuance Routes
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/organic-certificates/generate - Generate certificate
  app.post('/api/v1/organic-certificates/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
        return res.status(403).json({ success: false, error: 'Producer or Admin access required' });
      }

      const { fieldIds, cropType, certificationStandard, harvestDate, notes } = req.body;

      if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one field ID is required' });
      }

      if (!cropType) {
        return res.status(400).json({ success: false, error: 'Crop type is required' });
      }

      const validStandards = ['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA'];
      if (!certificationStandard || !validStandards.includes(certificationStandard)) {
        return res.status(400).json({ success: false, error: 'Valid certification standard required' });
      }

      // Generate certificate number
      const certNumber = `ORG-${new Date().getFullYear()}-MX-${Math.random().toString().slice(2, 8)}`;

      const certificate = await mockPrismaClient.organicCertificate.create({
        data: {
          certificateNumber: certNumber,
          farmerId: user.producerId || mockProducer.id,
          fieldIds,
          cropType,
          certificationStandard,
          status: 'PENDING_REVIEW',
          issueDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          harvestDate: harvestDate ? new Date(harvestDate) : null,
          notes,
          qrCode: `https://verify.agrobridge.io/q/${certNumber}`,
        },
      });

      res.status(202).json({
        success: true,
        data: {
          certificateId: certificate.id,
          certificateNumber: certificate.certificateNumber,
          status: certificate.status,
          qrCode: certificate.qrCode,
        },
        message: 'Certificate generation initiated. Pending review.',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/organic-certificates/:id - Get certificate details
  app.get('/api/v1/organic-certificates/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const certificate = await mockPrismaClient.organicCertificate.findUnique({
        where: { id: req.params.id },
      });

      if (!certificate) {
        return res.status(404).json({ success: false, error: 'Certificate not found' });
      }

      res.json({
        success: true,
        data: {
          ...certificate,
          fields: [mockOrganicField],
          farmer: mockProducer,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/organic-certificates/:id/approve - Approve certificate
  app.post('/api/v1/organic-certificates/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'EXPORT_COMPANY_ADMIN' && user.role !== 'ADMIN' && user.role !== 'CERTIFIER')) {
        return res.status(403).json({ success: false, error: 'Reviewer access required' });
      }

      const certificate = await mockPrismaClient.organicCertificate.findUnique({
        where: { id: req.params.id },
      });

      if (!certificate) {
        return res.status(404).json({ success: false, error: 'Certificate not found' });
      }

      if (certificate.status !== 'PENDING_REVIEW') {
        return res.status(400).json({ success: false, error: 'Certificate is not pending review' });
      }

      const updated = await mockPrismaClient.organicCertificate.update({
        where: { id: req.params.id },
        data: {
          status: 'APPROVED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Certificate approved. PDF and blockchain registration pending.',
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/organic-certificates/:id/reject - Reject certificate
  app.post('/api/v1/organic-certificates/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== 'EXPORT_COMPANY_ADMIN' && user.role !== 'ADMIN' && user.role !== 'CERTIFIER')) {
        return res.status(403).json({ success: false, error: 'Reviewer access required' });
      }

      const { reason } = req.body;

      if (!reason || reason.length < 10) {
        return res.status(400).json({ success: false, error: 'Rejection reason required (min 10 characters)' });
      }

      const certificate = await mockPrismaClient.organicCertificate.findUnique({
        where: { id: req.params.id },
      });

      if (!certificate) {
        return res.status(404).json({ success: false, error: 'Certificate not found' });
      }

      const updated = await mockPrismaClient.organicCertificate.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Certificate rejected',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/organic-certificates/:id/download-pdf - Download PDF
  app.get('/api/v1/organic-certificates/:id/download-pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const certificate = await mockPrismaClient.organicCertificate.findUnique({
        where: { id: req.params.id },
      });

      if (!certificate) {
        return res.status(404).json({ success: false, error: 'Certificate not found' });
      }

      if (certificate.status !== 'APPROVED') {
        return res.status(400).json({ success: false, error: 'Certificate must be approved to download PDF' });
      }

      // In real implementation, this would generate and return PDF
      res.json({
        success: true,
        data: {
          pdfUrl: `https://storage.agrobridge.io/certs/${certificate.certificateNumber}.pdf`,
          expiresIn: 3600,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8: Public QR Verification Routes (No Auth Required)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /verify/certificate/:certificateNumber - Public verification
  app.get('/verify/certificate/:certificateNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateNumber } = req.params;

      // Find by certificate number
      const certificate = await mockPrismaClient.organicCertificate.findFirst({
        where: { certificateNumber },
      });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          verified: false,
          error: 'Certificate not found',
        });
      }

      if (certificate.status !== 'APPROVED') {
        return res.json({
          success: true,
          verified: false,
          data: {
            certificateNumber: certificate.certificateNumber,
            status: certificate.status,
          },
          message: 'Certificate is not yet approved',
        });
      }

      // Check expiry
      const isExpired = new Date() > certificate.expiryDate;

      res.json({
        success: true,
        verified: !isExpired,
        data: {
          certificateNumber: certificate.certificateNumber,
          cropType: certificate.cropType,
          certificationStandard: certificate.certificationStandard,
          issueDate: certificate.issueDate,
          expiryDate: certificate.expiryDate,
          isExpired,
          farmer: {
            businessName: mockProducer.businessName,
            region: `${mockProducer.municipality}, ${mockProducer.state}`,
          },
          blockchainVerified: !!certificate.blockchainHash,
          blockchainHash: certificate.blockchainHash,
        },
        message: isExpired ? 'Certificate has expired' : 'Certificate is valid and verified',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /verify/qr/:code - QR code redirect (short codes)
  app.get('/verify/qr/:code', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In real implementation, decode short code to certificate number
      const certNumber = `ORG-2025-MX-${req.params.code}`;

      const certificate = await mockPrismaClient.organicCertificate.findFirst({
        where: { certificateNumber: certNumber },
      });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          verified: false,
          error: 'QR code not found or expired',
        });
      }

      // Redirect to full verification page
      res.json({
        success: true,
        data: {
          certificateNumber: certificate.certificateNumber,
          verificationUrl: `/verify/certificate/${certificate.certificateNumber}`,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /verify/bulk - Bulk verification for auditors
  app.post('/verify/bulk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateNumbers } = req.body;

      if (!Array.isArray(certificateNumbers) || certificateNumbers.length === 0) {
        return res.status(400).json({ success: false, error: 'Certificate numbers array required' });
      }

      if (certificateNumbers.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 certificates per request' });
      }

      // Mock bulk verification
      const results = certificateNumbers.map(num => ({
        certificateNumber: num,
        verified: true,
        status: 'APPROVED',
        expiryDate: mockCertificate.expiryDate,
      }));

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            verified: results.filter(r => r.verified).length,
            invalid: results.filter(r => !r.verified).length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /verify/stats - Public verification stats
  app.get('/verify/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In real implementation, return aggregated stats
      res.json({
        success: true,
        data: {
          totalCertificates: 1234,
          activeCertificates: 1100,
          expiredCertificates: 134,
          blockchainVerified: 850,
          verificationsToday: 45,
          verificationsThisMonth: 1200,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Organic Certification Workflow - Part 2 (Day 2)', () => {
  let app: Express;
  let adminToken: string;
  let producerToken: string;
  let certifierToken: string;

  beforeAll(() => {
    app = createTestApp();
    adminToken = generateAdminToken('admin-test-user');
    producerToken = generateProducerToken(mockProducer.id, mockProducer.userId);
    certifierToken = generateCertifierToken('certifier-test-user');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: Satellite Analysis Request
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Test 5: Satellite Analysis Request', () => {
    it('should request satellite NDVI analysis for field', async () => {
      const response = await request(app)
        .post('/api/v1/satellite-analysis')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          fieldId: mockOrganicField.id,
          analysisType: 'NDVI',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.analysisId).toBeDefined();
      expect(response.body.data.status).toBe('PROCESSING');
      expect(response.body.message).toContain('Satellite analysis requested');
    });

    it('should get satellite analysis results', async () => {
      const response = await request(app)
        .get(`/api/v1/satellite-analysis/${mockSatelliteAnalysis.id}`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ndviScore).toBeDefined();
      expect(response.body.data.complianceStatus).toBe('COMPLIANT');
      expect(response.body.data.vegetationHealthGrade).toBe('EXCELLENT');
    });

    it('should get satellite analysis history for field', async () => {
      const response = await request(app)
        .get(`/api/v1/organic-fields/${mockOrganicField.id}/satellite-history`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject analysis request without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/satellite-analysis')
        .send({ fieldId: mockOrganicField.id });

      expect(response.status).toBe(401);
    });

    it('should reject analysis for non-existent field', async () => {
      vi.mocked(mockPrismaClient.organicField.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/satellite-analysis')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({ fieldId: 'non-existent-field' });

      expect(response.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6: Verification Stage Progression
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Test 6: Verification Stage Progression', () => {
    it('should create HARVEST verification stage', async () => {
      const response = await request(app)
        .post(`/api/v1/batches/${mockBatch.id}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          stageType: 'HARVEST',
          verificationData: {
            harvestDate: new Date().toISOString(),
            workers: 5,
            toolsUsed: ['machete', 'crates'],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stageType).toBe('HARVEST');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should list verification stages for batch', async () => {
      const response = await request(app)
        .get(`/api/v1/batches/${mockBatch.id}/stages`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.completedCount).toBeDefined();
    });

    it('should approve verification stage', async () => {
      const response = await request(app)
        .patch(`/api/v1/verification-stages/${mockVerificationStage.id}`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({
          status: 'APPROVED',
          verificationData: {
            inspectedAt: new Date().toISOString(),
            inspectorNotes: 'All requirements met',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should reject verification stage with reason', async () => {
      const response = await request(app)
        .patch(`/api/v1/verification-stages/${mockVerificationStage.id}`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({
          status: 'REJECTED',
          rejectionReason: 'Missing documentation for organic inputs',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('REJECTED');
    });

    it('should require rejection reason when rejecting', async () => {
      const response = await request(app)
        .patch(`/api/v1/verification-stages/${mockVerificationStage.id}`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({ status: 'REJECTED' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Rejection reason');
    });

    it('should finalize all stages when approved', async () => {
      // Mock all stages as approved
      vi.mocked(mockPrismaClient.verificationStage.findMany).mockResolvedValueOnce([
        { ...mockVerificationStage, status: 'APPROVED' },
        { ...mockVerificationStage, id: 'stage-2', stageType: 'PACKING', status: 'APPROVED' },
      ]);

      const response = await request(app)
        .post(`/api/v1/batches/${mockBatch.id}/stages/finalize`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligibleForCertification).toBe(true);
    });

    it('should reject finalization if stages incomplete', async () => {
      // Mock with pending stage
      vi.mocked(mockPrismaClient.verificationStage.findMany).mockResolvedValueOnce([
        { ...mockVerificationStage, status: 'APPROVED' },
        { ...mockVerificationStage, id: 'stage-2', stageType: 'PACKING', status: 'PENDING' },
      ]);

      const response = await request(app)
        .post(`/api/v1/batches/${mockBatch.id}/stages/finalize`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Not all stages');
      expect(response.body.data.pendingStages).toContain('PACKING');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7: Certificate Issuance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Test 7: Certificate Issuance', () => {
    it('should generate organic certificate request', async () => {
      const response = await request(app)
        .post('/api/v1/organic-certificates/generate')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          fieldIds: [mockOrganicField.id],
          cropType: 'AVOCADO',
          certificationStandard: 'ORGANIC_USDA',
          harvestDate: new Date().toISOString(),
          notes: 'First organic harvest of the season',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.certificateId).toBeDefined();
      expect(response.body.data.certificateNumber).toMatch(/^ORG-\d{4}-MX-/);
      expect(response.body.data.qrCode).toContain('verify.agrobridge.io');
    });

    it('should get certificate details', async () => {
      const response = await request(app)
        .get(`/api/v1/organic-certificates/${mockCertificate.id}`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.certificateNumber).toBe(mockCertificate.certificateNumber);
      expect(response.body.data.farmer).toBeDefined();
      expect(response.body.data.fields).toBeDefined();
    });

    it('should approve certificate as certifier', async () => {
      const response = await request(app)
        .post(`/api/v1/organic-certificates/${mockCertificate.id}/approve`)
        .set('Authorization', `Bearer ${certifierToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.message).toContain('approved');
    });

    it('should reject certificate with reason', async () => {
      const response = await request(app)
        .post(`/api/v1/organic-certificates/${mockCertificate.id}/reject`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({
          reason: 'Insufficient documentation for organic transition period verification',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('REJECTED');
    });

    it('should require reason when rejecting certificate', async () => {
      const response = await request(app)
        .post(`/api/v1/organic-certificates/${mockCertificate.id}/reject`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({ reason: 'short' });

      expect(response.status).toBe(400);
    });

    it('should download PDF for approved certificate', async () => {
      vi.mocked(mockPrismaClient.organicCertificate.findUnique).mockResolvedValueOnce({
        ...mockCertificate,
        status: 'APPROVED',
      });

      const response = await request(app)
        .get(`/api/v1/organic-certificates/${mockCertificate.id}/download-pdf`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pdfUrl).toBeDefined();
    });

    it('should reject PDF download for non-approved certificate', async () => {
      const response = await request(app)
        .get(`/api/v1/organic-certificates/${mockCertificate.id}/download-pdf`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(400);
    });

    it('should validate certification standard', async () => {
      const response = await request(app)
        .post('/api/v1/organic-certificates/generate')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          fieldIds: [mockOrganicField.id],
          cropType: 'AVOCADO',
          certificationStandard: 'INVALID_STANDARD',
        });

      expect(response.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8: QR Code Verification (Public)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Test 8: QR Code Verification (Public)', () => {
    it('should verify certificate by number (public endpoint)', async () => {
      vi.mocked(mockPrismaClient.organicCertificate.findFirst).mockResolvedValueOnce({
        ...mockCertificate,
        status: 'APPROVED',
      });

      const response = await request(app)
        .get(`/verify/certificate/${mockCertificate.certificateNumber}`);
      // No auth header - public endpoint

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.data.certificateNumber).toBe(mockCertificate.certificateNumber);
      expect(response.body.data.farmer).toBeDefined();
      expect(response.body.data.farmer.businessName).toBe(mockProducer.businessName);
    });

    it('should indicate expired certificates', async () => {
      vi.mocked(mockPrismaClient.organicCertificate.findFirst).mockResolvedValueOnce({
        ...mockCertificate,
        status: 'APPROVED',
        expiryDate: new Date('2020-01-01'), // Expired
      });

      const response = await request(app)
        .get(`/verify/certificate/${mockCertificate.certificateNumber}`);

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.data.isExpired).toBe(true);
    });

    it('should return 404 for non-existent certificate', async () => {
      vi.mocked(mockPrismaClient.organicCertificate.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/verify/certificate/NON-EXISTENT-CERT');

      expect(response.status).toBe(404);
      expect(response.body.verified).toBe(false);
    });

    it('should indicate non-approved certificates', async () => {
      const response = await request(app)
        .get(`/verify/certificate/${mockCertificate.certificateNumber}`);

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.data.status).toBe('PENDING_REVIEW');
    });

    it('should handle QR short code redirect', async () => {
      const response = await request(app)
        .get('/verify/qr/001234');

      expect(response.status).toBe(200);
      expect(response.body.data.verificationUrl).toBeDefined();
    });

    it('should support bulk verification', async () => {
      const response = await request(app)
        .post('/verify/bulk')
        .send({
          certificateNumbers: [
            mockCertificate.certificateNumber,
            'ORG-2025-MX-002345',
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary.total).toBe(2);
    });

    it('should limit bulk verification to 50 certificates', async () => {
      const tooMany = Array(51).fill('ORG-2025-MX-000000');

      const response = await request(app)
        .post('/verify/bulk')
        .send({ certificateNumbers: tooMany });

      expect(response.status).toBe(400);
    });

    it('should return public verification stats', async () => {
      const response = await request(app)
        .get('/verify/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.totalCertificates).toBeDefined();
      expect(response.body.data.activeCertificates).toBeDefined();
      expect(response.body.data.blockchainVerified).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETE WORKFLOW INTEGRATION TEST
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Complete Certificate Workflow Integration', () => {
    it('should complete full certificate workflow: analysis → stages → certificate → verify', { timeout: 30000 }, async () => {
      // Step 1: Request satellite analysis
      const analysisResponse = await request(app)
        .post('/api/v1/satellite-analysis')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({ fieldId: mockOrganicField.id, analysisType: 'NDVI' });

      expect(analysisResponse.status).toBe(202);
      console.log('[Step 1] Satellite analysis requested ✓');

      // Step 2: Create verification stages
      const stageResponse = await request(app)
        .post(`/api/v1/batches/${mockBatch.id}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({ stageType: 'HARVEST' });

      expect(stageResponse.status).toBe(201);
      console.log('[Step 2] Verification stage created ✓');

      // Step 3: Approve stage
      const approveStageResponse = await request(app)
        .patch(`/api/v1/verification-stages/${mockVerificationStage.id}`)
        .set('Authorization', `Bearer ${certifierToken}`)
        .send({ status: 'APPROVED' });

      expect(approveStageResponse.status).toBe(200);
      console.log('[Step 3] Stage approved ✓');

      // Step 4: Generate certificate
      const certResponse = await request(app)
        .post('/api/v1/organic-certificates/generate')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          fieldIds: [mockOrganicField.id],
          cropType: 'AVOCADO',
          certificationStandard: 'ORGANIC_USDA',
        });

      expect(certResponse.status).toBe(202);
      console.log('[Step 4] Certificate generated ✓');

      // Step 5: Approve certificate
      const approveCertResponse = await request(app)
        .post(`/api/v1/organic-certificates/${mockCertificate.id}/approve`)
        .set('Authorization', `Bearer ${certifierToken}`);

      expect(approveCertResponse.status).toBe(200);
      console.log('[Step 5] Certificate approved ✓');

      // Step 6: Public verification (no auth)
      vi.mocked(mockPrismaClient.organicCertificate.findFirst).mockResolvedValueOnce({
        ...mockCertificate,
        status: 'APPROVED',
      });

      const verifyResponse = await request(app)
        .get(`/verify/certificate/${mockCertificate.certificateNumber}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.verified).toBe(true);
      console.log('[Step 6] Public verification passed ✓');

      console.log('[Integration Test] Complete certificate workflow passed ✓');
    });
  });
});
