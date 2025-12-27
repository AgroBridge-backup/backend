/**
 * Invoice Repository Interface
 * Defines the contract for invoice data access
 */

import { Invoice, InvoiceFilter, InvoiceStatus } from "../entities/Invoice.js";

export interface CreateInvoiceData {
  id: string;
  userId: string;
  producerId?: string;
  buyerId?: string;
  batchId?: string;
  folio: string;
  uuid: string;
  subtotal: number;
  iva: number;
  ivaRate: number;
  total: number;
  currency: string;
  recipientRfc: string;
  recipientName: string;
  recipientEmail?: string;
  notes?: string;
  status: InvoiceStatus;
}

export interface UpdateInvoiceData {
  uuid?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  qrCodeUrl?: string;
  cfdiSeal?: string;
  satSeal?: string;
  satCertNumber?: string;
  stampDate?: Date;
  blockchainHash?: string;
  blockchainTxHash?: string;
  blockchainNetwork?: string;
  blockchainVerified?: boolean;
  blockchainTimestamp?: Date;
  status?: InvoiceStatus;
  issuedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface IInvoiceRepository {
  /**
   * Create a new invoice
   */
  create(data: CreateInvoiceData): Promise<Invoice>;

  /**
   * Find invoice by ID
   */
  findById(id: string): Promise<Invoice | null>;

  /**
   * Find invoice by UUID (fiscal UUID)
   */
  findByUuid(uuid: string): Promise<Invoice | null>;

  /**
   * Find invoice by folio
   */
  findByFolio(folio: string): Promise<Invoice | null>;

  /**
   * List invoices for a user (producer)
   */
  listByUser(userId: string, filter?: InvoiceFilter): Promise<Invoice[]>;

  /**
   * List invoices for a producer
   */
  listByProducer(
    producerId: string,
    filter?: InvoiceFilter,
  ): Promise<Invoice[]>;

  /**
   * Update invoice
   */
  update(id: string, data: UpdateInvoiceData): Promise<Invoice>;

  /**
   * Mark invoice as paid (with optional blockchain tx)
   */
  markAsPaid(id: string, paidAt: Date, txHash?: string): Promise<Invoice>;

  /**
   * Cancel invoice
   */
  cancel(id: string, reason: string): Promise<Invoice>;

  /**
   * Count invoices for folio generation
   */
  countByYear(year: number): Promise<number>;

  /**
   * Get invoice with producer details for verification
   */
  findByIdWithDetails(id: string): Promise<Invoice | null>;

  /**
   * Get invoice by UUID with producer details for public verification
   */
  findByUuidWithDetails(uuid: string): Promise<{
    invoice: Invoice;
    producer?: {
      businessName: string;
      state: string;
      municipality: string;
    };
  } | null>;
}
