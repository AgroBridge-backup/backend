/**
 * Invoice Blockchain Service Interface
 * Abstracts blockchain operations for invoice verification
 */

export interface InvoiceBlockchainData {
  uuid: string;
  folio: string;
  producerId: string;
  recipientRfc: string;
  total: number;
  currency: string;
  issuedAt: Date;
}

export interface InvoiceRegistrationResult {
  success: boolean;
  txHash: string;
  blockchainHash: string;
  network: string;
  timestamp: Date;
  gasUsed?: string;
}

export interface InvoiceVerificationResult {
  isVerified: boolean;
  blockchainHash: string | null;
  txHash: string | null;
  registeredAt: Date | null;
  network: string | null;
}

export interface IInvoiceBlockchainService {
  /**
   * Calculate the hash of an invoice for blockchain registration
   */
  hashInvoice(data: InvoiceBlockchainData): string;

  /**
   * Register an invoice on the blockchain
   */
  registerInvoice(data: InvoiceBlockchainData): Promise<InvoiceRegistrationResult>;

  /**
   * Verify if an invoice is registered on blockchain
   */
  verifyInvoice(uuid: string, expectedHash: string): Promise<InvoiceVerificationResult>;

  /**
   * Check if the blockchain service is healthy
   */
  isHealthy(): Promise<boolean>;
}
