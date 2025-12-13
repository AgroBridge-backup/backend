import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const apiResponseTime = new Trend('api_response_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api-staging.agrobridge.io';

// Load test options - staged ramp-up
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 25 },    // Ramp up to 25 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 100 },   // Spike to 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failed requests
    errors: ['rate<0.05'],             // Less than 5% errors
    health_check_duration: ['p(99)<200'], // Health checks under 200ms
  },
};

// Setup function - runs once before test
export function setup() {
  console.log(`Testing against: ${BASE_URL}`);

  // Verify server is up
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Server health check failed: ${healthRes.status}`);
  }

  return { baseUrl: BASE_URL };
}

// Main test function
export default function (data) {

  group('Health Check', () => {
    const start = Date.now();
    const res = http.get(`${data.baseUrl}/health`);
    healthCheckDuration.add(Date.now() - start);

    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response has status field': (r) => {
        try {
          return JSON.parse(r.body).status === 'healthy';
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  group('API Endpoints', () => {
    // Test public endpoints
    const start = Date.now();

    // Test root/info endpoint
    const infoRes = http.get(`${data.baseUrl}/api/v1/info`, {
      headers: { 'Content-Type': 'application/json' },
    });
    apiResponseTime.add(Date.now() - start);

    check(infoRes, {
      'API responds': (r) => r.status < 500,
    });

    // Test authentication endpoint (expect 401 without token)
    const authRes = http.get(`${data.baseUrl}/api/v1/auth/me`, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(authRes, {
      'Auth endpoint responds (401 expected)': (r) => r.status === 401 || r.status === 403,
    });
  });

  sleep(0.5);
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Final health check: ${http.get(`${data.baseUrl}/health`).status}`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const checks = data.root_group.checks || [];
  const metrics = data.metrics;

  let summary = '\n=== AGROBRIDGE LOAD TEST RESULTS ===\n\n';

  if (metrics.http_req_duration) {
    summary += `HTTP Request Duration:\n`;
    summary += `  - avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  - p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  - p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }

  if (metrics.http_reqs) {
    summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    summary += `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n\n`;
  }

  if (metrics.http_req_failed) {
    summary += `Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;
  }

  return summary;
}
