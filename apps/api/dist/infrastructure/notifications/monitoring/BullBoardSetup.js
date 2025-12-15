import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { notificationQueue } from '../queue/NotificationQueue.js';
import { queueService } from '../../queue/index.js';
import logger from '../../../shared/utils/logger.js';
export class BullBoardSetup {
    static instance = null;
    serverAdapter;
    initialized = false;
    constructor() {
        this.serverAdapter = new ExpressAdapter();
        this.serverAdapter.setBasePath('/admin/queues');
    }
    static getInstance() {
        if (!BullBoardSetup.instance) {
            BullBoardSetup.instance = new BullBoardSetup();
        }
        return BullBoardSetup.instance;
    }
    initialize() {
        if (this.initialized) {
            return this.serverAdapter;
        }
        try {
            const queues = [];
            const notifQueue = notificationQueue.getQueue();
            if (notifQueue) {
                queues.push(notifQueue);
            }
            const backgroundQueues = queueService.getAllQueues();
            queues.push(...backgroundQueues);
            if (queues.length === 0) {
                logger.warn('[BullBoard] No queues available, dashboard will be empty');
                return this.serverAdapter;
            }
            createBullBoard({
                queues: queues.map(q => new BullAdapter(q)),
                serverAdapter: this.serverAdapter,
                options: {
                    uiConfig: {
                        boardTitle: 'AgroBridge Job Queues',
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
                queueCount: queues.length,
                queues: queues.map(q => q.name),
            });
            return this.serverAdapter;
        }
        catch (error) {
            const err = error;
            logger.error('[BullBoard] Failed to initialize dashboard', {
                error: err.message,
            });
            return this.serverAdapter;
        }
    }
    getRouter() {
        this.initialize();
        return this.serverAdapter.getRouter();
    }
    reinitialize() {
        this.initialized = false;
        return this.initialize();
    }
}
export const bullBoardSetup = BullBoardSetup.getInstance();
export default bullBoardSetup;
