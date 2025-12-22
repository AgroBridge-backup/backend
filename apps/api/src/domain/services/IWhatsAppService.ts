/**
 * WhatsApp Service Interface
 * Defines the contract for WhatsApp messaging operations
 */

export interface SendTextResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TemplateParams {
  [key: string]: string;
}

export interface IWhatsAppService {
  /**
   * Send a text message
   */
  sendText(to: string, body: string): Promise<SendTextResult>;

  /**
   * Send a template message (for notifications outside 24h window)
   */
  sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    parameters?: TemplateParams
  ): Promise<SendTextResult>;

  /**
   * Send interactive buttons
   */
  sendButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<SendTextResult>;

  /**
   * Check if service is configured and available
   */
  isAvailable(): boolean;
}
