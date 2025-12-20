/**
 * Repayments Module
 * Payment processing and tracking for advances
 *
 * Features:
 * - Payment recording (manual & webhook)
 * - Balance breakdown with late fees
 * - Payment schedule management
 * - Payment history
 * - Due date extensions
 * - Aging reports
 *
 * @module repayments
 */

export { repaymentService } from './services/repayment.service.js';
export * from './types/index.js';
