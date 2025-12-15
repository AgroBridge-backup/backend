/**
 * @file Spike Test
 * @description Test system behavior during sudden traffic surge
 *
 * Run: k6 run tests/load/k6/scenarios/spike.test.js
 *
 * @author AgroBridge Engineering Team
 */

import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  API_V1,
  API_V2,
  TEST_USERS,
  SCENARIOS,
} from '../utils/config.js';
import {
  authenticate,
  authenticatedGet,
  recordError,
  safeParseJson,
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const spikeRecoveryRate = new Rate('spike_recovery_rate');
const responseTimeBeforeSpike = new Trend('response_time_before_spike');
const responseTimeDuringSpike = new Trend('response_time_during_spike');
const responseTimeAfterSpike = new Trend('response_time_after_spike');

const requestsDuringSpike = new Counter('requests_during_spike');
const failuresDuringSpike = new Counter('failures_during_spike');

// Track which phase we're in
let currentPhase = 'before_spike';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    spike: SCENARIOS.spike,
  },
  thresholds: {
    // More lenient thresholds during spike
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],  // Allow 10% error rate during spike
    spike_recovery_rate: ['rate>0.80'], // 80% of requests should succeed after spike
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SPIKE TEST - Sudden Traffic Surge');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${BASE_URL}`);
  console.log('');
  console.log('Scenario Timeline:');
  console.log('  0:00 - 0:10   Ramp to 100 VUs');
  console.log('  0:10 - 1:10   Stay at 100 VUs');
  console.log('  1:10 - 1:20   SPIKE to 1400 VUs!');
  console.log('  1:20 - 4:20   Stay at 1400 VUs');
  console.log('  4:20 - 4:30   Ramp down to 100 VUs');
  console.log('  4:30 - 7:30   Recovery at 100 VUs');
  console.log('  7:30 - 7:40   Ramp down to 0 VUs');
  console.log('');
  console.log('This tests how the system handles sudden traffic spikes');
  console.log('and how quickly it recovers afterwards.');
  console.log('');

  // Authenticate test user
  const producerAuth = authenticate(
    BASE_URL,
    TEST_USERS.producer.email,
    TEST_USERS.producer.password
  );

  if (!producerAuth) {
    console.error('ERROR: Authentication failed. Spike test will fail.');
  }

  console.log('Setup complete!');
  console.log('');

  return {
    producerToken: producerAuth?.accessToken,
    startTime: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════════

export default function (data) {
  const { producerToken, startTime } = data;

  if (!producerToken) {
    return;
  }

  // Determine current phase based on elapsed time
  const elapsed = (Date.now() - startTime) / 1000; // seconds

  if (elapsed < 70) {
    currentPhase = 'before_spike';
  } else if (elapsed < 260) {
    currentPhase = 'during_spike';
  } else {
    currentPhase = 'after_spike';
  }

  // Simple read operation - most common during spike
  const start = Date.now();

  const res = authenticatedGet(
    `${API_V1}/batches?page=1&limit=20`,
    producerToken,
    { endpoint: 'batches_list' }
  );

  const duration = Date.now() - start;

  // Record metrics based on phase
  switch (currentPhase) {
    case 'before_spike':
      responseTimeBeforeSpike.add(duration);
      break;
    case 'during_spike':
      responseTimeDuringSpike.add(duration);
      requestsDuringSpike.add(1);
      if (res.status !== 200) {
        failuresDuringSpike.add(1);
      }
      break;
    case 'after_spike':
      responseTimeAfterSpike.add(duration);
      break;
  }

  // Track recovery (requests succeed after spike)
  if (res.status === 200) {
    spikeRecoveryRate.add(1);
  } else {
    spikeRecoveryRate.add(0);
  }

  recordError(res);

  // Minimal sleep
  sleep(0.1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function teardown(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SPIKE TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Key Metrics to Review:');
  console.log('  - response_time_before_spike: Baseline performance');
  console.log('  - response_time_during_spike: Performance under spike');
  console.log('  - response_time_after_spike: Recovery performance');
  console.log('  - spike_recovery_rate: % of successful requests');
  console.log('  - failures_during_spike: Total failures during spike');
  console.log('');
  console.log('A healthy system should:');
  console.log('  1. Show degraded but not catastrophic performance during spike');
  console.log('  2. Recover to normal performance after spike');
  console.log('  3. Maintain >80% success rate even during spike');
  console.log('');
}
