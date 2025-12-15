/**
 * @file Load Test
 * @description Simulate normal traffic with realistic user behavior
 *
 * Run: k6 run tests/load/k6/scenarios/load.test.js
 *
 * @author AgroBridge Engineering Team
 */

import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  API_V1,
  API_V2,
  TEST_USERS,
  SCENARIOS,
  THRESHOLDS,
  GRAPHQL_QUERIES,
  GRAPHQL_MUTATIONS,
} from '../utils/config.js';
import {
  authenticate,
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  graphqlRequest,
  generateBatchData,
  generateEventData,
  randomSleep,
  selectWeightedRole,
  measureCacheHit,
  safeParseJson,
  batchesCreated,
  eventsCreated,
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const producerJourneyDuration = new Trend('producer_journey_duration');
const buyerJourneyDuration = new Trend('buyer_journey_duration');
const certifierJourneyDuration = new Trend('certifier_journey_duration');
const adminJourneyDuration = new Trend('admin_journey_duration');

const journeysCompleted = new Counter('journeys_completed');
const journeysFailed = new Counter('journeys_failed');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    load: SCENARIOS.load,
  },
  thresholds: THRESHOLDS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LOAD TEST - Normal Traffic Simulation');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${BASE_URL}`);
  console.log('Scenario: Ramping 0 → 50 → 100 → 0 VUs over 16 minutes');
  console.log('');

  // Authenticate all test users
  const users = {};

  for (const [role, credentials] of Object.entries(TEST_USERS)) {
    const auth = authenticate(BASE_URL, credentials.email, credentials.password);
    if (auth) {
      users[role] = {
        token: auth.accessToken,
        role,
        user: auth.user,
      };
      console.log(`✓ ${role} authenticated`);
    } else {
      console.log(`✗ ${role} authentication failed`);
    }
  }

  console.log('');
  console.log('Setup complete!');
  console.log('');

  return { users };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const { users } = data;

  // Select user role based on realistic weights
  const roleWeights = {
    producer: 0.45,   // 45% - Producers managing batches
    buyer: 0.30,      // 30% - Buyers browsing/searching
    certifier: 0.15,  // 15% - Certifiers reviewing
    admin: 0.10,      // 10% - Admins managing system
  };

  const role = selectWeightedRole(roleWeights);
  const user = users[role];

  if (!user) {
    console.log(`No token for role: ${role}`);
    return;
  }

  // Execute journey based on role
  const start = Date.now();
  let success = false;

  try {
    switch (role) {
      case 'producer':
        success = simulateProducerJourney(user.token);
        producerJourneyDuration.add(Date.now() - start);
        break;
      case 'buyer':
        success = simulateBuyerJourney(user.token);
        buyerJourneyDuration.add(Date.now() - start);
        break;
      case 'certifier':
        success = simulateCertifierJourney(user.token);
        certifierJourneyDuration.add(Date.now() - start);
        break;
      case 'admin':
        success = simulateAdminJourney(user.token);
        adminJourneyDuration.add(Date.now() - start);
        break;
    }

    if (success) {
      journeysCompleted.add(1);
    } else {
      journeysFailed.add(1);
    }
  } catch (e) {
    journeysFailed.add(1);
  }

  randomSleep(1, 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER JOURNEYS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Producer journey: Create batches, add events, track shipments
 */
function simulateProducerJourney(token) {
  let success = true;

  group('Producer: Dashboard Check', () => {
    const dashboardRes = authenticatedGet(`${API_V2}/analytics/dashboard`, token);
    success = check(dashboardRes, {
      'producer dashboard loaded': (r) => r.status === 200 || r.status === 403,
    }) && success;
    sleep(0.5);
  });

  group('Producer: List Own Batches', () => {
    const listRes = authenticatedGet(
      `${API_V1}/batches?page=1&limit=20`,
      token,
      { endpoint: 'batches_list' }
    );
    measureCacheHit(listRes);
    success = check(listRes, {
      'producer batches listed': (r) => r.status === 200,
    }) && success;
    sleep(1);
  });

  // 70% chance: Create new batch
  if (Math.random() < 0.7) {
    group('Producer: Create Batch', () => {
      const batchData = generateBatchData();
      const createRes = authenticatedPost(
        `${API_V1}/batches`,
        batchData,
        token,
        { endpoint: 'create_batch' }
      );

      const created = check(createRes, {
        'batch created': (r) => r.status === 201,
      });

      if (created && createRes.status === 201) {
        batchesCreated.add(1);
        const batchId = safeParseJson(createRes, 'data.id');

        if (batchId) {
          sleep(1);

          // Add 1-3 events to the batch
          const numEvents = Math.floor(Math.random() * 3) + 1;

          group('Producer: Add Events', () => {
            for (let i = 0; i < numEvents; i++) {
              const eventData = generateEventData(batchId);
              const eventRes = authenticatedPost(
                `${API_V1}/events`,
                eventData,
                token,
                { endpoint: 'create_event' }
              );

              if (check(eventRes, { 'event created': (r) => r.status === 201 })) {
                eventsCreated.add(1);
              }
              sleep(0.5);
            }
          });

          // View batch timeline
          group('Producer: View Timeline', () => {
            authenticatedGet(`${API_V2}/batches/${batchId}/timeline`, token);
            sleep(0.5);
          });
        }
      }

      success = created && success;
    });
  }

  // View a random batch detail
  group('Producer: View Batch Detail', () => {
    const listRes = authenticatedGet(`${API_V1}/batches?page=1&limit=5`, token);
    const batches = safeParseJson(listRes, 'data');

    if (batches && batches.length > 0) {
      const randomBatch = batches[Math.floor(Math.random() * batches.length)];
      authenticatedGet(
        `${API_V1}/batches/${randomBatch.id}`,
        token,
        { endpoint: 'batch_detail' }
      );
      sleep(1);
    }
  });

  return success;
}

/**
 * Buyer journey: Browse batches, view details, search
 */
function simulateBuyerJourney(token) {
  let success = true;

  group('Buyer: Browse Batches', () => {
    // Browse with different filters
    const filters = [
      'status=REGISTERED',
      'status=IN_TRANSIT',
      'status=DELIVERED',
      '',
    ];
    const filter = filters[Math.floor(Math.random() * filters.length)];

    const listRes = authenticatedGet(
      `${API_V2}/batches?${filter}&page=1&limit=20&sort=-createdAt`,
      token,
      { endpoint: 'batches_list' }
    );
    measureCacheHit(listRes);

    success = check(listRes, {
      'buyer batches listed': (r) => r.status === 200,
    }) && success;
    sleep(1);

    // View batch details
    const batches = safeParseJson(listRes, 'data');
    if (batches && batches.length > 0) {
      const randomBatch = batches[Math.floor(Math.random() * batches.length)];

      group('Buyer: View Batch Detail', () => {
        authenticatedGet(
          `${API_V1}/batches/${randomBatch.id}`,
          token,
          { endpoint: 'batch_detail' }
        );
        sleep(1);
      });

      // View batch events
      group('Buyer: View Batch Events', () => {
        authenticatedGet(
          `${API_V2}/batches/${randomBatch.id}/events`,
          token,
          { endpoint: 'batch_events' }
        );
        sleep(0.5);
      });

      // View batch timeline
      group('Buyer: View Timeline', () => {
        authenticatedGet(
          `${API_V2}/batches/${randomBatch.id}/timeline`,
          token,
          { endpoint: 'batch_timeline' }
        );
        sleep(0.5);
      });
    }
  });

  // 40% chance: Search for specific products
  if (Math.random() < 0.4) {
    group('Buyer: Search', () => {
      const searchTerms = ['HASS', 'BERRIES', 'Michoacan', 'organic'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

      authenticatedGet(
        `${API_V2}/batches?search=${term}&page=1&limit=10`,
        token,
        { endpoint: 'search' }
      );
      sleep(1);
    });
  }

  // Use GraphQL for complex queries
  group('Buyer: GraphQL Query', () => {
    const gqlRes = graphqlRequest(
      GRAPHQL_QUERIES.batches,
      { page: 1, limit: 10 },
      token
    );

    success = check(gqlRes, {
      'GraphQL query successful': (r) => r.status === 200,
    }) && success;
    sleep(0.5);
  });

  return success;
}

/**
 * Certifier journey: Review batches, check compliance, view analytics
 */
function simulateCertifierJourney(token) {
  let success = true;

  group('Certifier: View Dashboard', () => {
    const dashboardRes = authenticatedGet(
      `${API_V2}/analytics/dashboard`,
      token,
      { endpoint: 'analytics_dashboard' }
    );

    success = check(dashboardRes, {
      'certifier dashboard loaded': (r) => r.status === 200,
    }) && success;
    sleep(1);
  });

  group('Certifier: Review Batches', () => {
    // List all batches for review
    const listRes = authenticatedGet(
      `${API_V1}/batches?page=1&limit=50`,
      token,
      { endpoint: 'batches_list' }
    );

    success = check(listRes, {
      'batches listed for review': (r) => r.status === 200,
    }) && success;
    sleep(1);

    // Review random batch details
    const batches = safeParseJson(listRes, 'data');
    if (batches && batches.length > 0) {
      const reviewCount = Math.min(3, batches.length);
      for (let i = 0; i < reviewCount; i++) {
        const batch = batches[Math.floor(Math.random() * batches.length)];
        authenticatedGet(`${API_V1}/batches/${batch.id}`, token);
        sleep(0.5);
      }
    }
  });

  group('Certifier: Check Producers', () => {
    const producersRes = authenticatedGet(
      `${API_V2}/producers?page=1&limit=20`,
      token,
      { endpoint: 'producers_list' }
    );

    success = check(producersRes, {
      'producers listed': (r) => r.status === 200,
    }) && success;
    sleep(1);
  });

  group('Certifier: View Analytics', () => {
    // Batch stats
    authenticatedGet(`${API_V2}/analytics/batches/stats`, token);
    sleep(0.5);

    // Producer stats
    authenticatedGet(`${API_V2}/analytics/producers/stats`, token);
    sleep(0.5);

    // Event distribution
    authenticatedGet(`${API_V2}/analytics/events/distribution`, token);
    sleep(0.5);
  });

  // 30% chance: Generate report
  if (Math.random() < 0.3) {
    group('Certifier: Generate Report', () => {
      const reportReq = {
        type: 'AUDIT_LOG',
        format: 'CSV',
        filters: {},
      };

      authenticatedPost(`${API_V1}/reports`, reportReq, token);
      sleep(1);
    });
  }

  return success;
}

/**
 * Admin journey: System management, all analytics, user management
 */
function simulateAdminJourney(token) {
  let success = true;

  group('Admin: System Health', () => {
    const healthRes = authenticatedGet(`${BASE_URL}/health`, token);
    success = check(healthRes, {
      'system health ok': (r) => r.status === 200,
    }) && success;
    sleep(0.5);

    // Ready check
    authenticatedGet(`${BASE_URL}/health/ready`, token);
    sleep(0.5);
  });

  group('Admin: Full Analytics', () => {
    // Dashboard
    authenticatedGet(`${API_V2}/analytics/dashboard`, token, {
      endpoint: 'analytics_dashboard',
    });
    sleep(0.5);

    // Batch timeline
    authenticatedGet(
      `${API_V2}/analytics/batches/timeline?period=30d`,
      token,
      { endpoint: 'analytics_timeline' }
    );
    sleep(0.5);

    // Top producers
    authenticatedGet(`${API_V2}/analytics/producers/top?limit=10`, token);
    sleep(0.5);

    // Overview
    authenticatedGet(`${API_V2}/analytics/overview`, token);
    sleep(0.5);
  });

  group('Admin: User Management', () => {
    // List users
    const usersRes = authenticatedGet(
      `${API_V1}/users?page=1&limit=20`,
      token,
      { endpoint: 'users_list' }
    );

    check(usersRes, {
      'users listed': (r) => r.status === 200 || r.status === 404,
    });
    sleep(1);
  });

  group('Admin: Producer Management', () => {
    const producersRes = authenticatedGet(
      `${API_V2}/producers?page=1&limit=50`,
      token,
      { endpoint: 'producers_list' }
    );

    success = check(producersRes, {
      'all producers listed': (r) => r.status === 200,
    }) && success;
    sleep(1);
  });

  // GraphQL system overview
  group('Admin: GraphQL Dashboard', () => {
    const gqlRes = graphqlRequest(GRAPHQL_QUERIES.dashboard, {}, token);

    check(gqlRes, {
      'GraphQL dashboard loaded': (r) => r.status === 200,
    });
    sleep(0.5);
  });

  return success;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LOAD TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}
