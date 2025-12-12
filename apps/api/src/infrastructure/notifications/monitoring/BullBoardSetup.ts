/**
 * @file Bull Board Setup
 * @description Queue monitoring dashboard for notification system
 *
 * Bull Board provides:
 * 1. Real-time queue visualization
 * 2. Job inspection and debugging
 * 3. Manual job retry/removal
 * 4. Queue pausing/resuming
 * 5. Performance metrics
 *
 * Access: /admin/queues (protected by admin auth)
 *
 * @author AgroBridge Engineering Team
 * @see https://github.com/felixmosh/bull-board
 */

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { notificationQueue } from '../queue/NotificationQueue.js';
import logger from '../../../shared/utils/logger.js';

/**
 * Bull Board Setup
 *
 * Creates and configures the Bull Board monitoring dashboard
 */
export class BullBoardSetup {
  private static instance: BullBoardSetup | null = null;
  private serverAdapter: ExpressAdapter;
  private initialized: boolean = false;

  private constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BullBoardSetup {
    if (!BullBoardSetup.instance) {
      BullBoardSetup.instance = new BullBoardSetup();
    }
    return BullBoardSetup.instance;
  }

  /**
   * Initialize Bull Board with queue
   */
  public initialize(): ExpressAdapter {
    if (this.initialized) {
      return this.serverAdapter;
    }

    try {
      const queue = notificationQueue.getQueue();

      if (!queue) {
        logger.warn('[BullBoard] Queue not available, dashboard will be limited');
        return this.serverAdapter;
      }

      createBullBoard({
        queues: [new BullAdapter(queue)],
        serverAdapter: this.serverAdapter,
        options: {
          uiConfig: {
            boardTitle: 'AgroBridge Notifications',
            boardLogo: {
              path: 'https://app.agrobridge.io/logo.png',
              width: '100px',
              height: 'auto',
            },
            favIcon: {
              default: 'https://app.agrobridge.io/favicon.ico',
              alternative: 'https://app.agrobridge.io/favicon.ico',
            },
          },
        },
      });

      this.initialized = true;

      logger.info('[BullBoard] Dashboard initialized', {
        basePath: '/admin/queues',
      });

      return this.serverAdapter;
    } catch (error) {
      const err = error as Error;
      logger.error('[BullBoard] Failed to initialize dashboard', {
        error: err.message,
      });

      return this.serverAdapter;
    }
  }

  /**
   * Get Express router for mounting
   */
  public getRouter() {
    this.initialize();
    return this.serverAdapter.getRouter();
  }
}

// Export singleton instance
export const bullBoardSetup = BullBoardSetup.getInstance();
export default bullBoardSetup;
