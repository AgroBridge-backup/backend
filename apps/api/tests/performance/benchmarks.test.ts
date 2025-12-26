/**
 * @file Performance Benchmarks
 * @description Measure and track performance of critical system components
 *
 * Components tested:
 * - Database query performance
 * - Cache operation performance
 * - API endpoint latency
 * - Memory usage patterns
 *
 * Prerequisites:
 * - Server running
 * - Redis running
 * - Database with test data
 *
 * Run: npm run test:benchmarks
 *
 * @author AgroBridge Engineering Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:3000';
const BENCHMARK_ITERATIONS = 100;
const WARMUP_ITERATIONS = 10;

// Check if API server is available
let serverAvailable = false;
async function checkServerAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  opsPerSecond: number;
}

interface Threshold {
  p95MaxMs: number;
  p99MaxMs: number;
  opsMinPerSecond?: number;
}

// Performance thresholds for validation (relaxed for CI/test environments)
const THRESHOLDS = {
  cacheGet: { p95MaxMs: 50, p99MaxMs: 100 },
  cacheSet: { p95MaxMs: 50, p99MaxMs: 100 },
  cacheGetOrSet: { p95MaxMs: 100, p99MaxMs: 200 },
  dbSimpleQuery: { p95MaxMs: 100, p99MaxMs: 200 },
  dbComplexQuery: { p95MaxMs: 200, p99MaxMs: 400 },
  dbWrite: { p95MaxMs: 200, p99MaxMs: 400 },
  apiHealthCheck: { p95MaxMs: 100, p99MaxMs: 200 },
  apiBatchList: { p95MaxMs: 400, p99MaxMs: 1000 },
  apiBatchDetail: { p95MaxMs: 100, p99MaxMs: 200 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// BENCHMARK UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, index)];
}

/**
 * Run a benchmark function multiple times
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = BENCHMARK_ITERATIONS,
  warmupIterations: number = WARMUP_ITERATIONS
): Promise<BenchmarkResult> {
  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Allow GC to run
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Measurement phase
  const timings: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  // Sort for percentile calculations
  timings.sort((a, b) => a - b);

  const totalMs = timings.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;

  return {
    name,
    iterations,
    totalMs,
    avgMs,
    minMs: timings[0],
    maxMs: timings[timings.length - 1],
    p50Ms: percentile(timings, 50),
    p95Ms: percentile(timings, 95),
    p99Ms: percentile(timings, 99),
    opsPerSecond: 1000 / avgMs,
  };
}

/**
 * Print benchmark result in a formatted table
 */
function printBenchmarkResult(result: BenchmarkResult): void {
  console.log(`
┌──────────────────────────────────────────────────────────────────┐
│ Benchmark: ${result.name.padEnd(51)} │
├──────────────────────────────────────────────────────────────────┤
│ Iterations:  ${String(result.iterations).padEnd(50)} │
│ Total Time:  ${result.totalMs.toFixed(2).padEnd(47)} ms │
│ Average:     ${result.avgMs.toFixed(3).padEnd(47)} ms │
│ Min:         ${result.minMs.toFixed(3).padEnd(47)} ms │
│ Max:         ${result.maxMs.toFixed(3).padEnd(47)} ms │
│ P50:         ${result.p50Ms.toFixed(3).padEnd(47)} ms │
│ P95:         ${result.p95Ms.toFixed(3).padEnd(47)} ms │
│ P99:         ${result.p99Ms.toFixed(3).padEnd(47)} ms │
│ Ops/sec:     ${result.opsPerSecond.toFixed(2).padEnd(50)} │
└──────────────────────────────────────────────────────────────────┘
`);
}

/**
 * Validate benchmark result against thresholds
 */
function validateThreshold(result: BenchmarkResult, threshold: Threshold): boolean {
  const p95Ok = result.p95Ms <= threshold.p95MaxMs;
  const p99Ok = result.p99Ms <= threshold.p99MaxMs;
  const opsOk = threshold.opsMinPerSecond
    ? result.opsPerSecond >= threshold.opsMinPerSecond
    : true;

  return p95Ok && p99Ok && opsOk;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

let prisma: PrismaClient;
let redis: Redis;

beforeAll(async () => {
  prisma = new PrismaClient({
    log: [], // Disable logging for benchmarks
  });
  await prisma.$connect();

  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
  });

  // Wait for Redis to be ready
  await new Promise<void>((resolve) => {
    if (redis.status === 'ready') {
      resolve();
    } else {
      redis.once('ready', resolve);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  PERFORMANCE BENCHMARK SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  BENCHMARK SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
});

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cache Performance Benchmarks', () => {
  const testKey = 'benchmark:test:key';
  const testData = {
    id: 'test-id',
    name: 'Test Benchmark Data',
    nested: {
      field1: 'value1',
      field2: 123,
      array: [1, 2, 3, 4, 5],
    },
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    await redis.del(testKey);
  });

  it('should benchmark cache SET operations', async () => {
    const result = await runBenchmark(
      'Cache SET',
      async () => {
        await redis.setex(testKey, 300, JSON.stringify(testData));
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.cacheSet.p95MaxMs);
    expect(result.p99Ms).toBeLessThan(THRESHOLDS.cacheSet.p99MaxMs);
  });

  it('should benchmark cache GET operations (hit)', async () => {
    // Pre-populate cache
    await redis.setex(testKey, 300, JSON.stringify(testData));

    const result = await runBenchmark(
      'Cache GET (hit)',
      async () => {
        await redis.get(testKey);
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.cacheGet.p95MaxMs);
    expect(result.p99Ms).toBeLessThan(THRESHOLDS.cacheGet.p99MaxMs);
  });

  it('should benchmark cache GET operations (miss)', async () => {
    const result = await runBenchmark(
      'Cache GET (miss)',
      async () => {
        await redis.get('benchmark:nonexistent:key');
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.cacheGet.p95MaxMs);
    expect(result.p99Ms).toBeLessThan(THRESHOLDS.cacheGet.p99MaxMs);
  });

  it('should benchmark cache GET + SET (cache-aside pattern)', async () => {
    let counter = 0;

    const result = await runBenchmark(
      'Cache GET + SET (cache-aside)',
      async () => {
        const key = `benchmark:aside:${counter++ % 100}`;
        const cached = await redis.get(key);

        if (!cached) {
          // Simulate fetching from database
          await new Promise((resolve) => setTimeout(resolve, 1));
          await redis.setex(key, 300, JSON.stringify(testData));
        }
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.cacheGetOrSet.p95MaxMs);
  });

  it('should benchmark cache DELETE operations', async () => {
    // Pre-populate keys
    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      await redis.setex(`benchmark:del:${i}`, 300, JSON.stringify(testData));
    }

    let counter = 0;
    const result = await runBenchmark(
      'Cache DELETE',
      async () => {
        await redis.del(`benchmark:del:${counter++}`);
      },
      BENCHMARK_ITERATIONS,
      0 // No warmup needed
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(100);
  });

  it('should benchmark cache MGET (batch read)', async () => {
    // Pre-populate 10 keys
    const keys = [];
    for (let i = 0; i < 10; i++) {
      const key = `benchmark:mget:${i}`;
      keys.push(key);
      await redis.setex(key, 300, JSON.stringify({ ...testData, index: i }));
    }

    const result = await runBenchmark(
      'Cache MGET (10 keys)',
      async () => {
        await redis.mget(...keys);
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(100);
  });

  it('should benchmark cache pipeline operations', async () => {
    const result = await runBenchmark(
      'Cache Pipeline (5 ops)',
      async () => {
        const pipeline = redis.pipeline();
        for (let i = 0; i < 5; i++) {
          pipeline.setex(`benchmark:pipeline:${i}`, 300, JSON.stringify(testData));
        }
        await pipeline.exec();
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Database Performance Benchmarks', () => {
  it('should benchmark simple count query', async () => {
    const result = await runBenchmark(
      'DB: COUNT batches',
      async () => {
        await prisma.batch.count();
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbSimpleQuery.p95MaxMs);
  });

  it('should benchmark findMany with limit', async () => {
    const result = await runBenchmark(
      'DB: SELECT batches LIMIT 20',
      async () => {
        await prisma.batch.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbSimpleQuery.p95MaxMs);
  });

  it('should benchmark findMany with relations', async () => {
    const result = await runBenchmark(
      'DB: SELECT batches with producer',
      async () => {
        await prisma.batch.findMany({
          take: 10,
          include: {
            producer: {
              select: { id: true, businessName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbComplexQuery.p95MaxMs);
  });

  it('should benchmark findMany with multiple relations', async () => {
    const result = await runBenchmark(
      'DB: SELECT batches with producer + events',
      async () => {
        await prisma.batch.findMany({
          take: 5,
          include: {
            producer: {
              select: { id: true, businessName: true },
            },
            events: {
              take: 5,
              orderBy: { timestamp: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbComplexQuery.p99MaxMs);
  });

  it('should benchmark findMany with filters', async () => {
    const result = await runBenchmark(
      'DB: SELECT batches with filter',
      async () => {
        await prisma.batch.findMany({
          where: {
            status: 'REGISTERED',
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbSimpleQuery.p95MaxMs);
  });

  it('should benchmark aggregate query', async () => {
    const result = await runBenchmark(
      'DB: AGGREGATE batch stats',
      async () => {
        await prisma.batch.aggregate({
          _count: true,
          _sum: { weightKg: true },
          _avg: { weightKg: true },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbSimpleQuery.p95MaxMs);
  });

  it('should benchmark groupBy query', async () => {
    const result = await runBenchmark(
      'DB: GROUP BY status',
      async () => {
        await prisma.batch.groupBy({
          by: ['status'],
          _count: true,
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbComplexQuery.p95MaxMs);
  });

  it('should benchmark findFirst with index', async () => {
    const result = await runBenchmark(
      'DB: findFirst by status (indexed)',
      async () => {
        await prisma.batch.findFirst({
          where: { status: 'REGISTERED' },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbSimpleQuery.p95MaxMs);
  });

  it('should benchmark producer with batch count', async () => {
    const result = await runBenchmark(
      'DB: SELECT producer with batch count',
      async () => {
        await prisma.producer.findMany({
          take: 10,
          include: {
            _count: {
              select: { batches: true },
            },
          },
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbComplexQuery.p95MaxMs);
  });

  it('should benchmark event count by type', async () => {
    const result = await runBenchmark(
      'DB: EVENT count by type',
      async () => {
        await prisma.traceabilityEvent.groupBy({
          by: ['eventType'],
          _count: true,
        });
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.dbComplexQuery.p95MaxMs);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINT BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('API Endpoint Benchmarks', () => {
  beforeAll(async () => {
    serverAvailable = await checkServerAvailable();
    if (!serverAvailable) {
      console.log('⚠️ API server not available, skipping API endpoint benchmarks');
    }
  });

  it('should benchmark health endpoint', async () => {
    if (!serverAvailable) {
      console.log('⏭️ Skipping: server not available');
      return;
    }
    const result = await runBenchmark(
      'API: GET /health',
      async () => {
        await fetch(`${BASE_URL}/health`);
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.apiHealthCheck.p95MaxMs);
  });

  it('should benchmark health/ready endpoint', async () => {
    if (!serverAvailable) {
      console.log('⏭️ Skipping: server not available');
      return;
    }
    const result = await runBenchmark(
      'API: GET /health/ready',
      async () => {
        await fetch(`${BASE_URL}/health/ready`);
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    expect(result.p95Ms).toBeLessThan(THRESHOLDS.apiHealthCheck.p95MaxMs);
  });

  it('should benchmark batch list endpoint (unauthenticated)', async () => {
    if (!serverAvailable) {
      console.log('⏭️ Skipping: server not available');
      return;
    }
    const result = await runBenchmark(
      'API: GET /api/v1/batches',
      async () => {
        await fetch(`${BASE_URL}/api/v1/batches?page=1&limit=20`);
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    // May fail if auth required, but measures response time
    expect(result.p99Ms).toBeLessThan(1000);
  });

  it('should benchmark concurrent API requests', async () => {
    if (!serverAvailable) {
      console.log('⏭️ Skipping: server not available');
      return;
    }
    const concurrency = 10;
    let totalDuration = 0;
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await Promise.all(
        Array(concurrency)
          .fill(null)
          .map(() => fetch(`${BASE_URL}/health`))
      );

      totalDuration += performance.now() - start;
    }

    const avgDuration = totalDuration / iterations;
    const avgPerRequest = avgDuration / concurrency;

    console.log(`
┌──────────────────────────────────────────────────────────────────┐
│ Benchmark: Concurrent API Requests (${concurrency} concurrent)                │
├──────────────────────────────────────────────────────────────────┤
│ Iterations:  ${String(iterations).padEnd(50)} │
│ Avg Batch:   ${avgDuration.toFixed(2).padEnd(47)} ms │
│ Avg/Request: ${avgPerRequest.toFixed(2).padEnd(47)} ms │
└──────────────────────────────────────────────────────────────────┘
`);

    expect(avgPerRequest).toBeLessThan(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERIALIZATION BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Serialization Benchmarks', () => {
  const complexObject = {
    id: 'benchmark-id',
    name: 'Benchmark Batch',
    variety: 'HASS',
    origin: 'Michoacán, Mexico',
    weightKg: 500,
    harvestDate: new Date().toISOString(),
    status: 'REGISTERED',
    producer: {
      id: 'producer-id',
      name: 'Test Producer',
      certifications: ['ORGANIC', 'FAIR_TRADE'],
      location: {
        latitude: 19.4326,
        longitude: -99.1332,
      },
    },
    events: Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `event-${i}`,
        eventType: 'HARVEST',
        timestamp: new Date().toISOString(),
        locationName: 'Harvest Site',
        latitude: 19.4326 + i * 0.01,
        longitude: -99.1332 + i * 0.01,
      })),
    metadata: {
      blockchainHash: '0x' + 'a'.repeat(64),
      verified: true,
      certifications: ['cert1', 'cert2', 'cert3'],
    },
  };

  it('should benchmark JSON.stringify', async () => {
    const result = await runBenchmark(
      'JSON.stringify (complex object)',
      async () => {
        JSON.stringify(complexObject);
      },
      BENCHMARK_ITERATIONS * 10 // More iterations for fast operation
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(10);
  });

  it('should benchmark JSON.parse', async () => {
    const serialized = JSON.stringify(complexObject);

    const result = await runBenchmark(
      'JSON.parse (complex object)',
      async () => {
        JSON.parse(serialized);
      },
      BENCHMARK_ITERATIONS * 10
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(10);
  });

  it('should benchmark full cache round-trip', async () => {
    const key = 'benchmark:roundtrip:key';

    const result = await runBenchmark(
      'Cache round-trip (serialize + store + retrieve + parse)',
      async () => {
        // Serialize and store
        const serialized = JSON.stringify(complexObject);
        await redis.setex(key, 300, serialized);

        // Retrieve and parse
        const retrieved = await redis.get(key);
        if (retrieved) {
          JSON.parse(retrieved);
        }
      },
      BENCHMARK_ITERATIONS
    );

    printBenchmarkResult(result);

    // Relaxed threshold for CI/test environments
    expect(result.p95Ms).toBeLessThan(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Memory Usage Benchmarks', () => {
  it('should track memory during batch processing', async () => {
    const initialMemory = process.memoryUsage();

    // Simulate batch processing
    const batches = [];
    for (let i = 0; i < 1000; i++) {
      batches.push({
        id: `batch-${i}`,
        variety: 'HASS',
        origin: 'Test Origin',
        weightKg: 500,
        events: Array(5)
          .fill(null)
          .map(() => ({
            id: `event-${Math.random()}`,
            timestamp: new Date(),
          })),
      });
    }

    const afterCreation = process.memoryUsage();

    // Process batches (serialize/deserialize)
    for (const batch of batches) {
      JSON.parse(JSON.stringify(batch));
    }

    const afterProcessing = process.memoryUsage();

    // Clear
    batches.length = 0;

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const afterCleanup = process.memoryUsage();

    console.log(`
┌──────────────────────────────────────────────────────────────────┐
│ Memory Usage: Batch Processing (1000 items)                      │
├──────────────────────────────────────────────────────────────────┤
│ Initial Heap:     ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Creation:   ${(afterCreation.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Processing: ${(afterProcessing.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Cleanup:    ${(afterCleanup.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ Peak Increase:    ${((afterProcessing.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2).padEnd(42)} MB │
└──────────────────────────────────────────────────────────────────┘
`);

    // Ensure memory is released (with some tolerance)
    const memoryLeakThreshold = 50 * 1024 * 1024; // 50MB tolerance
    expect(afterCleanup.heapUsed - initialMemory.heapUsed).toBeLessThan(memoryLeakThreshold);
  });

  it('should track memory during large JSON operations', async () => {
    const initialMemory = process.memoryUsage();

    // Create large JSON
    const largeArray = Array(10000)
      .fill(null)
      .map((_, i) => ({
        id: i,
        data: 'x'.repeat(100),
        nested: { a: 1, b: 2, c: [1, 2, 3] },
      }));

    const afterCreation = process.memoryUsage();

    // Serialize
    const serialized = JSON.stringify(largeArray);

    const afterSerialize = process.memoryUsage();

    // Parse
    JSON.parse(serialized);

    const afterParse = process.memoryUsage();

    console.log(`
┌──────────────────────────────────────────────────────────────────┐
│ Memory Usage: Large JSON Operations (10000 items)                │
├──────────────────────────────────────────────────────────────────┤
│ Initial Heap:     ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Creation:   ${(afterCreation.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Serialize:  ${(afterSerialize.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ After Parse:      ${(afterParse.heapUsed / 1024 / 1024).toFixed(2).padEnd(42)} MB │
│ String Size:      ${(serialized.length / 1024 / 1024).toFixed(2).padEnd(42)} MB │
└──────────────────────────────────────────────────────────────────┘
`);

    expect(serialized.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Benchmark Summary', () => {
  it('should generate summary report', async () => {
    // This test runs last and generates a summary
    console.log(`
═══════════════════════════════════════════════════════════════════
                    PERFORMANCE THRESHOLDS
═══════════════════════════════════════════════════════════════════

Component              P95 Max (ms)    P99 Max (ms)
─────────────────────────────────────────────────────────────────
Cache GET              ${THRESHOLDS.cacheGet.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.cacheGet.p99MaxMs}
Cache SET              ${THRESHOLDS.cacheSet.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.cacheSet.p99MaxMs}
Cache Get-Or-Set       ${THRESHOLDS.cacheGetOrSet.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.cacheGetOrSet.p99MaxMs}
DB Simple Query        ${THRESHOLDS.dbSimpleQuery.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.dbSimpleQuery.p99MaxMs}
DB Complex Query       ${THRESHOLDS.dbComplexQuery.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.dbComplexQuery.p99MaxMs}
DB Write               ${THRESHOLDS.dbWrite.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.dbWrite.p99MaxMs}
API Health Check       ${THRESHOLDS.apiHealthCheck.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.apiHealthCheck.p99MaxMs}
API Batch List         ${THRESHOLDS.apiBatchList.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.apiBatchList.p99MaxMs}
API Batch Detail       ${THRESHOLDS.apiBatchDetail.p95MaxMs.toString().padEnd(15)} ${THRESHOLDS.apiBatchDetail.p99MaxMs}

═══════════════════════════════════════════════════════════════════
`);

    expect(true).toBe(true); // Summary test always passes
  });
});
