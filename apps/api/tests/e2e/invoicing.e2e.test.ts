/**
 * Invoicing E2E Tests
 * Critical tests for invoice creation, listing, and payment marking
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole, InvoiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app';

describe('Invoicing API E2E', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let accessToken: string;
  let producerId: string;
  let testInvoiceId: string;

  const uniqueSuffix = Date.now();
  const producerEmail = `invoice-producer-${uniqueSuffix}@test.com`;
  const password = 'TestPass123!';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test producer user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: producerEmail,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Invoice',
        lastName: 'Producer',
        isActive: true,
        producer: {
          create: {
            businessName: 'Invoice Test Farm',
            rfc: `INV${uniqueSuffix}`.substring(0, 13),
            state: 'Michoacán',
            municipality: 'Uruapan',
            latitude: 19.4167,
            longitude: -102.0667,
            isWhitelisted: true,
          },
        },
      },
      include: { producer: true },
    });

    producerId = user.producer!.id;
    app = createApp();
    request = supertest(app);

    // Login to get access token
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: producerEmail, password });

    accessToken = loginRes.body.data?.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invoice.deleteMany({
      where: { userId: { contains: uniqueSuffix.toString() } },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { email: producerEmail },
    });

    await prisma.$disconnect();
  });

  describe('POST /api/v1/invoices', () => {
    it('should create invoice successfully with valid data', async () => {
      const response = await request
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          producerId,
          recipientRfc: 'XAXX010101000',
          recipientName: 'Comprador Test SA de CV',
          recipientEmail: 'comprador@test.com',
          lineItems: [
            {
              description: 'Aguacate Hass Premium',
              quantity: 100,
              unitPrice: 50.00,
              unit: 'KG',
            },
          ],
          currency: 'MXN',
          ivaRate: 16,
          notes: 'Pedido de prueba',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('folio');
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.subtotal).toBe(5000);
      expect(response.body.data.total).toBe(5800); // 5000 + 16% IVA

      testInvoiceId = response.body.data.id;
    });

    it('should reject invoice without authentication', async () => {
      const response = await request
        .post('/api/v1/invoices')
        .send({
          recipientRfc: 'XAXX010101000',
          recipientName: 'Test',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(401);
    });

    it('should reject invoice with invalid RFC', async () => {
      const response = await request
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recipientRfc: 'INVALID',
          recipientName: 'Test',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invoice without line items', async () => {
      const response = await request
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recipientRfc: 'XAXX010101000',
          recipientName: 'Test',
          lineItems: [],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    it('should get invoice by ID for owner', async () => {
      const response = await request
        .get(`/api/v1/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testInvoiceId);
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request
        .get('/api/v1/invoices/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/invoices/producer/me', () => {
    it('should list invoices for authenticated producer', async () => {
      const response = await request
        .get('/api/v1/invoices/producer/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
    });

    it('should filter invoices by status', async () => {
      const response = await request
        .get('/api/v1/invoices/producer/me?status=DRAFT')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((invoice: any) => {
        expect(invoice.status).toBe('DRAFT');
      });
    });
  });

  describe('POST /api/v1/invoices/:id/mark-paid', () => {
    it('should mark invoice as paid successfully', async () => {
      // First update invoice to ISSUED status so it can be marked paid
      await prisma.invoice.update({
        where: { id: testInvoiceId },
        data: { status: InvoiceStatus.ISSUED },
      });

      const response = await request
        .post(`/api/v1/invoices/${testInvoiceId}/mark-paid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          blockchainTxHash: '0x1234567890abcdef',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('VERIFIED');
    });

    it('should handle idempotent mark-paid (already paid)', async () => {
      const response = await request
        .post(`/api/v1/invoices/${testInvoiceId}/mark-paid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      // Should succeed (idempotent)
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('already');
    });
  });
});
