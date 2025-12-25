/**
 * @file PDFStreamGenerator
 * @description Efficient PDF generation with streaming support
 *
 * Provides:
 * - Memory-efficient streaming PDF generation
 * - Chunked response for large documents
 * - Template-based certificate generation
 * - Progress tracking for long operations
 */

import { Writable, Readable, Transform } from 'stream';
import { Response } from 'express';
import { addBreadcrumb, instrumentDatabase } from '../monitoring/sentry.js';

export interface PDFGeneratorOptions {
  title: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface PDFSection {
  type: 'header' | 'paragraph' | 'table' | 'image' | 'qrcode' | 'signature' | 'footer';
  content: unknown;
  style?: Record<string, unknown>;
}

export interface CertificateData {
  certificateNumber: string;
  batchCode: string;
  farmerName: string;
  farmLocation: string;
  productType: string;
  harvestDate: Date;
  certificationBody: string;
  certificationDate: Date;
  expiryDate: Date;
  qrCodeData: string;
  signatures: Array<{
    name: string;
    role: string;
    date: Date;
  }>;
}

const DEFAULT_OPTIONS: PDFGeneratorOptions = {
  title: 'AgroBridge Document',
  author: 'AgroBridge Platform',
  orientation: 'portrait',
  pageSize: 'A4',
  margins: { top: 50, right: 50, bottom: 50, left: 50 },
};

export class PDFStreamGenerator {
  private options: PDFGeneratorOptions;
  private chunkSize: number = 64 * 1024; // 64KB chunks

  constructor(options: Partial<PDFGeneratorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate PDF and stream directly to HTTP response
   */
  async streamToResponse(
    res: Response,
    sections: PDFSection[],
    filename: string
  ): Promise<void> {
    return instrumentDatabase('pdf_stream', async () => {
      addBreadcrumb('Starting PDF stream generation', 'pdf', {
        filename,
        sections: sections.length,
      });

      // Set response headers for streaming
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');

      try {
        // Generate PDF content
        const pdfBuffer = await this.generatePDFBuffer(sections);

        // Stream in chunks
        let offset = 0;
        while (offset < pdfBuffer.length) {
          const chunk = pdfBuffer.slice(offset, offset + this.chunkSize);
          const canContinue = res.write(chunk);

          if (!canContinue) {
            // Wait for drain event if buffer is full
            await new Promise(resolve => res.once('drain', resolve));
          }

          offset += this.chunkSize;
        }

        res.end();

        addBreadcrumb('PDF stream completed', 'pdf', {
          filename,
          size: pdfBuffer.length,
        });
      } catch (error) {
        addBreadcrumb('PDF stream failed', 'pdf', {
          filename,
          error: (error as Error).message,
        });

        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: { code: 'PDF_GENERATION_ERROR', message: 'Failed to generate PDF' },
          });
        }
        throw error;
      }
    });
  }

  /**
   * Generate PDF buffer (for storage or further processing)
   */
  async generatePDFBuffer(sections: PDFSection[]): Promise<Buffer> {
    // Build PDF content
    const pdfContent = this.buildPDFContent(sections);

    // Convert to buffer
    return Buffer.from(pdfContent);
  }

  /**
   * Generate organic certificate PDF
   */
  async generateCertificate(data: CertificateData): Promise<Buffer> {
    return instrumentDatabase('pdf_certificate', async () => {
      const sections: PDFSection[] = [
        // Header with logo
        {
          type: 'header',
          content: {
            logo: 'agrobridge-logo',
            title: 'Organic Certification Certificate',
            subtitle: data.certificationBody,
          },
          style: { align: 'center', marginBottom: 30 },
        },

        // Certificate number
        {
          type: 'paragraph',
          content: `Certificate No: ${data.certificateNumber}`,
          style: { align: 'center', fontSize: 14, fontWeight: 'bold' },
        },

        // Main content
        {
          type: 'paragraph',
          content: 'This is to certify that',
          style: { align: 'center', marginTop: 40 },
        },

        {
          type: 'paragraph',
          content: data.farmerName,
          style: { align: 'center', fontSize: 24, fontWeight: 'bold', marginTop: 10 },
        },

        {
          type: 'paragraph',
          content: `located at ${data.farmLocation}`,
          style: { align: 'center', marginTop: 10 },
        },

        // Product details table
        {
          type: 'table',
          content: {
            headers: ['Field', 'Value'],
            rows: [
              ['Product Type', data.productType],
              ['Batch Code', data.batchCode],
              ['Harvest Date', this.formatDate(data.harvestDate)],
              ['Certification Date', this.formatDate(data.certificationDate)],
              ['Valid Until', this.formatDate(data.expiryDate)],
            ],
          },
          style: { marginTop: 30, marginBottom: 30 },
        },

        // Certification statement
        {
          type: 'paragraph',
          content: 'has been inspected and certified as meeting the requirements of organic production standards. This certificate is valid for the products and period specified above.',
          style: { align: 'justify', marginTop: 20, marginBottom: 30 },
        },

        // QR Code
        {
          type: 'qrcode',
          content: data.qrCodeData,
          style: { align: 'center', size: 100, marginTop: 20 },
        },

        // Verification text
        {
          type: 'paragraph',
          content: 'Scan to verify authenticity',
          style: { align: 'center', fontSize: 10, marginTop: 5 },
        },

        // Signatures
        ...data.signatures.map(sig => ({
          type: 'signature' as const,
          content: {
            name: sig.name,
            role: sig.role,
            date: this.formatDate(sig.date),
          },
          style: { marginTop: 40 },
        })),

        // Footer
        {
          type: 'footer',
          content: {
            text: `Generated on ${this.formatDate(new Date())} | Powered by AgroBridge`,
            pageNumbers: true,
          },
        },
      ];

      return this.generatePDFBuffer(sections);
    });
  }

  /**
   * Build PDF content from sections
   * Note: This is a simplified implementation. In production, use PDFKit or similar.
   */
  private buildPDFContent(sections: PDFSection[]): string {
    // PDF header
    let pdf = '%PDF-1.4\n';
    pdf += '%âãÏÓ\n';

    const objects: string[] = [];
    let objectCount = 0;

    // Catalog
    objectCount++;
    objects.push(`${objectCount} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Pages
    objectCount++;
    objects.push(`${objectCount} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

    // Build content stream
    let contentStream = 'BT\n';
    contentStream += '/F1 12 Tf\n';

    let yPosition = 750;

    for (const section of sections) {
      switch (section.type) {
        case 'header':
          contentStream += `50 ${yPosition} Td\n`;
          contentStream += `(${this.escapeText(String((section.content as { title?: string }).title || ''))}) Tj\n`;
          yPosition -= 40;
          break;

        case 'paragraph':
          contentStream += `50 ${yPosition} Td\n`;
          contentStream += `(${this.escapeText(String(section.content))}) Tj\n`;
          yPosition -= 20;
          break;

        case 'table':
          const table = section.content as { rows?: string[][] };
          if (table.rows) {
            for (const row of table.rows) {
              contentStream += `50 ${yPosition} Td\n`;
              contentStream += `(${this.escapeText(row.join(' | '))}) Tj\n`;
              yPosition -= 15;
            }
          }
          yPosition -= 10;
          break;

        default:
          yPosition -= 20;
      }

      if (yPosition < 100) {
        // Would need page break in real implementation
        yPosition = 750;
      }
    }

    contentStream += 'ET\n';

    // Page
    objectCount++;
    const pageObject = `${objectCount} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`;
    objects.push(pageObject);

    // Content stream
    objectCount++;
    const streamLength = contentStream.length;
    objects.push(`${objectCount} 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // Font
    objectCount++;
    objects.push(`${objectCount} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

    // Build final PDF
    const xref: number[] = [];
    let offset = pdf.length;

    for (const obj of objects) {
      xref.push(offset);
      pdf += obj;
      offset += obj.length;
    }

    // Cross-reference table
    const xrefStart = pdf.length;
    pdf += 'xref\n';
    pdf += `0 ${objectCount + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (const pos of xref) {
      pdf += `${pos.toString().padStart(10, '0')} 00000 n \n`;
    }

    // Trailer
    pdf += 'trailer\n';
    pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
    pdf += 'startxref\n';
    pdf += `${xrefStart}\n`;
    pdf += '%%EOF\n';

    return pdf;
  }

  /**
   * Escape text for PDF
   */
  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\n\r]/g, ' ');
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Create readable stream from buffer
   */
  createReadableStream(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  /**
   * Create transform stream for progress tracking
   */
  createProgressTransform(
    onProgress: (bytesProcessed: number, totalBytes: number) => void,
    totalBytes: number
  ): Transform {
    let bytesProcessed = 0;

    return new Transform({
      transform(chunk, encoding, callback) {
        bytesProcessed += chunk.length;
        onProgress(bytesProcessed, totalBytes);
        callback(null, chunk);
      },
    });
  }
}

// Factory function
export function createPDFGenerator(options?: Partial<PDFGeneratorOptions>): PDFStreamGenerator {
  return new PDFStreamGenerator(options);
}

// Pre-configured generators
export const certificateGenerator = new PDFStreamGenerator({
  title: 'AgroBridge Organic Certificate',
  author: 'AgroBridge Certification Authority',
  subject: 'Organic Product Certification',
  keywords: ['organic', 'certificate', 'agriculture', 'traceability'],
});

export const reportGenerator = new PDFStreamGenerator({
  title: 'AgroBridge Report',
  author: 'AgroBridge Analytics',
  orientation: 'landscape',
});
