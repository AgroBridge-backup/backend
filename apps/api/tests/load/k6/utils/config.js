/**
 * @file k6 Load Test Configuration
 * @description Central config for load testing scenarios
 *
 * @author AgroBridge Engineering Team
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BASE URLS
// ═══════════════════════════════════════════════════════════════════════════════

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_V1 = `${BASE_URL}/api/v1`;
export const API_V2 = `${BASE_URL}/api/v2`;
export const GRAPHQL_URL = `${BASE_URL}/graphql`;
export const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST USERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Test user credentials (create these users in your test DB)
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@test.agrobridge.io',
    password: 'TestPassword123!',
  },
  producer: {
    email: 'producer@test.agrobridge.io',
    password: 'TestPassword123!',
  },
  certifier: {
    email: 'certifier@test.agrobridge.io',
    password: 'TestPassword123!',
  },
  buyer: {
    email: 'buyer@test.agrobridge.io',
    password: 'TestPassword123!',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load test scenarios for different testing purposes
 */
export const SCENARIOS = {
  // Smoke test: Minimal load, verify system works
  smoke: {
    executor: 'constant-vus',
    vus: 2,
    duration: '1m',
  },

  // Load test: Normal traffic simulation
  load: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 50 },   // Ramp up to 50 users
      { duration: '5m', target: 50 },   // Stay at 50 users
      { duration: '2m', target: 100 },  // Ramp up to 100 users
      { duration: '5m', target: 100 },  // Stay at 100 users
      { duration: '2m', target: 0 },    // Ramp down
    ],
  },

  // Stress test: Find breaking point
  stress: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 400 },
      { duration: '5m', target: 400 },
      { duration: '10m', target: 0 },
    ],
  },

  // Spike test: Sudden traffic surge
  spike: {
    executor: 'ramping-vus',
    stages: [
      { duration: '10s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '10s', target: 1400 },  // Spike!
      { duration: '3m', target: 1400 },
      { duration: '10s', target: 100 },
      { duration: '3m', target: 100 },
      { duration: '10s', target: 0 },
    ],
  },

  // Soak test: Sustained load over time (for stability testing)
  soak: {
    executor: 'constant-vus',
    vus: 400,
    duration: '3h',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Performance thresholds that must be met
 */
export const THRESHOLDS = {
  // HTTP request duration
  http_req_duration: [
    'p(95)<200',   // 95% of requests must complete below 200ms
    'p(99)<500',   // 99% of requests must complete below 500ms
    'max<2000',    // Max response time 2 seconds
  ],

  // HTTP request failure rate
  http_req_failed: [
    'rate<0.01',   // Error rate must be below 1%
  ],

  // Requests per second
  http_reqs: [
    'rate>100',    // Must handle at least 100 req/s
  ],

  // Specific endpoint thresholds
  'http_req_duration{endpoint:batches_list}': ['p(95)<150'],
  'http_req_duration{endpoint:batch_detail}': ['p(95)<100'],
  'http_req_duration{endpoint:auth_login}': ['p(95)<300'],
  'http_req_duration{endpoint:create_batch}': ['p(95)<400'],
  'http_req_duration{endpoint:graphql_query}': ['p(95)<250'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH STATUSES AND EVENT TYPES (matching Prisma schema)
// ═══════════════════════════════════════════════════════════════════════════════

export const BATCH_STATUSES = [
  'REGISTERED',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'REJECTED',
];

export const EVENT_TYPES = [
  'HARVEST',
  'PROCESSING',
  'QUALITY_INSPECTION',
  'PACKAGING',
  'TRANSPORT_START',
  'TRANSPORT_ARRIVAL',
  'CUSTOMS_CLEARANCE',
  'DELIVERY',
];

export const VARIETIES = ['HASS', 'BERRIES'];

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPHQL QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export const GRAPHQL_QUERIES = {
  me: `
    query Me {
      me {
        id
        email
        firstName
        lastName
        role
      }
    }
  `,

  batches: `
    query Batches($page: Int, $limit: Int) {
      batches(pagination: { page: $page, limit: $limit }) {
        nodes {
          id
          origin
          variety
          status
          weightKg
          producer {
            businessName
          }
        }
        pageInfo {
          totalCount
          hasNextPage
        }
      }
    }
  `,

  batch: `
    query Batch($id: ID!) {
      batch(id: $id) {
        id
        origin
        variety
        status
        weightKg
        harvestDate
        producer {
          businessName
          state
        }
        events {
          id
          eventType
          timestamp
          locationName
        }
      }
    }
  `,

  dashboard: `
    query Dashboard {
      dashboard {
        totalBatches
        activeBatches
        totalProducers
        batchesByStatus {
          status
          count
          percentage
        }
      }
    }
  `,
};

export const GRAPHQL_MUTATIONS = {
  createBatch: `
    mutation CreateBatch($input: CreateBatchInput!) {
      createBatch(input: $input) {
        success
        message
        batch {
          id
          origin
          variety
          status
        }
      }
    }
  `,

  createEvent: `
    mutation CreateEvent($input: CreateEventInput!) {
      createEvent(input: $input) {
        success
        message
        event {
          id
          eventType
          timestamp
        }
      }
    }
  `,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS NAMES
// ═══════════════════════════════════════════════════════════════════════════════

export const CUSTOM_METRICS = {
  cacheHitRate: 'cache_hit_rate',
  authDuration: 'authentication_duration',
  dbQueryDuration: 'database_query_duration',
  graphqlDuration: 'graphql_request_duration',
  batchCreateDuration: 'batch_create_duration',
  eventCreateDuration: 'event_create_duration',
};
