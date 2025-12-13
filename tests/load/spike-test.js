import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Baseline
    { duration: '30s', target: 500 },  // SPIKE!
    { duration: '1m', target: 500 },   // Sustained spike
    { duration: '10s', target: 10 },   // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(99)<2000'], // 2s max during spike
    'http_req_failed': ['rate<0.15'],    // 15% error acceptable
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api-staging.agrobridge.io';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  let summary = '\n=== SPIKE TEST RESULTS ===\n\n';

  if (metrics.http_req_duration) {
    summary += `HTTP Request Duration:\n`;
    summary += `  - avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  - p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    summary += `  - max: ${metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  }

  if (metrics.http_reqs) {
    summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    summary += `Peak Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n\n`;
  }

  if (metrics.http_req_failed) {
    summary += `Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  }

  return summary;
}
