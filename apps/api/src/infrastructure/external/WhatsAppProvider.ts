/**
 * WhatsApp Provider Adapter
 * Implements IWhatsAppService using Meta's WhatsApp Cloud API
 */

import {
  IWhatsAppService,
  SendTextResult,
  TemplateParams,
} from "../../domain/services/IWhatsAppService.js";
import { logger } from "../logging/logger.js";

interface WhatsAppProviderConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  baseUrl: string;
  maxMessagesPerDay: number;
}

export class WhatsAppProvider implements IWhatsAppService {
  private readonly config: WhatsAppProviderConfig;
  private readonly apiUrl: string;
  private messageCount: Map<string, number> = new Map();

  constructor(config?: Partial<WhatsAppProviderConfig>) {
    this.config = {
      phoneNumberId:
        config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      accessToken:
        config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "",
      apiVersion: config?.apiVersion || "v18.0",
      baseUrl: config?.baseUrl || "https://graph.facebook.com",
      maxMessagesPerDay: config?.maxMessagesPerDay || 1000,
    };

    this.apiUrl = `${this.config.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}`;

    if (!this.config.phoneNumberId || !this.config.accessToken) {
      logger.warn(
        "[WhatsAppProvider] Not fully configured - missing credentials",
      );
    }
  }

  isAvailable(): boolean {
    return !!(this.config.phoneNumberId && this.config.accessToken);
  }

  async sendText(to: string, body: string): Promise<SendTextResult> {
    if (!this.isAvailable()) {
      return { success: false, error: "WhatsApp not configured" };
    }

    // Rate limiting check
    if (!this.checkRateLimit()) {
      return { success: false, error: "Daily message limit reached" };
    }

    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: this.formatPhoneNumber(to),
          type: "text",
          text: { body, preview_url: false },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error("[WhatsAppProvider] API Error:", {
          status: response.status,
          error: data.error,
        });
        return {
          success: false,
          error: data.error?.message || "Unknown error",
        };
      }

      const messageId = data.messages?.[0]?.id;
      this.incrementRateLimit();

      logger.info("[WhatsAppProvider] Message sent", {
        to: to.slice(-4),
        messageId,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("[WhatsAppProvider] Send failed:", error);
      return { success: false, error: errorMessage };
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    parameters?: TemplateParams,
  ): Promise<SendTextResult> {
    if (!this.isAvailable()) {
      return { success: false, error: "WhatsApp not configured" };
    }

    if (!this.checkRateLimit()) {
      return { success: false, error: "Daily message limit reached" };
    }

    try {
      const template: any = {
        name: templateName,
        language: { code: languageCode },
      };

      if (parameters && Object.keys(parameters).length > 0) {
        template.components = [
          {
            type: "body",
            parameters: Object.values(parameters).map((text) => ({
              type: "text",
              text,
            })),
          },
        ];
      }

      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: this.formatPhoneNumber(to),
          type: "template",
          template,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error("[WhatsAppProvider] Template API Error:", {
          status: response.status,
          error: data.error,
          templateName,
        });
        return {
          success: false,
          error: data.error?.message || "Unknown error",
        };
      }

      const messageId = data.messages?.[0]?.id;
      this.incrementRateLimit();

      logger.info("[WhatsAppProvider] Template sent", {
        to: to.slice(-4),
        templateName,
        messageId,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("[WhatsAppProvider] Template send failed:", error);
      return { success: false, error: errorMessage };
    }
  }

  async sendButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string,
  ): Promise<SendTextResult> {
    if (!this.isAvailable()) {
      return { success: false, error: "WhatsApp not configured" };
    }

    if (!this.checkRateLimit()) {
      return { success: false, error: "Daily message limit reached" };
    }

    try {
      const interactive: any = {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title.slice(0, 20) },
          })),
        },
      };

      if (header) interactive.header = { type: "text", text: header };
      if (footer) interactive.footer = { text: footer };

      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: this.formatPhoneNumber(to),
          type: "interactive",
          interactive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error("[WhatsAppProvider] Buttons API Error:", {
          status: response.status,
          error: data.error,
        });
        return {
          success: false,
          error: data.error?.message || "Unknown error",
        };
      }

      const messageId = data.messages?.[0]?.id;
      this.incrementRateLimit();

      return { success: true, messageId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("[WhatsAppProvider] Buttons send failed:", error);
      return { success: false, error: errorMessage };
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("52") && cleaned.length === 12) {
      return cleaned;
    }
    if (cleaned.length === 10 && /^[1-9]/.test(cleaned)) {
      return `52${cleaned}`;
    }
    return cleaned;
  }

  private checkRateLimit(): boolean {
    const today = new Date().toISOString().split("T")[0];
    const currentCount = this.messageCount.get(today) || 0;
    return currentCount < this.config.maxMessagesPerDay;
  }

  private incrementRateLimit(): void {
    const today = new Date().toISOString().split("T")[0];
    const currentCount = this.messageCount.get(today) || 0;
    this.messageCount.set(today, currentCount + 1);
  }
}

// Export singleton instance with default config
export const whatsAppProvider = new WhatsAppProvider();
