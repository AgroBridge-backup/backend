/**
 * @file Bull Board Setup
 * @description Queue monitoring dashboard for all background job queues
 *
 * Bull Board provides:
 * 1. Real-time queue visualization
 * 2. Job inspection and debugging
 * 3. Manual job retry/removal
 * 4. Queue pausing/resuming
 * 5. Performance metrics
 *
 * Monitored Queues:
 * - notifications: Push/Email/SMS notifications
 * - qr-generation: QR code generation for batches
 * - blockchain-tx: Blockchain transactions
 * - email: Queue-based email sending
 * - reports: Report generation (PDF/CSV/XLSX)
 *
 * Access: /admin/queues (protected by admin auth)
 *
 * @author AgroBridge Engineering Team
 * @see https://github.com/felixmosh/bull-board
 */

import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter.js";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bull";
import { notificationQueue } from "../queue/NotificationQueue.js";
import { queueService } from "../../queue/index.js";
import logger from "../../../shared/utils/logger.js";

/**
 * Bull Board Setup
 *
 * Creates and configures the Bull Board monitoring dashboard
 * Aggregates all application queues into a single dashboard
 */
export class BullBoardSetup {
  private static instance: BullBoardSetup | null = null;
  private serverAdapter: ExpressAdapter;
  private initialized: boolean = false;

  private constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath("/admin/queues");
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
   * Initialize Bull Board with all queues
   */
  public initialize(): ExpressAdapter {
    if (this.initialized) {
      return this.serverAdapter;
    }

    try {
      const queues: Queue[] = [];

      // Add notification queue
      const notifQueue = notificationQueue.getQueue();
      if (notifQueue) {
        queues.push(notifQueue);
      }

      // Add background job queues from QueueService
      const backgroundQueues = queueService.getAllQueues();
      queues.push(...backgroundQueues);

      if (queues.length === 0) {
        logger.warn("[BullBoard] No queues available, dashboard will be empty");
        return this.serverAdapter;
      }

      createBullBoard({
        queues: queues.map((q) => new BullAdapter(q)),
        serverAdapter: this.serverAdapter,
        options: {
          uiConfig: {
            boardTitle: "AgroBridge Job Queues",
            boardLogo: {
              path: "https://app.agrobridge.io/logo.png",
              width: "100px",
              height: "auto",
            },
            favIcon: {
              default: "https://app.agrobridge.io/favicon.ico",
              alternative: "https://app.agrobridge.io/favicon.ico",
            },
          },
        },
      });

      this.initialized = true;

      logger.info("[BullBoard] Dashboard initialized", {
        basePath: "/admin/queues",
        queueCount: queues.length,
        queues: queues.map((q) => q.name),
      });

      return this.serverAdapter;
    } catch (error) {
      const err = error as Error;
      logger.error("[BullBoard] Failed to initialize dashboard", {
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

  /**
   * Re-initialize with updated queues
   * Call this after QueueService.initialize() if needed
   */
  public reinitialize(): ExpressAdapter {
    this.initialized = false;
    return this.initialize();
  }
}

// Export singleton instance
export const bullBoardSetup = BullBoardSetup.getInstance();
export default bullBoardSetup;
