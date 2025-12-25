/**
 * @file PDFStreamGenerator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response } from 'express';
import {
  PDFStreamGenerator,
  createPDFGenerator,
  certificateGenerator,
  CertificateData,
  PDFSection,
} from '../../../src/infrastructure/pdf/PDFStreamGenerator.js';

// Mock Sentry
vi.mock('../../../src/infrastructure/monitoring/sentry.js', () => ({
  addBreadcrumb: vi.fn(),
  instrumentDatabase: vi.fn((name, fn) => fn()),
}));

describe('PDFStreamGenerator', () => {
  let generator: PDFStreamGenerator;

  beforeEach(() => {
    generator = new PDFStreamGenerator({
      title: 'Test PDF',
      author: 'Test Author',
    });
  });

  describe('generatePDFBuffer', () => {
    it('should generate valid PDF buffer', async () => {
      const sections: PDFSection[] = [
        { type: 'header', content: { title: 'Test Document' } },
        { type: 'paragraph', content: 'This is a test paragraph.' },
      ];

      const buffer = await generator.generatePDFBuffer(sections);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Check PDF header
      const pdfHeader = buffer.toString('utf-8').substring(0, 8);
      expect(pdfHeader).toBe('%PDF-1.4');

      // Check PDF footer
      const pdfString = buffer.toString('utf-8');
      expect(pdfString).toContain('%%EOF');
    });

    it('should include content in PDF', async () => {
      const sections: PDFSection[] = [
        { type: 'paragraph', content: 'Hello World' },
      ];

      const buffer = await generator.generatePDFBuffer(sections);
      const pdfString = buffer.toString('utf-8');

      expect(pdfString).toContain('Hello World');
    });

    it('should handle table sections', async () => {
      const sections: PDFSection[] = [
        {
          type: 'table',
          content: {
            headers: ['Name', 'Value'],
            rows: [
              ['Item 1', 'Value 1'],
              ['Item 2', 'Value 2'],
            ],
          },
        },
      ];

      const buffer = await generator.generatePDFBuffer(sections);
      const pdfString = buffer.toString('utf-8');

      expect(pdfString).toContain('Item 1');
      expect(pdfString).toContain('Value 1');
    });

    it('should escape special characters', async () => {
      const sections: PDFSection[] = [
        { type: 'paragraph', content: 'Test (with) parentheses\\' },
      ];

      const buffer = await generator.generatePDFBuffer(sections);
      const pdfString = buffer.toString('utf-8');

      // Should contain escaped characters
      expect(pdfString).toContain('\\(');
      expect(pdfString).toContain('\\)');
    });
  });

  describe('generateCertificate', () => {
    it('should generate certificate PDF', async () => {
      const certificateData: CertificateData = {
        certificateNumber: 'CERT-2024-001',
        batchCode: 'BATCH-001',
        farmerName: 'John Doe',
        farmLocation: 'Kenya, Nairobi',
        productType: 'Coffee Beans',
        harvestDate: new Date('2024-06-15'),
        certificationBody: 'AgroBridge Certification',
        certificationDate: new Date('2024-07-01'),
        expiryDate: new Date('2025-07-01'),
        qrCodeData: 'https://verify.agrobridge.io/cert/CERT-2024-001',
        signatures: [
          { name: 'Jane Smith', role: 'Certifier', date: new Date('2024-07-01') },
        ],
      };

      const buffer = await generator.generateCertificate(certificateData);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const pdfString = buffer.toString('utf-8');
      expect(pdfString).toContain('CERT-2024-001');
      expect(pdfString).toContain('John Doe');
      expect(pdfString).toContain('Coffee Beans');
    });
  });

  describe('streamToResponse', () => {
    it('should stream PDF to response', async () => {
      const chunks: Buffer[] = [];
      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn().mockImplementation((chunk) => {
          chunks.push(chunk);
          return true;
        }),
        end: vi.fn(),
        once: vi.fn(),
        headersSent: false,
      } as unknown as Response;

      const sections: PDFSection[] = [
        { type: 'paragraph', content: 'Streamed content' },
      ];

      await generator.streamToResponse(mockResponse, sections, 'test.pdf');

      // Verify headers were set
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test.pdf"'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');

      // Verify content was written
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();

      // Verify PDF content
      const fullContent = Buffer.concat(chunks).toString('utf-8');
      expect(fullContent).toContain('%PDF-1.4');
    });

    it('should handle backpressure', async () => {
      let drainCallback: (() => void) | null = null;

      const mockResponse = {
        setHeader: vi.fn(),
        write: vi.fn()
          .mockReturnValueOnce(false) // First write returns false (backpressure)
          .mockReturnValue(true),
        end: vi.fn(),
        once: vi.fn().mockImplementation((event, callback) => {
          if (event === 'drain') {
            drainCallback = callback;
            // Simulate drain event
            setTimeout(() => callback(), 10);
          }
        }),
        headersSent: false,
      } as unknown as Response;

      const sections: PDFSection[] = [
        { type: 'paragraph', content: 'Content' },
      ];

      await generator.streamToResponse(mockResponse, sections, 'test.pdf');

      // Should have waited for drain
      expect(mockResponse.once).toHaveBeenCalledWith('drain', expect.any(Function));
    });
  });

  describe('createReadableStream', () => {
    it('should create readable stream from buffer', () => {
      const buffer = Buffer.from('test content');
      const stream = generator.createReadableStream(buffer);

      expect(stream).toBeDefined();
      expect(stream.readable).toBe(true);
    });
  });

  describe('createProgressTransform', () => {
    it('should track progress', async () => {
      const progressCallback = vi.fn();
      const totalBytes = 1000;

      const transform = generator.createProgressTransform(progressCallback, totalBytes);

      // Write some data
      transform.write(Buffer.alloc(100));
      transform.write(Buffer.alloc(200));
      transform.end();

      // Progress should have been called
      expect(progressCallback).toHaveBeenCalledWith(100, totalBytes);
      expect(progressCallback).toHaveBeenCalledWith(300, totalBytes);
    });
  });

  describe('factory functions', () => {
    it('should create generator with custom options', () => {
      const gen = createPDFGenerator({
        title: 'Custom Title',
        orientation: 'landscape',
      });

      expect(gen).toBeInstanceOf(PDFStreamGenerator);
    });

    it('should have pre-configured certificate generator', () => {
      expect(certificateGenerator).toBeInstanceOf(PDFStreamGenerator);
    });
  });
});
