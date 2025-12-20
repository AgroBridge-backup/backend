/**
 * Collections Module
 * Automated payment reminders and collections system
 *
 * Features:
 * - Daily cron job at 8 AM CST
 * - Graduated reminder stages
 * - Multi-channel delivery (WhatsApp, SMS, Email, Push)
 * - Late fee calculation
 * - Automatic status updates
 * - Opt-out handling
 *
 * @module collections
 */

export { collectionService } from './services/collection.service';
export {
  initCollectionsCron,
  runCollectionsManually,
  getCollectionsCronStatus,
} from './jobs/collections.cron';
export * from './types';
