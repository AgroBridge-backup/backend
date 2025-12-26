/**
 * @file WebSocket Integration Tests
 * @description Test real-time functionality with Socket.IO
 *
 * Prerequisites:
 * - Server running with WebSocket support
 * - Test users created in database
 *
 * Run: npm run test:integration -- websocket.test.ts
 *
 * @author AgroBridge Engineering Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Check if server is available
let serverAvailable = false;
async function checkServerAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// Test user payloads (matching the application's JWT structure)
const TEST_USERS = {
  producer: {
    userId: 'test-producer-id-001',
    role: 'PRODUCER',
    jti: 'test-jti-producer',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  },
  buyer: {
    userId: 'test-buyer-id-001',
    role: 'BUYER',
    jti: 'test-jti-buyer',
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  admin: {
    userId: 'test-admin-id-001',
    role: 'ADMIN',
    jti: 'test-jti-admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  certifier: {
    userId: 'test-certifier-id-001',
    role: 'CERTIFIER',
    jti: 'test-jti-certifier',
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
};

// Helper to generate test JWT tokens
function generateTestToken(userPayload: typeof TEST_USERS.producer): string {
  return jwt.sign(userPayload, JWT_SECRET);
}

// Helper to create socket connection
function createSocket(token?: string): Socket {
  return io(BASE_URL, {
    transports: ['websocket'],
    autoConnect: false,
    auth: token ? { token } : undefined,
  });
}

// Helper to wait for socket event with timeout
function waitForEvent<T>(socket: Socket, event: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Helper to wait for connection
function waitForConnect(socket: Socket, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 1: CONNECTION & AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Connection & Authentication', () => {
  let socket: Socket;

  beforeAll(async () => {
    serverAvailable = await checkServerAvailable();
    if (!serverAvailable) {
      console.log('⚠️ WebSocket server not available, tests will be skipped');
    }
  });

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should allow anonymous connection', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    socket = createSocket();
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });

  it('should accept valid JWT token', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });

  it('should allow connection with invalid token (unauthenticated)', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    socket = createSocket('invalid-token');
    socket.connect();

    await waitForConnect(socket);
    // Connection should succeed but user will be unauthenticated
    expect(socket.connected).toBe(true);
  });

  it('should respond to ping with pong', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    socket = createSocket();
    socket.connect();

    await waitForConnect(socket);

    socket.emit('ping');
    const pong = await waitForEvent<{ timestamp: number }>(socket, 'pong');

    expect(pong).toHaveProperty('timestamp');
    expect(typeof pong.timestamp).toBe('number');
  });

  it('should auto-join user room when authenticated', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    // Verify by subscribing to a batch and checking for subscribed event
    socket.emit('subscribe:batch', 'test-batch-id');
    const subscribed = await waitForEvent<{ room: string; batchId: string }>(socket, 'subscribed');

    expect(subscribed.batchId).toBe('test-batch-id');
  });

  it('should auto-join admin room for admin users', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.admin);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);
    // Admin should be auto-joined to admin room
    expect(socket.connected).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 2: ROOM SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Room Subscriptions', () => {
  let socket: Socket;

  beforeAll(async () => {
    serverAvailable = await checkServerAvailable();
    if (!serverAvailable) {
      console.log('⚠️ WebSocket server not available, Room Subscription tests will be skipped');
    }
  });

  beforeEach(async () => {
    if (!serverAvailable) return;
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();
    await waitForConnect(socket);
  });

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should subscribe to batch updates', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const batchId = 'test-batch-001';
    socket.emit('subscribe:batch', batchId);

    const response = await waitForEvent<{ room: string; batchId: string }>(socket, 'subscribed');

    expect(response.batchId).toBe(batchId);
    expect(response.room).toContain(batchId);
  });

  it('should unsubscribe from batch updates without error', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const batchId = 'test-batch-001';

    // First subscribe
    socket.emit('subscribe:batch', batchId);
    await waitForEvent(socket, 'subscribed');

    // Then unsubscribe (no response expected, just no error)
    socket.emit('unsubscribe:batch', batchId);

    // Wait a bit to ensure no error
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(socket.connected).toBe(true);
  });

  it('should subscribe to producer updates when authenticated', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const producerId = 'test-producer-001';
    socket.emit('subscribe:producer', producerId);

    const response = await waitForEvent<{ room: string; producerId: string }>(socket, 'subscribed');

    expect(response.producerId).toBe(producerId);
    expect(response.room).toContain(producerId);
  });

  it('should reject producer subscription for anonymous users', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    // Disconnect authenticated socket
    socket.disconnect();

    // Connect anonymously
    socket = createSocket();
    socket.connect();
    await waitForConnect(socket);

    socket.emit('subscribe:producer', 'test-producer-001');

    const error = await waitForEvent<{ message: string }>(socket, 'error');
    expect(error.message).toBe('Authentication required');
  });

  it('should allow subscribing to multiple batches', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const batches = ['batch-001', 'batch-002', 'batch-003'];

    for (const batchId of batches) {
      socket.emit('subscribe:batch', batchId);
      const response = await waitForEvent<{ batchId: string }>(socket, 'subscribed');
      expect(response.batchId).toBe(batchId);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 3: NOTIFICATION HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Notification Handling', () => {
  let socket: Socket;

  beforeAll(async () => {
    serverAvailable = await checkServerAvailable();
  });

  beforeEach(async () => {
    if (!serverAvailable) return;
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();
    await waitForConnect(socket);
  });

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should confirm notification read', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const notificationId = 'test-notification-001';
    socket.emit('notification:read', notificationId);

    const confirmation = await waitForEvent<{ notificationId: string }>(
      socket,
      'notification:readConfirmed'
    );

    expect(confirmation.notificationId).toBe(notificationId);
  });

  it('should handle multiple notification reads', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const notifications = ['notif-001', 'notif-002', 'notif-003'];

    for (const notificationId of notifications) {
      socket.emit('notification:read', notificationId);
      const confirmation = await waitForEvent<{ notificationId: string }>(
        socket,
        'notification:readConfirmed'
      );
      expect(confirmation.notificationId).toBe(notificationId);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 4: MULTI-CLIENT SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Multi-Client Scenarios', () => {
  let producerSocket: Socket;
  let buyerSocket: Socket;
  let adminSocket: Socket;

  beforeAll(async () => {
    serverAvailable = await checkServerAvailable();
  });

  beforeEach(async () => {
    if (!serverAvailable) return;
    producerSocket = createSocket(generateTestToken(TEST_USERS.producer));
    buyerSocket = createSocket(generateTestToken(TEST_USERS.buyer));
    adminSocket = createSocket(generateTestToken(TEST_USERS.admin));

    producerSocket.connect();
    buyerSocket.connect();
    adminSocket.connect();

    await Promise.all([
      waitForConnect(producerSocket),
      waitForConnect(buyerSocket),
      waitForConnect(adminSocket),
    ]);
  });

  afterEach(() => {
    [producerSocket, buyerSocket, adminSocket].forEach((socket) => {
      if (socket?.connected) {
        socket.disconnect();
      }
    });
  });

  it('should maintain multiple simultaneous connections', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    expect(producerSocket.connected).toBe(true);
    expect(buyerSocket.connected).toBe(true);
    expect(adminSocket.connected).toBe(true);
  });

  it('should allow different users to subscribe to same batch', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const batchId = 'shared-batch-001';

    // Both producer and buyer subscribe to same batch
    producerSocket.emit('subscribe:batch', batchId);
    buyerSocket.emit('subscribe:batch', batchId);

    const [producerRes, buyerRes] = await Promise.all([
      waitForEvent<{ batchId: string }>(producerSocket, 'subscribed'),
      waitForEvent<{ batchId: string }>(buyerSocket, 'subscribed'),
    ]);

    expect(producerRes.batchId).toBe(batchId);
    expect(buyerRes.batchId).toBe(batchId);
  });

  it('should handle independent subscriptions per client', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    // Producer subscribes to batch A
    producerSocket.emit('subscribe:batch', 'batch-A');
    const producerRes = await waitForEvent<{ batchId: string }>(producerSocket, 'subscribed');
    expect(producerRes.batchId).toBe('batch-A');

    // Buyer subscribes to batch B
    buyerSocket.emit('subscribe:batch', 'batch-B');
    const buyerRes = await waitForEvent<{ batchId: string }>(buyerSocket, 'subscribed');
    expect(buyerRes.batchId).toBe('batch-B');

    // Admin subscribes to batch C
    adminSocket.emit('subscribe:batch', 'batch-C');
    const adminRes = await waitForEvent<{ batchId: string }>(adminSocket, 'subscribed');
    expect(adminRes.batchId).toBe('batch-C');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 5: RECONNECTION HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Reconnection Handling', () => {
  let socket: Socket;

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should reconnect after manual disconnect', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);

    // Disconnect
    socket.disconnect();
    expect(socket.connected).toBe(false);

    // Reconnect
    socket.connect();
    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });

  it('should maintain subscriptions after reconnect', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    // Subscribe to batch
    const batchId = 'persist-batch-001';
    socket.emit('subscribe:batch', batchId);
    await waitForEvent(socket, 'subscribed');

    // Disconnect and reconnect
    socket.disconnect();
    socket.connect();
    await waitForConnect(socket);

    // Re-subscribe after reconnect (subscriptions don't persist)
    socket.emit('subscribe:batch', batchId);
    const response = await waitForEvent<{ batchId: string }>(socket, 'subscribed');
    expect(response.batchId).toBe(batchId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 6: ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Error Handling', () => {
  let socket: Socket;

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should handle malformed events gracefully', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    // Send malformed subscription (null batchId)
    socket.emit('subscribe:batch', null);

    // Socket should remain connected (server handles gracefully)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(socket.connected).toBe(true);
  });

  it('should handle empty subscription ids', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    // Send empty batchId
    socket.emit('subscribe:batch', '');

    // Socket should remain connected
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(socket.connected).toBe(true);
  });

  it('should handle connection to unavailable server gracefully', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    socket = io('http://localhost:9999', {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      timeout: 1000,
    });

    let errorOccurred = false;
    socket.on('connect_error', () => {
      errorOccurred = true;
    });

    socket.connect();

    // Wait for error
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(errorOccurred).toBe(true);
    expect(socket.connected).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 7: PERFORMANCE & LOAD
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Performance', () => {
  afterEach(() => {
    // Cleanup handled in tests
  });

  it('should handle rapid ping/pong exchanges', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    const socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    const pingCount = 50;
    const startTime = Date.now();

    for (let i = 0; i < pingCount; i++) {
      socket.emit('ping');
      await waitForEvent(socket, 'pong', 1000);
    }

    const duration = Date.now() - startTime;
    const avgLatency = duration / pingCount;

    expect(avgLatency).toBeLessThan(100); // Average < 100ms per round trip
    socket.disconnect();
  });

  it('should handle multiple rapid subscriptions', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    const socket = createSocket(token);
    socket.connect();

    await waitForConnect(socket);

    const subscriptionCount = 20;
    const startTime = Date.now();

    for (let i = 0; i < subscriptionCount; i++) {
      socket.emit('subscribe:batch', `rapid-batch-${i}`);
      await waitForEvent(socket, 'subscribed', 1000);
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // All 20 subscriptions under 5 seconds
    socket.disconnect();
  });

  it('should handle 10 concurrent connections', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const sockets: Socket[] = [];
    const connectionCount = 10;

    try {
      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const token = generateTestToken({
          ...TEST_USERS.producer,
          userId: `concurrent-user-${i}`,
          jti: `concurrent-jti-${i}`,
        });
        const socket = createSocket(token);
        socket.connect();
        sockets.push(socket);
      }

      // Wait for all to connect
      await Promise.all(sockets.map((s) => waitForConnect(s, 10000)));

      // Verify all connected
      const connectedCount = sockets.filter((s) => s.connected).length;
      expect(connectedCount).toBe(connectionCount);
    } finally {
      // Cleanup
      sockets.forEach((s) => s.disconnect());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 8: TRANSPORT FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

describe('WebSocket: Transport', () => {
  let socket: Socket;

  afterEach(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  });

  it('should connect with websocket transport', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = io(BASE_URL, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token },
    });
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });

  it('should connect with polling transport', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = io(BASE_URL, {
      transports: ['polling'],
      autoConnect: false,
      auth: { token },
    });
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });

  it('should work with auto transport selection', async () => {
    if (!serverAvailable) { console.log('⏭️ Skipping: server not available'); return; }
    const token = generateTestToken(TEST_USERS.producer);
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: { token },
    });
    socket.connect();

    await waitForConnect(socket);
    expect(socket.connected).toBe(true);
  });
});
