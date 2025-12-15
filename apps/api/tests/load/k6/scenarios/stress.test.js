/**
 * @file Stress Test
 * @description Push system to limits to find breaking point
 *
 * Run: k6 run tests/load/k6/scenarios/stress.test.js
 *
 * @author AgroBridge Engineering Team
 */

import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL,
  API_V1,
  API_V2,
  TEST_USERS,
  SCENARIOS,
  GRAPHQL_QUERIES,
} from '../utils/config.js';
import {
  authenticate,
  authenticatedGet,
  authenticatedPost,
  graphqlRequest,
  generateBatchData,
  generateEventData,
  safeParseJson,
  recordError,
  errorRate,
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const requestDuration = new Trend('request_duration');
const failureRate = new Rate('failure_rate');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const timeouts = new Counter('timeouts');

// Track breaking point
const breakingPointVUs = new Trend('breaking_point_vus');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    stress: SCENARIOS.stress,
  },
  thresholds: {
    // More lenient thresholds for stress testing
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],  // Allow 5% error rate
    failure_rate: ['rate<0.10'],     // 10% max failure rate
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  STRESS TEST - Finding Breaking Point');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${BASE_URL}`);
  console.log('Scenario: Ramping 0 → 100 → 200 → 300 → 400 → 0 VUs');
  console.log('');
  console.log('WARNING: This test will push the system to its limits.');
  console.log('Monitor your server resources during this test.');
  console.log('');

  // Authenticate test users
  const adminAuth = authenticate(
    BASE_URL,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password
  );

  const producerAuth = authenticate(
    BASE_URL,
    TEST_USERS.producer.email,
    TEST_USERS.producer.password
  );

  if (!producerAuth) {
    console.error('ERROR: Producer authentication failed. Stress test may fail.');
  }

  console.log('Setup complete!');
  console.log('');

  return {
    adminToken: adminAuth?.accessToken,
    producerToken: producerAuth?.accessToken,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const { adminToken, producerToken } = data;

  if (!producerToken) {
    failedRequests.add(1);
    return;
  }

  // Mix of operations with different weights
  const operations = [
    { fn: () => listBatches(producerToken), weight: 0.35 },
    { fn: () => getBatchDetail(producerToken), weight: 0.20 },
    { fn: () => createBatch(producerToken), weight: 0.15 },
    { fn: () => listEvents(producerToken), weight: 0.10 },
    { fn: () => graphqlQuery(producerToken), weight: 0.10 },
    { fn: () => getAnalytics(adminToken || producerToken), weight: 0.10 },
  ];

  // Select operation based on weight
  const rand = Math.random();
  let cumulative = 0;
  let selectedOp = operations[0].fn;

  for (const op of operations) {
    cumulative += op.weight;
    if (rand < cumulative) {
      selectedOp = op.fn;
      break;
    }
  }

  // Execute operation
  try {
    selectedOp();
  } catch (e) {
    failedRequests.add(1);
    failureRate.add(1);
  }

  // Minimal sleep to stress system
  sleep(0.1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRESS OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List batches - Most common read operation
 */
function listBatches(token) {
  const start = Date.now();

  const res = authenticatedGet(
    `${API_V1}/batches?page=1&limit=20`,
    token,
    { endpoint: 'batches_list' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 200) {
    successfulRequests.add(1);
    failureRate.add(0);
  } else if (res.status === 0) {
    // Timeout
    timeouts.add(1);
    failedRequests.add(1);
    failureRate.add(1);
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

/**
 * Get batch detail - Second most common read operation
 */
function getBatchDetail(token) {
  // First get a batch ID
  const listRes = authenticatedGet(`${API_V1}/batches?page=1&limit=1`, token);

  if (listRes.status === 200) {
    const batches = safeParseJson(listRes, 'data');

    if (batches && batches.length > 0) {
      const start = Date.now();

      const res = authenticatedGet(
        `${API_V1}/batches/${batches[0].id}`,
        token,
        { endpoint: 'batch_detail' }
      );

      requestDuration.add(Date.now() - start);

      if (res.status === 200) {
        successfulRequests.add(1);
        failureRate.add(0);
      } else {
        failedRequests.add(1);
        failureRate.add(1);
      }

      recordError(res);
    }
  }
}

/**
 * Create batch - Write operation
 */
function createBatch(token) {
  const batchData = generateBatchData();
  const start = Date.now();

  const res = authenticatedPost(
    `${API_V1}/batches`,
    batchData,
    token,
    { endpoint: 'create_batch' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 201) {
    successfulRequests.add(1);
    failureRate.add(0);

    // Optionally create an event
    if (Math.random() < 0.5) {
      const batchId = safeParseJson(res, 'data.id');
      if (batchId) {
        createEvent(token, batchId);
      }
    }
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

/**
 * Create event - Write operation
 */
function createEvent(token, batchId) {
  const eventData = generateEventData(batchId);
  const start = Date.now();

  const res = authenticatedPost(
    `${API_V1}/events`,
    eventData,
    token,
    { endpoint: 'create_event' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 201) {
    successfulRequests.add(1);
    failureRate.add(0);
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

/**
 * List events
 */
function listEvents(token) {
  const start = Date.now();

  const res = authenticatedGet(
    `${API_V2}/events?page=1&limit=20`,
    token,
    { endpoint: 'events_list' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 200) {
    successfulRequests.add(1);
    failureRate.add(0);
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

/**
 * GraphQL query - Complex operation
 */
function graphqlQuery(token) {
  const start = Date.now();

  const res = graphqlRequest(
    GRAPHQL_QUERIES.batches,
    { page: 1, limit: 10 },
    token,
    { endpoint: 'graphql_query' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 200) {
    const body = safeParseJson(res);
    if (body && !body.errors) {
      successfulRequests.add(1);
      failureRate.add(0);
    } else {
      failedRequests.add(1);
      failureRate.add(1);
    }
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

/**
 * Get analytics - Admin operation
 */
function getAnalytics(token) {
  if (!token) {
    return;
  }

  const start = Date.now();

  const res = authenticatedGet(
    `${API_V2}/analytics/dashboard`,
    token,
    { endpoint: 'analytics_dashboard' }
  );

  requestDuration.add(Date.now() - start);

  if (res.status === 200 || res.status === 403) {
    // 403 is ok for non-admin users
    successfulRequests.add(1);
    failureRate.add(0);
  } else {
    failedRequests.add(1);
    failureRate.add(1);
  }

  recordError(res);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  STRESS TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Review the metrics to identify the breaking point.');
  console.log('Look for the VU count where error rate starts increasing.');
  console.log('');
}
