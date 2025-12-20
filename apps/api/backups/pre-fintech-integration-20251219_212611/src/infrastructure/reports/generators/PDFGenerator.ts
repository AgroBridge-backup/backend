/**
 * @file PDF Generator
 * @description Generate PDF reports using PDFKit
 *
 * Features:
 * - Batch traceability reports
 * - Producer summary reports
 * - Audit log reports
 * - Compliance reports
 * - Professional styling with headers/footers
 *
 * @author AgroBridge Engineering Team
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import logger from '../../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  author?: string;
  pageSize?: 'A4' | 'LETTER';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
}

export interface BatchReportData {
  batch: {
    id: string;
    variety: string;
    origin: string;
    weightKg: number;
    harvestDate: Date;
    status: string;
    blockchainHash: string;
  };
  producer: {
    businessName: string;
    rfc: string;
    state: string;
    municipality: string;
  };
  events: Array<{
    eventType: string;
    timestamp: Date;
    locationName?: string;
    temperature?: number;
    humidity?: number;
    notes?: string;
    isVerified: boolean;
  }>;
  certifications: Array<{
    type: string;
    certifier: string;
    certificateNumber: string;
    issuedAt: Date;
    expiresAt: Date;
  }>;
}

export interface ProducerReportData {
  producer: {
    businessName: string;
    rfc: string;
    state: string;
    municipality: string;
    isWhitelisted: boolean;
    createdAt: Date;
  };
  stats: {
    totalBatches: number;
    totalWeight: number;
    activeCertifications: number;
    avgEventsPerBatch: number;
  };
  recentBatches: Array<{
    id: string;
    variety: string;
    weightKg: number;
    harvestDate: Date;
    status: string;
  }>;
}

export interface AuditReportData {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalActions: number;
    uniqueUsers: number;
    successRate: number;
  };
  logs: Array<{
    timestamp: Date;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    ipAddress?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class PDFGenerator {
  private doc: PDFKit.PDFDocument | null = null;
  private options: PDFReportOptions;
  private pageNumber: number = 0;
  private yPosition: number = 0;

  // Colors
  private readonly colors = {
    primary: '#2E7D32', // AgroBridge green
    secondary: '#1976D2',
    text: '#212121',
    textLight: '#757575',
    border: '#E0E0E0',
    background: '#F5F5F5',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  };

  // Fonts
  private readonly fonts = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  };

  constructor(options: PDFReportOptions) {
    this.options = {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      author: 'AgroBridge Platform',
      ...options,
    };
  }

  /**
   * Generate batch traceability report
   */
  async generateBatchReport(data: BatchReportData): Promise<Buffer> {
    this.initDocument();

    // Header
    this.addHeader();
    this.addTitle(`Certificado de Trazabilidad`);
    this.addSubtitle(`Lote: ${data.batch.id}`);
    this.addSpace(20);

    // Batch Information Section
    this.addSectionTitle('Informacion del Lote');
    this.addKeyValue('ID del Lote', data.batch.id);
    this.addKeyValue('Variedad', data.batch.variety);
    this.addKeyValue('Origen', data.batch.origin);
    this.addKeyValue('Peso', `${data.batch.weightKg} kg`);
    this.addKeyValue('Fecha de Cosecha', this.formatDate(data.batch.harvestDate));
    this.addKeyValue('Estado', data.batch.status);
    this.addKeyValue('Hash Blockchain', data.batch.blockchainHash.substring(0, 20) + '...');
    this.addSpace(20);

    // Producer Information
    this.addSectionTitle('Informacion del Productor');
    this.addKeyValue('Nombre', data.producer.businessName);
    this.addKeyValue('RFC', data.producer.rfc);
    this.addKeyValue('Estado', data.producer.state);
    this.addKeyValue('Municipio', data.producer.municipality);
    this.addSpace(20);

    // Certifications
    if (data.certifications.length > 0) {
      this.addSectionTitle('Certificaciones');
      const certColumns: TableColumn[] = [
        { header: 'Tipo', key: 'type', width: 120 },
        { header: 'Certificador', key: 'certifier', width: 120 },
        { header: 'Numero', key: 'certificateNumber', width: 100 },
        { header: 'Vigencia', key: 'expiresAt', width: 100, format: (v) => this.formatDate(v as Date) },
      ];
      this.addTable(certColumns, data.certifications);
      this.addSpace(20);
    }

    // Events Timeline
    this.addSectionTitle('Eventos de Trazabilidad');
    const eventColumns: TableColumn[] = [
      { header: 'Evento', key: 'eventType', width: 100 },
      { header: 'Fecha', key: 'timestamp', width: 80, format: (v) => this.formatDate(v as Date) },
      { header: 'Ubicacion', key: 'locationName', width: 100 },
      { header: 'Temp', key: 'temperature', width: 50, format: (v) => v ? `${v}C` : '-' },
      { header: 'Verificado', key: 'isVerified', width: 60, format: (v) => v ? 'Si' : 'No' },
    ];
    this.addTable(eventColumns, data.events);

    // Footer with QR placeholder
    this.addSpace(30);
    this.addVerificationFooter(data.batch.blockchainHash);

    return this.finalize();
  }

  /**
   * Generate producer summary report
   */
  async generateProducerReport(data: ProducerReportData): Promise<Buffer> {
    this.initDocument();

    this.addHeader();
    this.addTitle('Reporte de Productor');
    this.addSubtitle(data.producer.businessName);
    this.addSpace(20);

    // Producer Info
    this.addSectionTitle('Informacion General');
    this.addKeyValue('RFC', data.producer.rfc);
    this.addKeyValue('Ubicacion', `${data.producer.municipality}, ${data.producer.state}`);
    this.addKeyValue('Estado', data.producer.isWhitelisted ? 'Verificado' : 'Pendiente');
    this.addKeyValue('Miembro desde', this.formatDate(data.producer.createdAt));
    this.addSpace(20);

    // Statistics
    this.addSectionTitle('Estadisticas');
    this.addStatsGrid([
      { label: 'Total Lotes', value: data.stats.totalBatches.toString() },
      { label: 'Peso Total', value: `${data.stats.totalWeight.toLocaleString()} kg` },
      { label: 'Certificaciones Activas', value: data.stats.activeCertifications.toString() },
      { label: 'Eventos por Lote', value: data.stats.avgEventsPerBatch.toFixed(1) },
    ]);
    this.addSpace(20);

    // Recent Batches
    if (data.recentBatches.length > 0) {
      this.addSectionTitle('Lotes Recientes');
      const batchColumns: TableColumn[] = [
        { header: 'ID', key: 'id', width: 100 },
        { header: 'Variedad', key: 'variety', width: 80 },
        { header: 'Peso (kg)', key: 'weightKg', width: 80, align: 'right' },
        { header: 'Cosecha', key: 'harvestDate', width: 80, format: (v) => this.formatDate(v as Date) },
        { header: 'Estado', key: 'status', width: 80 },
      ];
      this.addTable(batchColumns, data.recentBatches);
    }

    return this.finalize();
  }

  /**
   * Generate audit log report
   */
  async generateAuditReport(data: AuditReportData): Promise<Buffer> {
    this.initDocument();

    this.addHeader();
    this.addTitle('Reporte de Auditoria');
    this.addSubtitle(`${this.formatDate(data.period.start)} - ${this.formatDate(data.period.end)}`);
    this.addSpace(20);

    // Summary
    this.addSectionTitle('Resumen');
    this.addStatsGrid([
      { label: 'Total Acciones', value: data.summary.totalActions.toLocaleString() },
      { label: 'Usuarios Unicos', value: data.summary.uniqueUsers.toString() },
      { label: 'Tasa de Exito', value: `${data.summary.successRate.toFixed(1)}%` },
    ]);
    this.addSpace(20);

    // Audit Logs Table
    this.addSectionTitle('Registro de Actividades');
    const logColumns: TableColumn[] = [
      { header: 'Fecha', key: 'timestamp', width: 80, format: (v) => this.formatDateTime(v as Date) },
      { header: 'Accion', key: 'action', width: 100 },
      { header: 'Recurso', key: 'resource', width: 80 },
      { header: 'ID', key: 'resourceId', width: 80 },
      { header: 'Exito', key: 'success', width: 50, format: (v) => v ? 'Si' : 'No' },
    ];
    this.addTable(logColumns, data.logs.slice(0, 100)); // Limit to 100 rows

    return this.finalize();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOCUMENT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private initDocument(): void {
    const size = this.options.pageSize === 'LETTER' ? 'LETTER' : 'A4';
    const layout = this.options.orientation === 'landscape' ? 'landscape' : 'portrait';

    this.doc = new PDFDocument({
      size,
      layout,
      margins: this.options.margins,
      info: {
        Title: this.options.title,
        Author: this.options.author,
        Creator: 'AgroBridge Platform',
      },
    });

    this.pageNumber = 1;
    this.yPosition = this.options.margins!.top;

    // Add page numbers
    this.doc.on('pageAdded', () => {
      this.pageNumber++;
      this.yPosition = this.options.margins!.top;
      this.addPageNumber();
    });
  }

  private addHeader(): void {
    if (!this.doc) return;

    const margins = this.options.margins!;

    // Logo placeholder (green rectangle)
    this.doc
      .rect(margins.left, margins.top - 50, 40, 40)
      .fill(this.colors.primary);

    // Company name
    this.doc
      .font(this.fonts.bold)
      .fontSize(16)
      .fillColor(this.colors.primary)
      .text('AgroBridge', margins.left + 50, margins.top - 45);

    this.doc
      .font(this.fonts.regular)
      .fontSize(10)
      .fillColor(this.colors.textLight)
      .text('Plataforma de Trazabilidad Agricola', margins.left + 50, margins.top - 28);

    // Date
    this.doc
      .fontSize(9)
      .text(
        `Generado: ${this.formatDateTime(new Date())}`,
        this.doc.page.width - margins.right - 150,
        margins.top - 45,
        { width: 150, align: 'right' }
      );

    this.yPosition = margins.top + 20;
  }

  private addTitle(text: string): void {
    if (!this.doc) return;

    this.doc
      .font(this.fonts.bold)
      .fontSize(24)
      .fillColor(this.colors.text)
      .text(text, this.options.margins!.left, this.yPosition);

    this.yPosition += 35;
  }

  private addSubtitle(text: string): void {
    if (!this.doc) return;

    this.doc
      .font(this.fonts.regular)
      .fontSize(14)
      .fillColor(this.colors.textLight)
      .text(text, this.options.margins!.left, this.yPosition);

    this.yPosition += 25;
  }

  private addSectionTitle(text: string): void {
    if (!this.doc) return;

    this.checkPageBreak(40);

    // Colored bar
    this.doc
      .rect(this.options.margins!.left, this.yPosition, 4, 20)
      .fill(this.colors.primary);

    this.doc
      .font(this.fonts.bold)
      .fontSize(14)
      .fillColor(this.colors.text)
      .text(text, this.options.margins!.left + 12, this.yPosition + 3);

    this.yPosition += 30;
  }

  private addKeyValue(key: string, value: string): void {
    if (!this.doc) return;

    this.checkPageBreak(20);

    const margins = this.options.margins!;

    this.doc
      .font(this.fonts.bold)
      .fontSize(10)
      .fillColor(this.colors.textLight)
      .text(key + ':', margins.left, this.yPosition, { continued: true });

    this.doc
      .font(this.fonts.regular)
      .fillColor(this.colors.text)
      .text('  ' + value);

    this.yPosition += 18;
  }

  private addTable(columns: TableColumn[], data: Record<string, unknown>[]): void {
    if (!this.doc || data.length === 0) return;

    const margins = this.options.margins!;
    const tableWidth = this.doc.page.width - margins.left - margins.right;

    // Calculate column widths
    const totalDefinedWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
    const remainingWidth = tableWidth - totalDefinedWidth;
    const undefinedCount = columns.filter(col => !col.width).length;
    const defaultWidth = undefinedCount > 0 ? remainingWidth / undefinedCount : 0;

    const colWidths = columns.map(col => col.width || defaultWidth);

    // Header row
    this.checkPageBreak(50);
    let x = margins.left;
    const headerY = this.yPosition;

    // Header background
    this.doc
      .rect(margins.left, headerY - 5, tableWidth, 25)
      .fill(this.colors.background);

    this.doc
      .font(this.fonts.bold)
      .fontSize(9)
      .fillColor(this.colors.text);

    columns.forEach((col, i) => {
      this.doc!.text(col.header, x + 5, headerY, {
        width: colWidths[i] - 10,
        align: col.align || 'left',
      });
      x += colWidths[i];
    });

    this.yPosition = headerY + 25;

    // Data rows
    this.doc.font(this.fonts.regular).fontSize(9);

    data.forEach((row, rowIndex) => {
      this.checkPageBreak(25);

      x = margins.left;
      const rowY = this.yPosition;

      // Alternating row background
      if (rowIndex % 2 === 1) {
        this.doc!
          .rect(margins.left, rowY - 3, tableWidth, 20)
          .fill('#FAFAFA');
      }

      this.doc!.fillColor(this.colors.text);

      columns.forEach((col, i) => {
        let value = row[col.key];
        if (col.format && value !== undefined) {
          value = col.format(value);
        }
        const displayValue = value?.toString() || '-';

        this.doc!.text(displayValue, x + 5, rowY, {
          width: colWidths[i] - 10,
          align: col.align || 'left',
        });
        x += colWidths[i];
      });

      this.yPosition += 20;
    });

    // Border
    this.doc
      .rect(margins.left, headerY - 5, tableWidth, this.yPosition - headerY + 5)
      .stroke(this.colors.border);
  }

  private addStatsGrid(stats: Array<{ label: string; value: string }>): void {
    if (!this.doc) return;

    this.checkPageBreak(80);

    const margins = this.options.margins!;
    const boxWidth = (this.doc.page.width - margins.left - margins.right - 30) / stats.length;
    const boxHeight = 60;

    stats.forEach((stat, i) => {
      const x = margins.left + i * (boxWidth + 10);

      // Box background
      this.doc!
        .roundedRect(x, this.yPosition, boxWidth, boxHeight, 5)
        .fill(this.colors.background);

      // Value
      this.doc!
        .font(this.fonts.bold)
        .fontSize(20)
        .fillColor(this.colors.primary)
        .text(stat.value, x, this.yPosition + 10, { width: boxWidth, align: 'center' });

      // Label
      this.doc!
        .font(this.fonts.regular)
        .fontSize(9)
        .fillColor(this.colors.textLight)
        .text(stat.label, x, this.yPosition + 38, { width: boxWidth, align: 'center' });
    });

    this.yPosition += boxHeight + 10;
  }

  private addVerificationFooter(hash: string): void {
    if (!this.doc) return;

    const margins = this.options.margins!;
    const y = this.doc.page.height - margins.bottom - 80;

    // Separator line
    this.doc
      .moveTo(margins.left, y)
      .lineTo(this.doc.page.width - margins.right, y)
      .stroke(this.colors.border);

    // Verification text
    this.doc
      .font(this.fonts.bold)
      .fontSize(10)
      .fillColor(this.colors.text)
      .text('Verificacion Blockchain', margins.left, y + 15);

    this.doc
      .font(this.fonts.regular)
      .fontSize(8)
      .fillColor(this.colors.textLight)
      .text(
        `Este documento puede ser verificado usando el hash: ${hash}`,
        margins.left,
        y + 30
      );

    this.doc.text(
      'Visita https://agrobridge.mx/verify para validar la autenticidad.',
      margins.left,
      y + 45
    );
  }

  private addPageNumber(): void {
    if (!this.doc) return;

    const margins = this.options.margins!;

    this.doc
      .font(this.fonts.regular)
      .fontSize(9)
      .fillColor(this.colors.textLight)
      .text(
        `Pagina ${this.pageNumber}`,
        margins.left,
        this.doc.page.height - margins.bottom + 20,
        { align: 'center', width: this.doc.page.width - margins.left - margins.right }
      );
  }

  private addSpace(height: number): void {
    this.yPosition += height;
  }

  private checkPageBreak(requiredSpace: number): void {
    if (!this.doc) return;

    const margins = this.options.margins!;
    const availableSpace = this.doc.page.height - margins.bottom - this.yPosition;

    if (availableSpace < requiredSpace) {
      this.doc.addPage();
    }
  }

  private formatDate(date: Date): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatDateTime(date: Date): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private finalize(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.doc) {
        reject(new Error('Document not initialized'));
        return;
      }

      const chunks: Buffer[] = [];

      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('[PDFGenerator] PDF generated', { size: buffer.length });
        resolve(buffer);
      });
      this.doc.on('error', reject);

      this.addPageNumber();
      this.doc.end();
    });
  }
}

// Export factory function
export function createPDFGenerator(options: PDFReportOptions): PDFGenerator {
  return new PDFGenerator(options);
}
