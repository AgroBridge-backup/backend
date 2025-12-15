import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as fs from 'node:fs';
import * as path from 'node:path';
import logger from '../../shared/utils/logger.js';
let JWT_PUBLIC_KEY = null;
function getJwtPublicKey() {
    if (JWT_PUBLIC_KEY) {
        return JWT_PUBLIC_KEY;
    }
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || './jwtRS256.key.pub';
    const resolvedPath = path.resolve(process.cwd(), publicKeyPath);
    try {
        JWT_PUBLIC_KEY = fs.readFileSync(resolvedPath, 'utf-8');
        logger.info('[WebSocket] JWT public key loaded successfully');
        return JWT_PUBLIC_KEY;
    }
    catch (error) {
        logger.error('[WebSocket] Failed to load JWT public key', {
            path: resolvedPath,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`JWT public key not found at ${resolvedPath}. WebSocket authentication will not work.`);
    }
}
export class WebSocketServer {
    static instance = null;
    io = null;
    connectionCount = 0;
    ROOM_PREFIX = {
        USER: 'user:',
        BATCH: 'batch:',
        PRODUCER: 'producer:',
        ADMIN: 'admin',
    };
    constructor() {
    }
    static getInstance() {
        if (!WebSocketServer.instance) {
            WebSocketServer.instance = new WebSocketServer();
        }
        return WebSocketServer.instance;
    }
    initialize(httpServer) {
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
        this.io.use(this.authMiddleware.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
        logger.info('[WebSocket] Server initialized', {
            corsOrigin,
        });
    }
    getIO() {
        return this.io;
    }
    isRunning() {
        return this.io !== null;
    }
    getMetrics() {
        if (!this.io) {
            return {
                totalConnections: 0,
                authenticatedConnections: 0,
                roomCounts: {},
            };
        }
        const sockets = this.io.sockets.sockets;
        let authenticatedCount = 0;
        const roomCounts = {};
        sockets.forEach((socket) => {
            const authSocket = socket;
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
    emitToUser(userId, event, data) {
        if (!this.io)
            return;
        this.io.to(`${this.ROOM_PREFIX.USER}${userId}`).emit(event, data);
    }
    emitBatchUpdate(batchId, data) {
        if (!this.io)
            return;
        this.io.to(`${this.ROOM_PREFIX.BATCH}${batchId}`).emit('batch:updated', data);
        this.io.to(this.ROOM_PREFIX.ADMIN).emit('batch:updated', data);
        logger.debug('[WebSocket] Batch update emitted', {
            batchId,
            status: data.status,
        });
    }
    emitEventCreated(data) {
        if (!this.io)
            return;
        this.io.to(`${this.ROOM_PREFIX.BATCH}${data.batchId}`).emit('event:created', data);
        this.io.to(this.ROOM_PREFIX.ADMIN).emit('event:created', data);
        logger.debug('[WebSocket] Event created emitted', {
            eventId: data.eventId,
            batchId: data.batchId,
        });
    }
    emitNotification(userId, notification) {
        if (!this.io)
            return;
        this.io.to(`${this.ROOM_PREFIX.USER}${userId}`).emit('notification', notification);
        logger.debug('[WebSocket] Notification emitted', {
            userId,
            type: notification.type,
        });
    }
    emitProducerUpdate(producerId, data) {
        if (!this.io)
            return;
        this.io.to(`${this.ROOM_PREFIX.PRODUCER}${producerId}`).emit('producer:updated', data);
        this.io.to(this.ROOM_PREFIX.ADMIN).emit('producer:updated', { producerId, ...data });
    }
    emitSystemAnnouncement(message, data) {
        if (!this.io)
            return;
        this.io.emit('system:announcement', {
            message,
            data,
            timestamp: new Date(),
        });
        logger.info('[WebSocket] System announcement broadcasted', { message });
    }
    emitToAdmins(event, data) {
        if (!this.io)
            return;
        this.io.to(this.ROOM_PREFIX.ADMIN).emit(event, data);
    }
    authMiddleware(socket, next) {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
            logger.debug('[WebSocket] Anonymous connection', { socketId: socket.id });
            return next();
        }
        try {
            const publicKey = getJwtPublicKey();
            const decoded = jwt.verify(token, publicKey, {
                algorithms: ['RS256']
            });
            socket.userId = decoded.sub;
            socket.userRole = decoded.role;
            logger.debug('[WebSocket] Authenticated connection', {
                socketId: socket.id,
                userId: decoded.sub,
                role: decoded.role,
            });
            next();
        }
        catch (error) {
            logger.warn('[WebSocket] Authentication failed', {
                socketId: socket.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            if (error instanceof jwt.TokenExpiredError) {
                return next(new Error('Token expired'));
            }
            if (error instanceof jwt.JsonWebTokenError) {
                return next(new Error('Invalid token'));
            }
            next();
        }
    }
    handleConnection(socket) {
        this.connectionCount++;
        logger.info('[WebSocket] Client connected', {
            socketId: socket.id,
            userId: socket.userId || 'anonymous',
            role: socket.userRole || 'none',
            transport: socket.conn.transport.name,
        });
        if (socket.userId) {
            socket.join(`${this.ROOM_PREFIX.USER}${socket.userId}`);
            if (socket.userRole === 'ADMIN') {
                socket.join(this.ROOM_PREFIX.ADMIN);
            }
        }
        socket.on('subscribe:batch', (batchId) => {
            const room = `${this.ROOM_PREFIX.BATCH}${batchId}`;
            socket.join(room);
            logger.debug('[WebSocket] Subscribed to batch', {
                socketId: socket.id,
                batchId,
            });
            socket.emit('subscribed', { room, batchId });
        });
        socket.on('unsubscribe:batch', (batchId) => {
            const room = `${this.ROOM_PREFIX.BATCH}${batchId}`;
            socket.leave(room);
            logger.debug('[WebSocket] Unsubscribed from batch', {
                socketId: socket.id,
                batchId,
            });
        });
        socket.on('subscribe:producer', (producerId) => {
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
        socket.on('unsubscribe:producer', (producerId) => {
            const room = `${this.ROOM_PREFIX.PRODUCER}${producerId}`;
            socket.leave(room);
        });
        socket.on('notification:read', (notificationId) => {
            if (!socket.userId)
                return;
            logger.debug('[WebSocket] Notification marked as read', {
                userId: socket.userId,
                notificationId,
            });
            socket.emit('notification:readConfirmed', { notificationId });
        });
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
        socket.on('disconnect', (reason) => {
            this.connectionCount--;
            logger.info('[WebSocket] Client disconnected', {
                socketId: socket.id,
                userId: socket.userId || 'anonymous',
                reason,
            });
        });
        socket.on('error', (error) => {
            logger.error('[WebSocket] Socket error', {
                socketId: socket.id,
                error: error.message,
            });
        });
    }
    async shutdown() {
        if (!this.io)
            return;
        logger.info('[WebSocket] Shutting down...');
        const sockets = await this.io.fetchSockets();
        for (const socket of sockets) {
            socket.disconnect(true);
        }
        return new Promise((resolve) => {
            this.io.close(() => {
                logger.info('[WebSocket] Server closed');
                this.io = null;
                resolve();
            });
        });
    }
}
export const webSocketServer = WebSocketServer.getInstance();
export default webSocketServer;
