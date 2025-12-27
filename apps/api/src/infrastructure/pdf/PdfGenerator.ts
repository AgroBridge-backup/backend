/**
 * PDF Generator for Organic Certificates
 * Uses PDFKit for production-grade PDF generation
 * Bilingual template: Spanish primary, English secondary
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  PdfTemplateData,
  QrCodeContent,
  CERTIFICATION_DISPLAY_NAMES,
  BLOCKCHAIN_EXPLORERS,
} from "../../domain/entities/OrganicCertificate.js";
import logger from "../../shared/utils/logger.js";

/**
 * PDF Generator configuration
 */
interface PdfGeneratorConfig {
  logoUrl?: string;
  companyName: string;
  companyWebsite: string;
  verificationBaseUrl: string;
}

/**
 * PDF Generator class for organic certificates
 */
export class PdfGenerator {
  private readonly config: PdfGeneratorConfig;

  constructor(config?: Partial<PdfGeneratorConfig>) {
    this.config = {
      logoUrl: config?.logoUrl,
      companyName: config?.companyName || "AgroBridge",
      companyWebsite: config?.companyWebsite || "https://agrobridge.io",
      verificationBaseUrl:
        config?.verificationBaseUrl || "https://verify.agrobridge.io",
    };
  }

  /**
   * Generate certificate PDF
   */
  async generateCertificatePdf(data: PdfTemplateData): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Organic Certificate - ${data.certificateNumber}`,
          Author: this.config.companyName,
          Subject: "Organic Production Certificate",
          Keywords: "organic, certificate, agriculture, traceability",
          Creator: this.config.companyName,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          const duration = Date.now() - startTime;

          logger.info("PDF generation completed", {
            certificateNumber: data.certificateNumber,
            size: pdfBuffer.length,
            duration,
          });

          resolve(pdfBuffer);
        });

        doc.on("error", (error) => {
          logger.error("PDF generation failed", {
            certificateNumber: data.certificateNumber,
            error: error.message,
          });
          reject(error);
        });

        // PAGE 1: Certificate Information
        this.renderPage1(doc, data);

        // PAGE 2: Evidence and Footer
        doc.addPage();
        this.renderPage2(doc, data);

        doc.end();
      });
    } catch (error: any) {
      logger.error("PDF generation error", {
        certificateNumber: data.certificateNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate QR code as data URL
   */
  async generateQrCode(content: QrCodeContent): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(content), {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      return qrDataUrl;
    } catch (error: any) {
      logger.error("QR code generation failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Page 1: Certificate Header and Main Information
   */
  private renderPage1(doc: PDFKit.PDFDocument, data: PdfTemplateData): void {
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header background
    doc.rect(0, 0, doc.page.width, 140).fill("#1a5f2a");

    // Company name (white text on green)
    doc
      .fillColor("#FFFFFF")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(this.config.companyName.toUpperCase(), 50, 40);

    // Certificate title
    doc.fontSize(16).text("CERTIFICADO DE PRODUCCION ORGANICA", 50, 70);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Organic Production Certificate", 50, 90);

    // Certificate number badge
    doc
      .fillColor("#FFFFFF")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(data.certificateNumber, doc.page.width - 200, 50);

    // QR Code (right side)
    if (data.qrCodeDataUrl) {
      try {
        doc.image(data.qrCodeDataUrl, doc.page.width - 150, 60, { width: 80 });
      } catch {
        // QR code rendering failed, continue without it
      }
    }

    // Reset color and position for main content
    doc.fillColor("#000000");
    let y = 160;

    // Certification Standard Badge
    const standardName =
      CERTIFICATION_DISPLAY_NAMES[data.certificationStandard as string] ||
      data.certificationStandard;

    doc.rect(50, y, 200, 30).fillAndStroke("#2d7a3e", "#1a5f2a");

    doc
      .fillColor("#FFFFFF")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(standardName, 60, y + 8, { width: 180, align: "center" });

    // Validity dates badge
    doc.rect(260, y, 200, 30).fillAndStroke("#f5f5f5", "#cccccc");

    doc
      .fillColor("#333333")
      .fontSize(9)
      .font("Helvetica")
      .text(
        `Valido: ${format(data.issuedDate, "dd/MM/yyyy")} - ${format(data.expiryDate, "dd/MM/yyyy")}`,
        270,
        y + 10,
        { width: 180, align: "center" },
      );

    y += 50;

    // Farmer Information Section
    doc
      .fillColor("#1a5f2a")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("INFORMACION DEL PRODUCTOR", 50, y);

    y += 25;
    doc.fillColor("#000000").fontSize(11).font("Helvetica");

    // Info table
    const infoRows = [
      ["Productor / Farmer:", data.farmer.name],
      ["Ubicacion / Location:", data.farmer.location],
      [
        "Superficie / Area:",
        `${data.farmer.totalHectares.toFixed(2)} hectareas`,
      ],
      ["Cultivo / Crop:", data.cropType],
    ];

    if (data.harvestDate) {
      infoRows.push([
        "Fecha Cosecha / Harvest:",
        format(data.harvestDate, "dd MMMM yyyy", { locale: es }),
      ]);
    }

    for (const [label, value] of infoRows) {
      doc.font("Helvetica-Bold").text(label, 50, y, { continued: true });
      doc.font("Helvetica").text(` ${value}`);
      y += 18;
    }

    y += 20;

    // Inspection Summary Section
    doc
      .fillColor("#1a5f2a")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("RESUMEN DE INSPECCIONES", 50, y);

    y += 25;
    doc.fillColor("#000000");

    // Summary box
    doc.rect(50, y, pageWidth, 100).fillAndStroke("#f9f9f9", "#e0e0e0");

    const summaryY = y + 15;
    const colWidth = pageWidth / 3;

    // Column 1: Inspections
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1a5f2a")
      .text(data.inspectionSummary.totalInspections.toString(), 50, summaryY, {
        width: colWidth,
        align: "center",
      });

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Inspecciones", 50, summaryY + 30, {
        width: colWidth,
        align: "center",
      })
      .text("Inspections", 50, summaryY + 42, {
        width: colWidth,
        align: "center",
      });

    // Column 2: Photos
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1a5f2a")
      .text(
        data.inspectionSummary.photosCount.toString(),
        50 + colWidth,
        summaryY,
        { width: colWidth, align: "center" },
      );

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Fotografias", 50 + colWidth, summaryY + 30, {
        width: colWidth,
        align: "center",
      })
      .text("Photos", 50 + colWidth, summaryY + 42, {
        width: colWidth,
        align: "center",
      });

    // Column 3: Organic Inputs
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1a5f2a")
      .text(
        data.inspectionSummary.organicInputsCount.toString(),
        50 + colWidth * 2,
        summaryY,
        { width: colWidth, align: "center" },
      );

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("Insumos Organicos", 50 + colWidth * 2, summaryY + 30, {
        width: colWidth,
        align: "center",
      })
      .text("Organic Inputs", 50 + colWidth * 2, summaryY + 42, {
        width: colWidth,
        align: "center",
      });

    // Date range
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text(
        `Periodo: ${format(data.inspectionSummary.dateRange.start, "dd/MM/yyyy")} - ${format(data.inspectionSummary.dateRange.end, "dd/MM/yyyy")}`,
        50,
        summaryY + 70,
        { width: pageWidth, align: "center" },
      );

    y += 120;

    // Blockchain Verification Section
    doc
      .fillColor("#1a5f2a")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("VERIFICACION BLOCKCHAIN", 50, y);

    y += 25;

    // Blockchain info box
    doc.rect(50, y, pageWidth, 80).fillAndStroke("#f0f8f0", "#2d7a3e");

    doc.fillColor("#000000").fontSize(10).font("Helvetica");

    const blockchainY = y + 15;

    doc
      .font("Helvetica-Bold")
      .text("Red / Network:", 60, blockchainY, { continued: true });
    doc.font("Helvetica").text(` ${data.blockchain.network}`);

    doc
      .font("Helvetica-Bold")
      .text("TX Hash:", 60, blockchainY + 18, { continued: true });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(` ${data.blockchain.txHash}`, { width: pageWidth - 80 });

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Fecha / Date:", 60, blockchainY + 40, { continued: true });
    doc
      .font("Helvetica")
      .text(` ${format(data.blockchain.timestamp, "dd/MM/yyyy HH:mm:ss")}`);

    // Verification badge
    doc
      .rect(pageWidth - 80, blockchainY + 10, 80, 40)
      .fillAndStroke("#1a5f2a", "#0f3a18");

    doc
      .fillColor("#FFFFFF")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("VERIFICADO", pageWidth - 80, blockchainY + 20, {
        width: 80,
        align: "center",
      })
      .fontSize(8)
      .font("Helvetica")
      .text("VERIFIED", pageWidth - 80, blockchainY + 34, {
        width: 80,
        align: "center",
      });

    y += 100;

    // Export Company Section
    if (data.exportCompany) {
      doc
        .fillColor("#1a5f2a")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("EMPRESA EXPORTADORA", 50, y);

      y += 25;
      doc
        .fillColor("#000000")
        .fontSize(11)
        .font("Helvetica")
        .text(data.exportCompany.name, 50, y);
    }
  }

  /**
   * Page 2: Evidence Photos and Footer
   */
  private renderPage2(doc: PDFKit.PDFDocument, data: PdfTemplateData): void {
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = 50;

    // Photos Section Header
    doc
      .fillColor("#1a5f2a")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("EVIDENCIA FOTOGRAFICA / PHOTO EVIDENCE", 50, y);

    y += 30;

    // Photo grid (2x2 or 2x3)
    const photoWidth = (pageWidth - 20) / 2;
    const photoHeight = 150;
    const photos = data.samplePhotos.slice(0, 4);

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * (photoWidth + 20);
      const photoY = y + row * (photoHeight + 40);

      // Photo placeholder with border
      doc.rect(x, photoY, photoWidth, photoHeight).stroke("#cccccc");

      // Add photo caption
      doc
        .fillColor("#666666")
        .fontSize(8)
        .font("Helvetica")
        .text(photo.caption || `Foto ${i + 1}`, x, photoY + photoHeight + 5, {
          width: photoWidth,
          align: "center",
        });

      // GPS coordinates if available
      if (photo.gpsLocation) {
        doc.text(
          `GPS: ${photo.gpsLocation.lat.toFixed(4)}, ${photo.gpsLocation.lng.toFixed(4)}`,
          x,
          photoY + photoHeight + 17,
          { width: photoWidth, align: "center" },
        );
      }

      // Timestamp
      doc.text(
        format(photo.timestamp, "dd/MM/yyyy HH:mm"),
        x,
        photoY + photoHeight + 29,
        { width: photoWidth, align: "center" },
      );
    }

    y += Math.ceil(photos.length / 2) * (photoHeight + 50) + 20;

    // Map placeholder (if available)
    if (data.fieldMapImageUrl) {
      doc
        .fillColor("#1a5f2a")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("UBICACION DE PARCELAS / FIELD LOCATIONS", 50, y);

      y += 25;
      doc.rect(50, y, pageWidth, 150).stroke("#cccccc");

      doc
        .fillColor("#999999")
        .fontSize(10)
        .text("[Mapa de Ubicacion / Location Map]", 50, y + 65, {
          width: pageWidth,
          align: "center",
        });

      y += 170;
    }

    // Footer
    const footerY = doc.page.height - 100;

    // Divider line
    doc
      .moveTo(50, footerY)
      .lineTo(doc.page.width - 50, footerY)
      .stroke("#cccccc");

    // Verification URL
    doc
      .fillColor("#1a5f2a")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(
        "Verificar certificado en / Verify certificate at:",
        50,
        footerY + 15,
      );

    doc
      .fillColor("#2d7a3e")
      .fontSize(11)
      .font("Helvetica")
      .text(
        `${this.config.verificationBaseUrl}/${data.certificateNumber}`,
        50,
        footerY + 30,
      );

    // Legal disclaimer
    doc
      .fillColor("#888888")
      .fontSize(7)
      .font("Helvetica")
      .text(
        "Este certificado ha sido generado y anclado en blockchain. La informacion contenida es inmutable y verificable. " +
          "Para verificar la autenticidad, escanee el codigo QR o visite la URL indicada.",
        50,
        footerY + 50,
        { width: pageWidth, align: "justify" },
      );

    doc.text(
      "This certificate has been generated and anchored on blockchain. The information contained is immutable and verifiable. " +
        "To verify authenticity, scan the QR code or visit the URL above.",
      50,
      footerY + 65,
      { width: pageWidth, align: "justify" },
    );

    // Footer branding
    doc
      .fillColor("#cccccc")
      .fontSize(8)
      .text(
        `Generado por ${this.config.companyName} | ${this.config.companyWebsite}`,
        50,
        footerY + 85,
        { width: pageWidth, align: "center" },
      );
  }
}

/**
 * Create default PDF generator instance
 */
export function createPdfGenerator(
  config?: Partial<PdfGeneratorConfig>,
): PdfGenerator {
  return new PdfGenerator(config);
}
