# AgroBridge API Load Testing

Production-grade load testing using [k6](https://k6.io/) by Grafana Labs.

## Prerequisites

```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Test Scripts

| Script | Description | Use Case |
|--------|-------------|----------|
| `k6-load-test.js` | Standard load test | Regular performance validation |
| `k6-stress-test.js` | Stress/breaking point test | Find system limits |

## Running Tests

### Local Development

```bash
# Basic load test (uses default localhost:3000)
k6 run tests/load/k6-load-test.js

# With authentication token
K6_ACCESS_TOKEN="your-jwt-token" k6 run tests/load/k6-load-test.js

# Against staging environment
K6_API_URL="https://api-staging.agrobridge.io" K6_ACCESS_TOKEN="token" k6 run tests/load/k6-load-test.js
```

### Stress Test (⚠️ Staging Only)

```bash
# Never run against production!
K6_API_URL="https://api-staging.agrobridge.io" K6_ACCESS_TOKEN="token" k6 run tests/load/k6-stress-test.js
```

### Docker

```bash
docker run -i grafana/k6 run - <tests/load/k6-load-test.js
```

## Performance Thresholds

### Load Test (Normal Traffic)

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Response Time (p95) | < 500ms | 95th percentile |
| Response Time (p99) | < 1000ms | 99th percentile |
| Error Rate | < 5% | Request failures |
| HTTP Failures | < 1% | Connection issues |

### Stress Test (Peak Traffic)

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Response Time (p95) | < 2000ms | Under stress |
| Error Rate | < 10% | Acceptable degradation |
| HTTP Failures | < 5% | Connection issues |

## Output & Analysis

### Console Output

```bash
k6 run --out json=results.json tests/load/k6-load-test.js
```

### InfluxDB + Grafana (Production)

```bash
K6_OUT="influxdb=http://localhost:8086/k6" k6 run tests/load/k6-load-test.js
```

### Cloud Dashboard (k6 Cloud)

```bash
k6 cloud tests/load/k6-load-test.js
```

## Interpreting Results

### Key Metrics

- **http_req_duration**: Total request time (includes network + server processing)
- **http_req_waiting**: Time waiting for server response (TTFB)
- **http_req_failed**: Percentage of failed requests
- **vus**: Number of virtual users at each point

### Example Output

```
     ✓ health status 200
     ✓ batches status 200

     checks.........................: 98.50% ✓ 1970  ✗ 30
     data_received..................: 15 MB  250 kB/s
     data_sent......................: 1.2 MB 20 kB/s
     http_req_duration..............: avg=245ms min=10ms med=200ms max=2s p(90)=450ms p(95)=500ms
     http_req_failed................: 0.50%  ✓ 10    ✗ 1990
     http_reqs......................: 2000   33/s
     vus............................: 50     min=1   max=100
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Load Tests
  uses: grafana/k6-action@v0.3.0
  with:
    filename: tests/load/k6-load-test.js
  env:
    K6_API_URL: ${{ secrets.STAGING_API_URL }}
    K6_ACCESS_TOKEN: ${{ secrets.TEST_TOKEN }}
```

## Best Practices

1. **Never run stress tests against production** - Use staging only
2. **Get baseline metrics first** - Run load tests before making changes
3. **Test during low-traffic periods** - Avoid impacting real users on staging
4. **Monitor backend systems** - Check database, memory, CPU during tests
5. **Test critical paths** - Focus on revenue-critical endpoints (certificates, payments)
6. **Gradual load increase** - Use ramping stages to identify breaking points
