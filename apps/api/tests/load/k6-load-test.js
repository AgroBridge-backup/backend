/**
 * AgroBridge API Load Testing Suite
 *
 * Run with: k6 run tests/load/k6-load-test.js
 *
 * Environment variables:
 *   K6_API_URL - Base API URL (default: http://localhost:3000)
 *   K6_ACCESS_TOKEN - JWT access token for authenticated requests
 *   K6_VUS - Number of virtual users (default: 50)
 *   K6_DURATION - Test duration (default: 5m)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Configuration
const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3000';
const ACCESS_TOKEN = __ENV.K6_ACCESS_TOKEN || '';

// Test options
export const options = {
  // Stages for ramping up/down VUs
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 50 },   // Back to 50 users
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],

  // Thresholds for pass/fail criteria
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    errors: ['rate<0.05'],                           // Error rate < 5%
    http_req_failed: ['rate<0.01'],                 // HTTP failures < 1%
  },

  // Tags for result filtering
  tags: {
    testType: 'load',
  },
};

// Default headers
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

// Check response and record metrics
function checkResponse(res, name, expectedStatus = 200) {
  const success = check(res, {
    [`${name} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} response time < 500ms`]: (r) => r.timings.duration < 500,
  });

  apiResponseTime.add(res.timings.duration, { endpoint: name });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`FAILED: ${name} - Status: ${res.status}, Duration: ${res.timings.duration}ms`);
  }

  return success;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

export default function () {
  // Randomize which endpoint group to test
  const scenario = randomIntBetween(1, 5);

  switch (scenario) {
    case 1:
      testHealthEndpoints();
      break;
    case 2:
      testBatchEndpoints();
      break;
    case 3:
      testPublicEndpoints();
      break;
    case 4:
      testCertificateEndpoints();
      break;
    case 5:
      testDashboardEndpoints();
      break;
  }

  // Random sleep between requests (1-3 seconds)
  sleep(randomIntBetween(1, 3));
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH ENDPOINTS (No Auth Required)
// ═══════════════════════════════════════════════════════════════════════════════

function testHealthEndpoints() {
  group('Health Endpoints', function () {
    // Health check
    let res = http.get(`${BASE_URL}/health`, {
      headers: getHeaders(false),
      tags: { name: 'health-check' },
    });
    checkResponse(res, 'GET /health');

    // Liveness probe
    res = http.get(`${BASE_URL}/health/live`, {
      headers: getHeaders(false),
      tags: { name: 'liveness-probe' },
    });
    checkResponse(res, 'GET /health/live');

    // Readiness probe
    res = http.get(`${BASE_URL}/health/ready`, {
      headers: getHeaders(false),
      tags: { name: 'readiness-probe' },
    });
    checkResponse(res, 'GET /health/ready');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH ENDPOINTS (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

function testBatchEndpoints() {
  group('Batch Endpoints', function () {
    // List batches
    let res = http.get(`${BASE_URL}/api/v1/batches?page=1&limit=20`, {
      headers: getHeaders(true),
      tags: { name: 'list-batches' },
    });
    checkResponse(res, 'GET /api/v1/batches');

    // Get batch by ID (using a sample ID or from previous response)
    res = http.get(`${BASE_URL}/api/v1/batches/sample-batch-id`, {
      headers: getHeaders(true),
      tags: { name: 'get-batch' },
    });
    // Note: This might return 404 if batch doesn't exist, which is expected
    check(res, {
      'GET /api/v1/batches/:id status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (No Auth Required)
// ═══════════════════════════════════════════════════════════════════════════════

function testPublicEndpoints() {
  group('Public Endpoints', function () {
    // Public farmer lookup
    let res = http.get(`${BASE_URL}/api/v1/public/farmers/sample-farmer-id`, {
      headers: getHeaders(false),
      tags: { name: 'public-farmer' },
    });
    check(res, {
      'GET /api/v1/public/farmers/:id status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    // Public batch traceability
    res = http.get(`${BASE_URL}/api/v1/public/batches/SAMPLE-CODE`, {
      headers: getHeaders(false),
      tags: { name: 'public-batch' },
    });
    check(res, {
      'GET /api/v1/public/batches/:code status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATE ENDPOINTS (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

function testCertificateEndpoints() {
  group('Certificate Endpoints', function () {
    // List organic certificates
    let res = http.get(`${BASE_URL}/api/v1/organic-certificates?page=1&limit=10`, {
      headers: getHeaders(true),
      tags: { name: 'list-certificates' },
    });
    checkResponse(res, 'GET /api/v1/organic-certificates');

    // Get pending review certificates (for export company admins)
    res = http.get(`${BASE_URL}/api/v1/organic-certificates/pending-review`, {
      headers: getHeaders(true),
      tags: { name: 'pending-certificates' },
    });
    check(res, {
      'GET /api/v1/organic-certificates/pending-review status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ENDPOINTS (Authenticated - Export Company Admin)
// ═══════════════════════════════════════════════════════════════════════════════

function testDashboardEndpoints() {
  group('Dashboard Endpoints', function () {
    // Dashboard stats
    let res = http.get(`${BASE_URL}/api/v1/dashboard/stats`, {
      headers: getHeaders(true),
      tags: { name: 'dashboard-stats' },
    });
    check(res, {
      'GET /api/v1/dashboard/stats status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    });

    // Certificate analytics
    res = http.get(`${BASE_URL}/api/v1/dashboard/certificate-analytics`, {
      headers: getHeaders(true),
      tags: { name: 'certificate-analytics' },
    });
    check(res, {
      'GET /api/v1/dashboard/certificate-analytics status is 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('='.repeat(60));
  console.log('AgroBridge API Load Test - Starting');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Token configured: ${ACCESS_TOKEN ? 'Yes' : 'No'}`);
  console.log('='.repeat(60));

  // Verify API is accessible
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API is not accessible: ${res.status}`);
  }

  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log('='.repeat(60));
  console.log('AgroBridge API Load Test - Complete');
  console.log(`Started: ${data.startTime}`);
  console.log(`Finished: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}
