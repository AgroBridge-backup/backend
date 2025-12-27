/**
 * WhatsApp Notification Service Interface
 * Defines the contract for sending business notifications via WhatsApp
 */

export interface InvoiceNotificationData {
  folio: string;
  uuid: string;
  total: number;
  currency: string;
  recipientName: string;
  blockchainHash?: string;
  pdfUrl?: string;
  verifyUrl: string;
}

export interface ReferralNotificationData {
  referredName: string;
  reward: string;
  blockchainProofUrl?: string;
}

export interface ReferralActivatedData {
  referredName: string;
  totalActive: number;
  leaderboardRank: number;
}

export interface InvoiceDueReminderData {
  folio: string;
  amount: number;
  currency: string;
  dueDate: Date;
  daysRemaining: number;
}

export interface InvoiceOverdueData {
  folio: string;
  amount: number;
  currency: string;
  dueDate: Date;
  daysOverdue: number;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IWhatsAppNotificationService {
  /**
   * Send invoice created notification
   */
  sendInvoiceCreatedNotification(
    phoneNumber: string,
    data: InvoiceNotificationData,
    language?: "es" | "en",
  ): Promise<NotificationResult>;

  /**
   * Send invoice due soon reminder
   */
  sendInvoiceDueReminder(
    phoneNumber: string,
    data: InvoiceDueReminderData,
    language?: "es" | "en",
  ): Promise<NotificationResult>;

  /**
   * Send invoice overdue notification
   */
  sendInvoiceOverdueNotification(
    phoneNumber: string,
    data: InvoiceOverdueData,
    language?: "es" | "en",
  ): Promise<NotificationResult>;

  /**
   * Send referral success notification
   */
  sendReferralSuccessNotification(
    phoneNumber: string,
    data: ReferralNotificationData,
    language?: "es" | "en",
  ): Promise<NotificationResult>;

  /**
   * Send referral activated notification (30-day milestone reached)
   */
  sendReferralActivatedNotification(
    phoneNumber: string,
    data: ReferralActivatedData,
    language?: "es" | "en",
  ): Promise<NotificationResult>;

  /**
   * Get user's phone number if WhatsApp notifications are enabled
   */
  getUserPhoneNumber(userId: string): Promise<string | null>;
}
