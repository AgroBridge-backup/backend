import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Medium load
    { duration: '2m', target: 200 },  // High load
    { duration: '1m', target: 300 },  // Stress load
    { duration: '2m', target: 0 },    // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // More permissive for stress test
    'http_req_failed': ['rate<0.10'],    // 10% error rate acceptable in stress
    'errors': ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api-staging.agrobridge.io';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health`],
    ['GET', `${BASE_URL}/api/v1`],
  ]);

  responses.forEach((res) => {
    const ok = check(res, {
      'status is 200 or expected error': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(!ok);
    responseTime.add(res.timings.duration);
  });

  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  let summary = '\n=== STRESS TEST RESULTS ===\n\n';

  if (metrics.http_req_duration) {
    summary += `HTTP Request Duration:\n`;
    summary += `  - avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  - p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  - max: ${metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  }

  if (metrics.http_reqs) {
    summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    summary += `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n\n`;
  }

  if (metrics.errors) {
    summary += `Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return summary;
}
