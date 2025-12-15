/**
 * @file k6 Load Test Helpers
 * @description Helper functions for k6 tests
 *
 * @author AgroBridge Engineering Team
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { VARIETIES, EVENT_TYPES, GRAPHQL_URL } from './config.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const errorRate = new Rate('errors');
export const authDuration = new Trend('auth_duration');
export const batchListDuration = new Trend('batch_list_duration');
export const batchCreateDuration = new Trend('batch_create_duration');
export const eventCreateDuration = new Trend('event_create_duration');
export const graphqlDuration = new Trend('graphql_duration');
export const cacheHitRate = new Trend('cache_hit_rate');

export const successfulRequests = new Counter('successful_requests');
export const failedRequests = new Counter('failed_requests');
export const batchesCreated = new Counter('batches_created');
export const eventsCreated = new Counter('events_created');

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Authenticate and get JWT token
 */
export function authenticate(baseUrl, email, password) {
  const start = Date.now();

  const loginRes = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login' },
    }
  );

  authDuration.add(Date.now() - start);

  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.accessToken !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (success && loginRes.status === 200) {
    try {
      const data = loginRes.json('data');
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Create authenticated headers
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP REQUEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Make authenticated GET request
 */
export function authenticatedGet(url, token, tags = {}) {
  const headers = token ? authHeaders(token) : { 'Content-Type': 'application/json' };
  const res = http.get(url, { headers, tags });
  recordResult(res);
  return res;
}

/**
 * Make authenticated POST request
 */
export function authenticatedPost(url, body, token, tags = {}) {
  const res = http.post(url, JSON.stringify(body), {
    headers: authHeaders(token),
    tags,
  });
  recordResult(res);
  return res;
}

/**
 * Make authenticated PUT request
 */
export function authenticatedPut(url, body, token, tags = {}) {
  const res = http.put(url, JSON.stringify(body), {
    headers: authHeaders(token),
    tags,
  });
  recordResult(res);
  return res;
}

/**
 * Make authenticated DELETE request
 */
export function authenticatedDelete(url, token, tags = {}) {
  const res = http.del(url, null, {
    headers: authHeaders(token),
    tags,
  });
  recordResult(res);
  return res;
}

/**
 * Make GraphQL request
 */
export function graphqlRequest(query, variables, token, tags = {}) {
  const start = Date.now();

  const res = http.post(
    GRAPHQL_URL,
    JSON.stringify({ query, variables }),
    {
      headers: authHeaders(token),
      tags: { ...tags, endpoint: 'graphql_query' },
    }
  );

  graphqlDuration.add(Date.now() - start);
  recordResult(res);

  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate random batch data matching Prisma schema
 */
export function generateBatchData() {
  const origins = [
    'Michoacan, Mexico',
    'Jalisco, Mexico',
    'Guanajuato, Mexico',
    'Sinaloa, Mexico',
    'Sonora, Mexico',
    'Baja California, Mexico',
    'Nayarit, Mexico',
    'Colima, Mexico',
  ];

  return {
    variety: VARIETIES[Math.floor(Math.random() * VARIETIES.length)],
    origin: origins[Math.floor(Math.random() * origins.length)],
    weightKg: Math.floor(Math.random() * 900) + 100, // 100-1000 kg
    harvestDate: new Date().toISOString(),
    blockchainHash: `0x${generateRandomHex(64)}`,
  };
}

/**
 * Generate random event data matching Prisma schema
 */
export function generateEventData(batchId) {
  const locationNames = [
    'Farm Storage Facility',
    'Processing Center A',
    'Quality Lab',
    'Packaging Station',
    'Distribution Hub',
    'Port of Lazaro Cardenas',
    'Customs Office',
    'Final Destination',
  ];

  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];

  return {
    batchId,
    eventType,
    timestamp: new Date().toISOString(),
    latitude: 19.4 + Math.random() * 2, // Mexico latitude range
    longitude: -99.1 - Math.random() * 5, // Mexico longitude range
    locationName: locationNames[Math.floor(Math.random() * locationNames.length)],
    temperature: 15 + Math.random() * 15, // 15-30 degrees
    humidity: 40 + Math.random() * 40, // 40-80%
    notes: `${eventType} event created during load test at ${Date.now()}`,
  };
}

/**
 * Generate random hex string
 */
function generateRandomHex(length) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate random producer data
 */
export function generateProducerData() {
  const states = ['Michoacan', 'Jalisco', 'Guanajuato', 'Sinaloa', 'Sonora'];
  const municipalities = ['Uruapan', 'Zapopan', 'Leon', 'Culiacan', 'Hermosillo'];

  return {
    businessName: `Test Farm ${Date.now()}`,
    rfc: `RFC${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 100)}`,
    state: states[Math.floor(Math.random() * states.length)],
    municipality: municipalities[Math.floor(Math.random() * municipalities.length)],
    latitude: 19.4 + Math.random() * 2,
    longitude: -99.1 - Math.random() * 5,
    totalHectares: Math.floor(Math.random() * 100) + 10,
    cropTypes: ['Avocado', 'Berries'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record request result
 */
export function recordResult(response) {
  if (response.status >= 200 && response.status < 400) {
    successfulRequests.add(1);
    errorRate.add(0);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
}

/**
 * Record error
 */
export function recordError(response) {
  errorRate.add(response.status >= 400);
}

/**
 * Check response with custom metrics
 */
export function checkResponse(response, checks, metric) {
  const result = check(response, checks);

  if (metric) {
    metric.add(response.timings.duration);
  }

  return result;
}

/**
 * Measure cache hit rate from response headers
 */
export function measureCacheHit(response) {
  const cacheHeader = response.headers['X-Cache'] || response.headers['x-cache'];
  const hit = cacheHeader === 'HIT' ? 1 : 0;
  cacheHitRate.add(hit);
  return hit;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Random sleep between min and max seconds
 */
export function randomSleep(min, max) {
  sleep(Math.random() * (max - min) + min);
}

/**
 * Select role based on weights
 */
export function selectWeightedRole(weights) {
  const rand = Math.random();
  let cumulative = 0;

  for (const [role, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand < cumulative) {
      return role;
    }
  }

  return 'buyer';
}

/**
 * Get random item from array
 */
export function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Parse JSON response safely
 */
export function safeParseJson(response, path = null) {
  try {
    if (path) {
      return response.json(path);
    }
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Format duration for logging
 */
export function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
