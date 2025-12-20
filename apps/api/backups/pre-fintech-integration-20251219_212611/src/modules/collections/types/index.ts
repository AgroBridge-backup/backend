/**
 * Collections System Types
 * @module collections/types
 */

export type CollectionStage =
  | 'FRIENDLY_REMINDER'    // 3 days before due
  | 'FINAL_NOTICE'         // Due today
  | 'OVERDUE_1'            // 1 day overdue
  | 'OVERDUE_3'            // 3 days overdue
  | 'LATE_FEE_WARNING'     // 7 days overdue
  | 'ACCOUNT_REVIEW'       // 14 days overdue
  | 'COLLECTIONS_HANDOFF'  // 30+ days, manual collections
  | 'LEGAL_WARNING';       // 60+ days

export type CollectionChannel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH' | 'CALL';

export type CollectionStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export interface CollectionRule {
  stage: CollectionStage;
  daysFromDue: number;        // Negative = before due, positive = after due
  channels: CollectionChannel[];
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  templateKey: string;
  requiresAck: boolean;       // Require acknowledgment
  escalateAfterHours: number; // Escalate if no response
  maxAttempts: number;
}

export interface CollectionAttempt {
  id: string;
  advanceId: string;
  stage: CollectionStage;
  channel: CollectionChannel;
  status: CollectionStatus;
  messageId?: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  response?: string;
  error?: string;
  attemptNumber: number;
}

export interface CollectionTarget {
  advanceId: string;
  contractNumber: string;
  farmerId: string;
  farmerName: string;
  phoneNumber: string;
  email?: string;
  amount: number;
  dueDate: Date;
  daysFromDue: number;
  currentStage: CollectionStage;
  previousAttempts: number;
  lastAttemptAt?: Date;
  optedOut: boolean;
}

export interface CollectionSummary {
  date: Date;
  totalProcessed: number;
  byStage: Record<CollectionStage, number>;
  byStatus: Record<CollectionStatus, number>;
  byChannel: Record<CollectionChannel, number>;
  errors: string[];
}

export interface LateFeeCalculation {
  advanceId: string;
  originalAmount: number;
  daysOverdue: number;
  feePercentage: number;
  feeAmount: number;
  totalDue: number;
  cappedAt: number;           // Max fee cap (e.g., 20%)
}
