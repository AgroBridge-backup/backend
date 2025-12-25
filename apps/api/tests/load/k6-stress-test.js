/**
 * AgroBridge API Stress Testing Suite
 *
 * Tests system behavior under extreme load conditions.
 * Run with: k6 run tests/load/k6-stress-test.js
 *
 * WARNING: Only run against staging/test environments!
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Configuration
const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3000';
const ACCESS_TOKEN = __ENV.K6_ACCESS_TOKEN || '';

// Stress test options - push the system to its limits
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Spike to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 300 },   // Push to 300 users
    { duration: '5m', target: 300 },   // Stay at 300 users (breaking point test)
    { duration: '2m', target: 100 },   // Scale down
    { duration: '2m', target: 0 },     // Ramp down
  ],

  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% < 2s under stress
    errors: ['rate<0.10'],               // Error rate < 10% under stress
    http_req_failed: ['rate<0.05'],     // HTTP failures < 5%
  },

  tags: {
    testType: 'stress',
  },
};

function getHeaders(authenticated = true) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (authenticated && ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${ACCESS_TOKEN}`;
  }
  return headers;
}

export default function () {
  // Health check - always accessible
  group('Stress: Health Check', function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health status 200': (r) => r.status === 200 });
    responseTime.add(res.timings.duration, { endpoint: 'health' });
    if (res.status !== 200) errorRate.add(1);
  });

  // API status endpoint
  group('Stress: API Status', function () {
    const res = http.get(`${BASE_URL}/api/v1/status`);
    check(res, { 'status endpoint 200': (r) => r.status === 200 });
    responseTime.add(res.timings.duration, { endpoint: 'status' });
    if (res.status !== 200) errorRate.add(1);
  });

  // Batch listing (authenticated, database-heavy)
  if (ACCESS_TOKEN) {
    group('Stress: Batch List', function () {
      const res = http.get(`${BASE_URL}/api/v1/batches?page=1&limit=10`, {
        headers: getHeaders(true),
      });
      check(res, { 'batches status 200': (r) => r.status === 200 });
      responseTime.add(res.timings.duration, { endpoint: 'batches' });
      if (res.status !== 200) errorRate.add(1);
    });
  }

  sleep(1);
}

export function setup() {
  console.log('='.repeat(60));
  console.log('STRESS TEST - WARNING: High load test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));

  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API not accessible: ${res.status}`);
  }
  return {};
}

export function teardown() {
  console.log('Stress test complete. Check metrics for breaking points.');
}
