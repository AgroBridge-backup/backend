/**
 * Invoice Domain Entity
 * Represents a blockchain-backed CFDI 4.0 invoice
 */

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ISSUED = 'ISSUED',
  BLOCKCHAIN_PENDING = 'BLOCKCHAIN_PENDING',
  VERIFIED = 'VERIFIED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export interface Invoice {
  id: string;
  userId: string;
  producerId?: string | null;
  buyerId?: string | null;
  batchId?: string | null;

  // CFDI Fields
  folio: string;
  uuid: string;
  serie?: string | null;

  // Financial Details
  subtotal: number;
  iva: number;
  ivaRate: number;
  isr: number;
  total: number;
  currency: string;
  exchangeRate?: number | null;

  // Recipient Info
  recipientRfc: string;
  recipientName: string;
  recipientEmail?: string | null;

  // Document Storage
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  qrCodeUrl?: string | null;

  // CFDI Stamp
  cfdiSeal?: string | null;
  satSeal?: string | null;
  certificateNumber?: string | null;
  satCertNumber?: string | null;
  stampDate?: Date | null;

  // Blockchain Verification
  blockchainHash?: string | null;
  blockchainTxHash?: string | null;
  blockchainNetwork?: string | null;
  blockchainVerified: boolean;
  blockchainTimestamp?: Date | null;

  // Status
  status: InvoiceStatus;

  // Audit
  issuedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;

  // Metadata
  notes?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  productKey: string;
}

export interface CreateInvoiceInput {
  userId: string;
  producerId?: string;
  batchId?: string;
  recipientRfc: string;
  recipientName: string;
  recipientEmail?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
  paymentMethod?: string;
  paymentForm?: string;
  currency?: string;
}

export interface InvoiceFilter {
  status?: InvoiceStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}
