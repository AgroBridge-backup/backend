/**
 * @file CSV Generator
 * @description Generate CSV reports using csv-stringify
 *
 * Features:
 * - Batch exports
 * - Event exports
 * - Audit log exports
 * - Custom column mapping
 * - UTF-8 BOM for Excel compatibility
 *
 * @author AgroBridge Engineering Team
 */

import { stringify } from "csv-stringify";
import { Readable } from "stream";
import logger from "../../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CSVColumn<T = Record<string, unknown>> {
  header: string;
  key: keyof T | string;
  format?: (value: unknown, row: T) => string;
}

export interface CSVGeneratorOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  includeBOM?: boolean; // For Excel compatibility
  nullValue?: string;
  dateFormat?: "iso" | "locale" | "custom";
  customDateFormat?: (date: Date) => string;
}

export interface BatchExportRow {
  id: string;
  variety: string;
  origin: string;
  weightKg: number;
  harvestDate: Date;
  status: string;
  producerName: string;
  producerRfc: string;
  blockchainHash: string;
  eventCount: number;
  createdAt: Date;
}

export interface EventExportRow {
  id: string;
  batchId: string;
  eventType: string;
  timestamp: Date;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  temperature?: number;
  humidity?: number;
  notes?: string;
  isVerified: boolean;
  createdById: string;
}

export interface AuditExportRow {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class CSVGenerator {
  private options: Required<CSVGeneratorOptions>;

  constructor(options: CSVGeneratorOptions = {}) {
    this.options = {
      delimiter: ",",
      includeHeaders: true,
      includeBOM: true,
      nullValue: "",
      dateFormat: "iso",
      customDateFormat: (date) => date.toISOString(),
      ...options,
    };
  }

  /**
   * Generate CSV from data with columns
   */
  async generate<T extends object>(
    data: T[],
    columns: CSVColumn<T>[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const rows: string[][] = [];

      // Add headers
      if (this.options.includeHeaders) {
        rows.push(columns.map((col) => col.header));
      }

      // Add data rows
      for (const item of data) {
        const row = columns.map((col) => {
          const value = this.getNestedValue(item, col.key as string);

          if (col.format) {
            return col.format(value, item);
          }

          return this.formatValue(value);
        });
        rows.push(row);
      }

      // Generate CSV
      stringify(
        rows,
        {
          delimiter: this.options.delimiter,
        },
        (err, output) => {
          if (err) {
            logger.error("[CSVGenerator] Failed to generate CSV", {
              error: err.message,
            });
            reject(err);
            return;
          }

          // Add BOM for Excel compatibility
          let buffer: Buffer;
          if (this.options.includeBOM) {
            const bom = Buffer.from([0xef, 0xbb, 0xbf]);
            buffer = Buffer.concat([bom, Buffer.from(output, "utf8")]);
          } else {
            buffer = Buffer.from(output, "utf8");
          }

          logger.info("[CSVGenerator] CSV generated", {
            rows: data.length,
            columns: columns.length,
            size: buffer.length,
          });

          resolve(buffer);
        },
      );
    });
  }

  /**
   * Generate batch export CSV
   */
  async generateBatchExport(data: BatchExportRow[]): Promise<Buffer> {
    const columns: CSVColumn<BatchExportRow>[] = [
      { header: "ID", key: "id" },
      { header: "Variedad", key: "variety" },
      { header: "Origen", key: "origin" },
      { header: "Peso (kg)", key: "weightKg" },
      {
        header: "Fecha Cosecha",
        key: "harvestDate",
        format: (v) => this.formatDate(v as Date),
      },
      { header: "Estado", key: "status" },
      { header: "Productor", key: "producerName" },
      { header: "RFC Productor", key: "producerRfc" },
      { header: "Hash Blockchain", key: "blockchainHash" },
      { header: "Eventos", key: "eventCount" },
      {
        header: "Creado",
        key: "createdAt",
        format: (v) => this.formatDateTime(v as Date),
      },
    ];

    return this.generate(data, columns);
  }

  /**
   * Generate event export CSV
   */
  async generateEventExport(data: EventExportRow[]): Promise<Buffer> {
    const columns: CSVColumn<EventExportRow>[] = [
      { header: "ID", key: "id" },
      { header: "ID Lote", key: "batchId" },
      { header: "Tipo Evento", key: "eventType" },
      {
        header: "Fecha/Hora",
        key: "timestamp",
        format: (v) => this.formatDateTime(v as Date),
      },
      { header: "Ubicacion", key: "locationName" },
      { header: "Latitud", key: "latitude" },
      { header: "Longitud", key: "longitude" },
      {
        header: "Temperatura",
        key: "temperature",
        format: (v) => (v ? `${v}` : ""),
      },
      { header: "Humedad", key: "humidity", format: (v) => (v ? `${v}%` : "") },
      { header: "Notas", key: "notes" },
      {
        header: "Verificado",
        key: "isVerified",
        format: (v) => (v ? "Si" : "No"),
      },
      { header: "Creado Por", key: "createdById" },
    ];

    return this.generate(data, columns);
  }

  /**
   * Generate audit log export CSV
   */
  async generateAuditExport(data: AuditExportRow[]): Promise<Buffer> {
    const columns: CSVColumn<AuditExportRow>[] = [
      { header: "ID", key: "id" },
      {
        header: "Fecha/Hora",
        key: "timestamp",
        format: (v) => this.formatDateTime(v as Date),
      },
      { header: "Usuario", key: "userId" },
      { header: "Accion", key: "action" },
      { header: "Recurso", key: "resource" },
      { header: "ID Recurso", key: "resourceId" },
      { header: "Exito", key: "success", format: (v) => (v ? "Si" : "No") },
      { header: "IP", key: "ipAddress" },
      { header: "User Agent", key: "userAgent" },
      { header: "Duracion (ms)", key: "durationMs" },
    ];

    return this.generate(data, columns);
  }

  /**
   * Generate inventory report CSV
   */
  async generateInventoryExport(
    data: Array<{
      variety: string;
      totalBatches: number;
      totalWeightKg: number;
      avgWeightKg: number;
      inTransit: number;
      delivered: number;
      producers: number;
    }>,
  ): Promise<Buffer> {
    const columns: CSVColumn<(typeof data)[0]>[] = [
      { header: "Variedad", key: "variety" },
      { header: "Total Lotes", key: "totalBatches" },
      {
        header: "Peso Total (kg)",
        key: "totalWeightKg",
        format: (v) => (v as number).toLocaleString(),
      },
      {
        header: "Peso Promedio (kg)",
        key: "avgWeightKg",
        format: (v) => (v as number).toFixed(2),
      },
      { header: "En Transito", key: "inTransit" },
      { header: "Entregados", key: "delivered" },
      { header: "Productores", key: "producers" },
    ];

    return this.generate(data, columns);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: object, path: string): unknown {
    return path.split(".").reduce((current, key) => {
      return current && typeof current === "object"
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
  }

  /**
   * Format value for CSV output
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return this.options.nullValue;
    }

    if (value instanceof Date) {
      return this.formatDate(value);
    }

    if (typeof value === "boolean") {
      return value ? "Si" : "No";
    }

    if (typeof value === "number") {
      return value.toString();
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Format date based on options
   */
  private formatDate(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return this.options.nullValue;
    }

    switch (this.options.dateFormat) {
      case "iso":
        return date.toISOString().split("T")[0];
      case "locale":
        return date.toLocaleDateString("es-MX");
      case "custom":
        return this.options.customDateFormat(date);
      default:
        return date.toISOString().split("T")[0];
    }
  }

  /**
   * Format date with time
   */
  private formatDateTime(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return this.options.nullValue;
    }

    switch (this.options.dateFormat) {
      case "iso":
        return date.toISOString();
      case "locale":
        return date.toLocaleString("es-MX");
      case "custom":
        return this.options.customDateFormat(date);
      default:
        return date.toISOString();
    }
  }
}

// Export factory function
export function createCSVGenerator(
  options?: CSVGeneratorOptions,
): CSVGenerator {
  return new CSVGenerator(options);
}
