/**
 * @file WebSocket Server
 * @description Socket.IO server for real-time updates
 *
 * Features:
 * - JWT authentication
 * - Room-based subscriptions (batches, producers, users)
 * - Reconnection handling
 * - Event broadcasting
 * - Connection metrics
 *
 * @author AgroBridge Engineering Team
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../../shared/utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export interface JWTPayload {
  userId: string;
  role: string;
  jti: string;
  exp: number;
}

export interface WebSocketMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  roomCounts: Record<string, number>;
}

export interface BatchUpdateEvent {
  batchId: string;
  status: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface EventCreatedEvent {
  eventId: string;
  batchId: string;
  eventType: string;
  timestamp: Date;
  locationName?: string;
  isVerified: boolean;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════════════════════════════════════

export class WebSocketServer {
  private static instance: WebSocketServer | null = null;
  private io: Server | null = null;
  private connectionCount: number = 0;

  // Room prefixes
  private readonly ROOM_PREFIX = {
    USER: 'user:',
    BATCH: 'batch:',
    PRODUCER: 'producer:',
    ADMIN: 'admin',
  };

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer();
    }
    return WebSocketServer.instance;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('[WebSocket] Server already initialized');
      return;
    }

    const corsOrigin = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use(this.authMiddleware.bind(this));

    // Connection handler
    this.io.on('connection', this.handleConnection.bind(this));

    logger.info('[WebSocket] Server initialized', {
      corsOrigin,
    });
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): Server | null {
    return this.io;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.io !== null;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): WebSocketMetrics {
    if (!this.io) {
      return {
        totalConnections: 0,
        authenticatedConnections: 0,
        roomCounts: {},
      };
    }

    const sockets = this.io.sockets.sockets;
    let authenticatedCount = 0;
    const roomCounts: Record<string, number> = {};

    sockets.forEach((socket) => {
      const authSocket = socket as AuthenticatedSocket;
      if (authSocket.userId) {
        authenticatedCount++;
      }

      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          roomCounts[room] = (roomCounts[room] || 0) + 1;
        }
      });
    });

    return {
      totalConnections: sockets.size,
      authenticatedConnections: authenticatedCount,
      roomCounts,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // BROADCAST METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Broadcast to a specific user
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(`${this.ROOM_PREFIX.USER}${userId}`).emit(event, data);
  }

  /**
   * Broadcast batch update
   */
  emitBatchUpdate(batchId: string, data: BatchUpdateEvent): void {
    if (!this.io) return;

    // Emit to batch subscribers
    this.io.to(`${this.ROOM_PREFIX.BATCH}${batchId}`).emit('batch:updated', data);

    // Also emit to admins
    this.io.to(this.ROOM_PREFIX.ADMIN).emit('batch:updated', data);

    logger.debug('[WebSocket] Batch update emitted', {
      batchId,
      status: data.status,
    });
  }

  /**
   * Broadcast new event created
   */
  emitEventCreated(data: EventCreatedEvent): void {
    if (!this.io) return;

    // Emit to batch subscribers
    this.io.to(`${this.ROOM_PREFIX.BATCH}${data.batchId}`).emit('event:created', data);

    // Also emit to admins
    this.io.to(this.ROOM_PREFIX.ADMIN).emit('event:created', data);

    logger.debug('[WebSocket] Event created emitted', {
      eventId: data.eventId,
      batchId: data.batchId,
    });
  }

  /**
   * Broadcast notification to user
   */
  emitNotification(userId: string, notification: NotificationEvent): void {
    if (!this.io) return;

    this.io.to(`${this.ROOM_PREFIX.USER}${userId}`).emit('notification', notification);

    logger.debug('[WebSocket] Notification emitted', {
      userId,
      type: notification.type,
    });
  }

  /**
   * Broadcast producer update
   */
  emitProducerUpdate(producerId: string, data: { action: string; details: unknown }): void {
    if (!this.io) return;

    this.io.to(`${this.ROOM_PREFIX.PRODUCER}${producerId}`).emit('producer:updated', data);
    this.io.to(this.ROOM_PREFIX.ADMIN).emit('producer:updated', { producerId, ...data });
  }

  /**
   * Broadcast system announcement
   */
  emitSystemAnnouncement(message: string, data?: Record<string, unknown>): void {
    if (!this.io) return;

    this.io.emit('system:announcement', {
      message,
      data,
      timestamp: new Date(),
    });

    logger.info('[WebSocket] System announcement broadcasted', { message });
  }

  /**
   * Broadcast to all admins
   */
  emitToAdmins(event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(this.ROOM_PREFIX.ADMIN).emit(event, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONNECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Authentication middleware
   */
  private authMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow anonymous connections for public data
      logger.debug('[WebSocket] Anonymous connection', { socketId: socket.id });
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret';
      const decoded = jwt.verify(token, secret) as JWTPayload;

      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      logger.debug('[WebSocket] Authenticated connection', {
        socketId: socket.id,
        userId: decoded.userId,
        role: decoded.role,
      });

      next();
    } catch (error) {
      logger.warn('[WebSocket] Authentication failed', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Allow connection but mark as unauthenticated
      next();
    }
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    this.connectionCount++;

    logger.info('[WebSocket] Client connected', {
      socketId: socket.id,
      userId: socket.userId || 'anonymous',
      role: socket.userRole || 'none',
      transport: socket.conn.transport.name,
    });

    // Auto-join user room if authenticated
    if (socket.userId) {
      socket.join(`${this.ROOM_PREFIX.USER}${socket.userId}`);

      // Join admin room if admin
      if (socket.userRole === 'ADMIN') {
        socket.join(this.ROOM_PREFIX.ADMIN);
      }
    }

    // Subscribe to batch updates
    socket.on('subscribe:batch', (batchId: string) => {
      const room = `${this.ROOM_PREFIX.BATCH}${batchId}`;
      socket.join(room);
      logger.debug('[WebSocket] Subscribed to batch', {
        socketId: socket.id,
        batchId,
      });
      socket.emit('subscribed', { room, batchId });
    });

    // Unsubscribe from batch updates
    socket.on('unsubscribe:batch', (batchId: string) => {
      const room = `${this.ROOM_PREFIX.BATCH}${batchId}`;
      socket.leave(room);
      logger.debug('[WebSocket] Unsubscribed from batch', {
        socketId: socket.id,
        batchId,
      });
    });

    // Subscribe to producer updates
    socket.on('subscribe:producer', (producerId: string) => {
      // Only allow authenticated users to subscribe to producer updates
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      const room = `${this.ROOM_PREFIX.PRODUCER}${producerId}`;
      socket.join(room);
      logger.debug('[WebSocket] Subscribed to producer', {
        socketId: socket.id,
        producerId,
      });
      socket.emit('subscribed', { room, producerId });
    });

    // Unsubscribe from producer updates
    socket.on('unsubscribe:producer', (producerId: string) => {
      const room = `${this.ROOM_PREFIX.PRODUCER}${producerId}`;
      socket.leave(room);
    });

    // Mark notification as read
    socket.on('notification:read', (notificationId: string) => {
      if (!socket.userId) return;

      logger.debug('[WebSocket] Notification marked as read', {
        userId: socket.userId,
        notificationId,
      });

      // Could emit event to update unread count
      socket.emit('notification:readConfirmed', { notificationId });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.connectionCount--;

      logger.info('[WebSocket] Client disconnected', {
        socketId: socket.id,
        userId: socket.userId || 'anonymous',
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('[WebSocket] Socket error', {
        socketId: socket.id,
        error: error.message,
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.io) return;

    logger.info('[WebSocket] Shutting down...');

    // Disconnect all clients
    const sockets = await this.io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    return new Promise((resolve) => {
      this.io!.close(() => {
        logger.info('[WebSocket] Server closed');
        this.io = null;
        resolve();
      });
    });
  }
}

// Export singleton instance
export const webSocketServer = WebSocketServer.getInstance();
export default webSocketServer;
