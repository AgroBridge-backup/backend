/**
 * @file Smoke Test
 * @description Quick verification that all critical endpoints work with minimal load
 *
 * Run: k6 run tests/load/k6/scenarios/smoke.test.js
 *
 * @author AgroBridge Engineering Team
 */

import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import {
  BASE_URL,
  API_V1,
  API_V2,
  GRAPHQL_URL,
  TEST_USERS,
  SCENARIOS,
  THRESHOLDS,
  GRAPHQL_QUERIES,
} from '../utils/config.js';
import {
  authenticate,
  authenticatedGet,
  authenticatedPost,
  graphqlRequest,
  generateBatchData,
  generateEventData,
  batchListDuration,
  batchCreateDuration,
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const healthCheckDuration = new Trend('health_check_duration');
const analyticsLoadDuration = new Trend('analytics_load_duration');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    smoke: SCENARIOS.smoke,
  },
  thresholds: {
    // More lenient thresholds for smoke test
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP - Runs once before test
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SMOKE TEST - Quick System Verification');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${BASE_URL}`);
  console.log(`VUs: ${SCENARIOS.smoke.vus}`);
  console.log(`Duration: ${SCENARIOS.smoke.duration}`);
  console.log('');

  // Authenticate test users
  console.log('Authenticating test users...');

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

  const certifierAuth = authenticate(
    BASE_URL,
    TEST_USERS.certifier.email,
    TEST_USERS.certifier.password
  );

  if (!adminAuth) {
    console.warn('WARNING: Admin authentication failed');
  }
  if (!producerAuth) {
    console.warn('WARNING: Producer authentication failed');
  }
  if (!certifierAuth) {
    console.warn('WARNING: Certifier authentication failed');
  }

  console.log('Setup complete!');
  console.log('');

  return {
    adminToken: adminAuth?.accessToken,
    producerToken: producerAuth?.accessToken,
    certifierToken: certifierAuth?.accessToken,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST - Runs for each VU iteration
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const { adminToken, producerToken, certifierToken } = data;

  // Test 1: Health endpoints
  group('Health Endpoints', () => {
    testHealthEndpoints();
  });

  // Test 2: REST API v1
  group('REST API v1', () => {
    if (producerToken) {
      testRestApiV1(producerToken, adminToken);
    }
  });

  // Test 3: REST API v2
  group('REST API v2', () => {
    if (producerToken) {
      testRestApiV2(producerToken);
    }
  });

  // Test 4: GraphQL API
  group('GraphQL API', () => {
    if (producerToken) {
      testGraphQLApi(producerToken, adminToken);
    }
  });

  // Test 5: Analytics (requires admin/certifier)
  group('Analytics', () => {
    if (adminToken || certifierToken) {
      testAnalytics(adminToken || certifierToken);
    }
  });

  sleep(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Test health endpoints
 */
function testHealthEndpoints() {
  // Basic health check
  const start = Date.now();
  const healthRes = authenticatedGet(`${BASE_URL}/health`, null, {
    endpoint: 'health_check',
  });
  healthCheckDuration.add(Date.now() - start);

  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
    'health check has status field': (r) => {
      try {
        const body = r.json();
        return body.status === 'ok' || body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  // Ready check
  const readyRes = authenticatedGet(`${BASE_URL}/health/ready`, null, {
    endpoint: 'ready_check',
  });

  check(readyRes, {
    'ready check responds': (r) => r.status === 200 || r.status === 503,
  });

  // GraphQL health
  const gqlHealthRes = authenticatedGet(`${GRAPHQL_URL}/health`, null, {
    endpoint: 'graphql_health',
  });

  check(gqlHealthRes, {
    'GraphQL health responds': (r) => r.status === 200 || r.status === 404,
  });
}

/**
 * Test REST API v1 endpoints
 */
function testRestApiV1(producerToken, adminToken) {
  // List batches
  const start = Date.now();
  const listRes = authenticatedGet(
    `${API_V1}/batches?page=1&limit=10`,
    producerToken,
    { endpoint: 'batches_list' }
  );
  batchListDuration.add(Date.now() - start);

  const listSuccess = check(listRes, {
    'v1 list batches status 200': (r) => r.status === 200,
    'v1 list batches returns data': (r) => {
      try {
        const body = r.json();
        return body.data !== undefined || body.success !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Create batch (if producer)
  if (producerToken) {
    const batchData = generateBatchData();
    const createStart = Date.now();
    const createRes = authenticatedPost(
      `${API_V1}/batches`,
      batchData,
      producerToken,
      { endpoint: 'create_batch' }
    );
    batchCreateDuration.add(Date.now() - createStart);

    const createSuccess = check(createRes, {
      'v1 create batch status 201': (r) => r.status === 201,
      'v1 create batch returns id': (r) => {
        try {
          const body = r.json();
          return body.data && body.data.id;
        } catch {
          return false;
        }
      },
    });

    // If batch was created, test detail and events
    if (createSuccess && createRes.status === 201) {
      try {
        const batchId = createRes.json('data.id');

        // Get batch detail
        const detailRes = authenticatedGet(
          `${API_V1}/batches/${batchId}`,
          producerToken,
          { endpoint: 'batch_detail' }
        );

        check(detailRes, {
          'v1 batch detail status 200': (r) => r.status === 200,
        });

        // Create event for batch
        const eventData = generateEventData(batchId);
        const eventRes = authenticatedPost(
          `${API_V1}/events`,
          eventData,
          producerToken,
          { endpoint: 'create_event' }
        );

        check(eventRes, {
          'v1 create event status 201': (r) => r.status === 201,
        });

        // List events
        const eventsRes = authenticatedGet(
          `${API_V1}/events?batchId=${batchId}`,
          producerToken,
          { endpoint: 'events_list' }
        );

        check(eventsRes, {
          'v1 list events status 200': (r) => r.status === 200,
        });
      } catch (e) {
        console.log('Error in batch operations:', e);
      }
    }
  }

  // List producers (may require admin)
  const producersRes = authenticatedGet(
    `${API_V1}/producers?page=1&limit=10`,
    adminToken || producerToken,
    { endpoint: 'producers_list' }
  );

  check(producersRes, {
    'v1 list producers responds': (r) => r.status === 200 || r.status === 403,
  });

  sleep(0.5);
}

/**
 * Test REST API v2 endpoints
 */
function testRestApiV2(producerToken) {
  // V2 API info
  const infoRes = authenticatedGet(`${API_V2}`, producerToken, {
    endpoint: 'v2_info',
  });

  check(infoRes, {
    'v2 info status 200': (r) => r.status === 200,
    'v2 info has version': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.version;
      } catch {
        return false;
      }
    },
  });

  // V2 batches with query parameters
  const batchesRes = authenticatedGet(
    `${API_V2}/batches?page=1&limit=10&sort=-createdAt`,
    producerToken,
    { endpoint: 'v2_batches_list' }
  );

  check(batchesRes, {
    'v2 batches status 200': (r) => r.status === 200,
    'v2 batches has pagination': (r) => {
      try {
        const body = r.json();
        return body.meta !== undefined;
      } catch {
        return false;
      }
    },
  });

  // V2 events
  const eventsRes = authenticatedGet(
    `${API_V2}/events?page=1&limit=10`,
    producerToken,
    { endpoint: 'v2_events_list' }
  );

  check(eventsRes, {
    'v2 events status 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

/**
 * Test GraphQL API
 */
function testGraphQLApi(producerToken, adminToken) {
  // Query: me
  const meRes = graphqlRequest(GRAPHQL_QUERIES.me, {}, producerToken, {
    endpoint: 'graphql_me',
  });

  check(meRes, {
    'GraphQL me status 200': (r) => r.status === 200,
    'GraphQL me returns user': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.me && body.data.me.id;
      } catch {
        return false;
      }
    },
  });

  // Query: batches
  const batchesRes = graphqlRequest(
    GRAPHQL_QUERIES.batches,
    { page: 1, limit: 10 },
    producerToken,
    { endpoint: 'graphql_batches' }
  );

  check(batchesRes, {
    'GraphQL batches status 200': (r) => r.status === 200,
    'GraphQL batches returns nodes': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.batches;
      } catch {
        return false;
      }
    },
  });

  // Query: dashboard (admin only)
  if (adminToken) {
    const dashboardRes = graphqlRequest(
      GRAPHQL_QUERIES.dashboard,
      {},
      adminToken,
      { endpoint: 'graphql_dashboard' }
    );

    check(dashboardRes, {
      'GraphQL dashboard status 200': (r) => r.status === 200,
    });
  }

  sleep(0.5);
}

/**
 * Test analytics endpoints
 */
function testAnalytics(token) {
  const start = Date.now();

  // Dashboard
  const dashboardRes = authenticatedGet(
    `${API_V2}/analytics/dashboard`,
    token,
    { endpoint: 'analytics_dashboard' }
  );

  analyticsLoadDuration.add(Date.now() - start);

  check(dashboardRes, {
    'analytics dashboard status 200': (r) => r.status === 200,
    'analytics dashboard has data': (r) => {
      try {
        const body = r.json();
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Batch stats
  const batchStatsRes = authenticatedGet(
    `${API_V2}/analytics/batches/stats`,
    token,
    { endpoint: 'analytics_batch_stats' }
  );

  check(batchStatsRes, {
    'batch stats status 200': (r) => r.status === 200,
  });

  // Overview
  const overviewRes = authenticatedGet(
    `${API_V2}/analytics/overview`,
    token,
    { endpoint: 'analytics_overview' }
  );

  check(overviewRes, {
    'overview status 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN - Runs once after test
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SMOKE TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}
