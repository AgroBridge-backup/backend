/**
 * WhatsApp Bot Types - Meta Cloud API Integration
 * @module whatsapp-bot/types
 */

// ============================================================================
// META WHATSAPP CLOUD API TYPES
// ============================================================================

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: {
    messaging_product: "whatsapp";
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WebhookContact[];
    messages?: IncomingMessage[];
    statuses?: MessageStatus[];
  };
  field: "messages";
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "interactive" | "button" | "image" | "document" | "location";
  text?: {
    body: string;
  };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    payload: string;
    text: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface MessageStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}

// ============================================================================
// OUTGOING MESSAGE TYPES
// ============================================================================

export interface SendMessageRequest {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "interactive" | "template";
  text?: {
    preview_url?: boolean;
    body: string;
  };
  interactive?: InteractiveMessage;
  template?: TemplateMessage;
}

export interface InteractiveMessage {
  type: "button" | "list";
  header?: {
    type: "text" | "image" | "document";
    text?: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: InteractiveAction;
}

export interface InteractiveAction {
  button?: string;
  buttons?: Array<{
    type: "reply";
    reply: {
      id: string;
      title: string;
    };
  }>;
  sections?: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters?: Array<{
    type: "text" | "currency" | "date_time" | "image";
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
  }>;
  sub_type?: "url" | "quick_reply";
  index?: number;
}

// ============================================================================
// SESSION & CONVERSATION TYPES
// ============================================================================

export type ConversationState =
  | "IDLE"
  | "MAIN_MENU"
  | "REQUESTING_ADVANCE"
  | "SELECTING_ORDER"
  | "CONFIRMING_ADVANCE"
  | "CHECKING_BALANCE"
  | "VIEWING_PAYMENTS"
  | "MAKING_PAYMENT"
  | "CUSTOMER_SUPPORT"
  | "AWAITING_RESPONSE";

export interface WhatsAppSession {
  id: string;
  phoneNumber: string;
  userId?: string;
  producerId?: string;
  state: ConversationState;
  context: SessionContext;
  language: "es" | "en";
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionContext {
  selectedOrderId?: string;
  selectedAdvanceId?: string;
  pendingAmount?: number;
  awaitingConfirmation?: boolean;
  lastIntent?: UserIntent;
  customData?: Record<string, unknown>;
}

export type UserIntent =
  | "REQUEST_ADVANCE"
  | "CHECK_BALANCE"
  | "VIEW_PAYMENTS"
  | "MAKE_PAYMENT"
  | "CUSTOMER_SUPPORT"
  | "GREETING"
  | "THANKS"
  | "UNKNOWN";

// ============================================================================
// BOT CONFIGURATION
// ============================================================================

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  businessAccountId: string;
  apiVersion: string;
  baseUrl: string;
  webhookPath: string;
  maxSessionDuration: number; // minutes
  maxMessagesPerDay: number;
  supportedLanguages: string[];
}

// ============================================================================
// MESSAGE TEMPLATES (for structured responses)
// ============================================================================

export interface BotResponse {
  type: "text" | "interactive" | "template";
  content: string | InteractiveMessage | TemplateMessage;
  quickReplies?: string[];
}

export interface MenuOption {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
}
