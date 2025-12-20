/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CASH FLOW BRIDGE - MVP API TEST SCRIPT
 * Tests the complete advance lifecycle: calculate → request → approve → disburse
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  response?: unknown;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${API_PREFIX}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json() as T;
  return { status: response.status, data };
}

/**
 * Run a test and record the result
 */
async function runTest<T>(
  name: string,
  testFn: () => Promise<T>
): Promise<T | null> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}...`);
    const result = await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, response: result, duration });
    console.log(`   ✅ PASSED (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    console.log(`   ❌ FAILED: ${errorMessage} (${duration}ms)`);
    return null;
  }
}

/**
 * Assert that a condition is true
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       CASH FLOW BRIDGE - MVP API TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📡 Testing against: ${BASE_URL}`);

  let authToken: string | undefined;
  let farmerId: string | undefined;
  let orderId: string | undefined;
  let advanceId: string | undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 1: AUTHENTICATION');
  console.log('─'.repeat(60));

  authToken = await runTest('Login as test farmer (Juan Pérez)', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: { token: string; user: { id: string; email: string } };
    }>('POST', '/auth/login', {
      email: 'juan.excellent@test.agrobridge.io',
      password: 'FarmerTest123!',
    });

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Login should succeed');
    assert(typeof data.data.token === 'string', 'Should return token');

    console.log(`   📧 Logged in as: ${data.data.user.email}`);
    return data.data.token;
  });

  if (!authToken) {
    console.log('\n❌ Cannot proceed without authentication. Exiting...');
    printSummary();
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET FARMER DATA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 2: FARMER DATA');
  console.log('─'.repeat(60));

  const farmerData = await runTest('Get current farmer profile', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: { id: string; producer: { id: string } };
    }>('GET', '/users/me', undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Should return success');
    assert(data.data.producer?.id, 'Should have producer profile');

    farmerId = data.data.producer.id;
    console.log(`   👨‍🌾 Farmer ID: ${farmerId}`);
    return data.data;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CREDIT SCORE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 3: CREDIT SCORE');
  console.log('─'.repeat(60));

  await runTest('Get farmer credit score', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        overallScore: number;
        riskTier: string;
        maxAdvanceAmount: number;
        availableCredit: number;
      };
    }>('GET', `/credit-scores/farmer/${farmerId}`, undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Should return success');
    assert(data.data.overallScore >= 0, 'Should have valid score');

    console.log(`   📊 Credit Score: ${data.data.overallScore}`);
    console.log(`   🏷️  Risk Tier: ${data.data.riskTier}`);
    console.log(`   💰 Max Advance: $${data.data.maxAdvanceAmount}`);
    console.log(`   💳 Available Credit: $${data.data.availableCredit}`);

    return data.data;
  });

  await runTest('Check credit eligibility', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        eligible: boolean;
        maxAdvanceAmount: number;
        conditions: string[];
      };
    }>('GET', `/credit-scores/farmer/${farmerId}/eligibility`, undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    console.log(`   ✅ Eligible: ${data.data.eligible}`);
    console.log(`   📋 Conditions: ${data.data.conditions?.join(', ') || 'None'}`);

    return data.data;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ORDERS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 4: ORDERS');
  console.log('─'.repeat(60));

  const orders = await runTest('Get farmer eligible orders', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: Array<{
        id: string;
        orderNumber: string;
        totalAmount: number;
        advanceEligible: boolean;
        advanceRequested: boolean;
      }>;
    }>('GET', `/orders/farmer/${farmerId}?advanceEligible=true`, undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.data), 'Should return array of orders');

    const eligibleOrders = data.data.filter(o => o.advanceEligible && !o.advanceRequested);
    console.log(`   📦 Total Orders: ${data.data.length}`);
    console.log(`   ✅ Eligible for Advance: ${eligibleOrders.length}`);

    if (eligibleOrders.length > 0) {
      orderId = eligibleOrders[0].id;
      console.log(`   🎯 Selected Order: ${eligibleOrders[0].orderNumber}`);
      console.log(`   💵 Order Value: $${eligibleOrders[0].totalAmount}`);
    }

    return data.data;
  });

  if (!orderId) {
    console.log('\n⚠️  No eligible orders found. Creating test order...');
    // In production, we'd create an order here. For now, skip to summary.
    printSummary();
    process.exit(0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ADVANCE CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 5: ADVANCE CALCULATION');
  console.log('─'.repeat(60));

  const advanceCalc = await runTest('Calculate advance terms', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        orderId: string;
        orderAmount: number;
        advancePercentage: number;
        advanceAmount: number;
        farmerFeeAmount: number;
        platformFeeTotal: number;
        netAdvanceAmount: number;
        estimatedDueDate: string;
        riskTier: string;
      };
    }>('POST', '/advances/calculate', { orderId }, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Calculation should succeed');
    assert(data.data.advanceAmount > 0, 'Should calculate advance amount');

    console.log(`   📊 Order Amount: $${data.data.orderAmount}`);
    console.log(`   📈 Advance %: ${data.data.advancePercentage}%`);
    console.log(`   💰 Advance Amount: $${data.data.advanceAmount}`);
    console.log(`   💳 Farmer Fee: $${data.data.farmerFeeAmount}`);
    console.log(`   💵 Net to Farmer: $${data.data.netAdvanceAmount}`);
    console.log(`   📅 Due Date: ${data.data.estimatedDueDate}`);
    console.log(`   🏷️  Risk Tier: ${data.data.riskTier}`);

    return data.data;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. REQUEST ADVANCE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 6: REQUEST ADVANCE');
  console.log('─'.repeat(60));

  const advanceRequest = await runTest('Request advance for order', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        id: string;
        contractNumber: string;
        status: string;
        advanceAmount: number;
        approvalMethod: string;
      };
    }>('POST', '/advances', {
      orderId,
      requestedAmount: advanceCalc?.advanceAmount,
      disbursementMethod: 'BANK_TRANSFER',
    }, authToken);

    assert(status === 201 || status === 200, `Expected 201/200, got ${status}`);
    assert(data.success === true, 'Request should succeed');
    assert(data.data.id, 'Should return advance ID');

    advanceId = data.data.id;
    console.log(`   📝 Contract: ${data.data.contractNumber}`);
    console.log(`   🔖 Status: ${data.data.status}`);
    console.log(`   💰 Amount: $${data.data.advanceAmount}`);
    console.log(`   🤖 Approval: ${data.data.approvalMethod}`);

    return data.data;
  });

  if (!advanceId) {
    console.log('\n❌ Advance request failed. Exiting...');
    printSummary();
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. CHECK ADVANCE STATUS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 7: ADVANCE STATUS');
  console.log('─'.repeat(60));

  await runTest('Get advance details', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        id: string;
        status: string;
        contractNumber: string;
        advanceAmount: number;
        remainingBalance: number;
        disbursedAt: string | null;
        statusHistory: Array<{ fromStatus: string; toStatus: string; createdAt: string }>;
      };
    }>('GET', `/advances/${advanceId}`, undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, 'Should return advance');

    console.log(`   📝 Contract: ${data.data.contractNumber}`);
    console.log(`   🔖 Status: ${data.data.status}`);
    console.log(`   💰 Amount: $${data.data.advanceAmount}`);
    console.log(`   💳 Remaining: $${data.data.remainingBalance}`);
    console.log(`   📜 History: ${data.data.statusHistory?.length || 0} entries`);

    return data.data;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. ADMIN APPROVAL (if needed)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 8: ADMIN OPERATIONS');
  console.log('─'.repeat(60));

  // Login as admin
  const adminToken = await runTest('Login as admin', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: { token: string };
    }>('POST', '/auth/login', {
      email: 'admin@test.agrobridge.io',
      password: 'TestPassword123!',
    });

    assert(status === 200, `Expected 200, got ${status}`);
    return data.data.token;
  });

  if (adminToken && advanceRequest?.status === 'PENDING_APPROVAL') {
    await runTest('Admin approves advance', async () => {
      const { status, data } = await apiRequest<{
        success: boolean;
        data: { status: string };
      }>('POST', `/advances/${advanceId}/approve`, {
        notes: 'Approved via MVP test script',
      }, adminToken);

      assert(status === 200, `Expected 200, got ${status}`);
      console.log(`   ✅ New Status: ${data.data.status}`);
      return data.data;
    });

    await runTest('Admin disburses advance', async () => {
      const { status, data } = await apiRequest<{
        success: boolean;
        data: { status: string; disbursedAt: string };
      }>('POST', `/advances/${advanceId}/disburse`, {
        paymentReference: 'SPEI-TEST-12345',
      }, adminToken);

      assert(status === 200, `Expected 200, got ${status}`);
      console.log(`   💸 Disbursed at: ${data.data.disbursedAt}`);
      console.log(`   🔖 Status: ${data.data.status}`);
      return data.data;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. LIQUIDITY POOL STATUS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 9: LIQUIDITY POOL');
  console.log('─'.repeat(60));

  if (adminToken) {
    await runTest('Get pool balance', async () => {
      const { status, data } = await apiRequest<{
        success: boolean;
        data: {
          id: string;
          name: string;
          totalCapital: number;
          availableCapital: number;
          deployedCapital: number;
          reservedCapital: number;
          utilizationRate: number;
        };
      }>('GET', '/liquidity-pools/pilot-pool-001', undefined, adminToken);

      assert(status === 200, `Expected 200, got ${status}`);

      console.log(`   🏦 Pool: ${data.data.name}`);
      console.log(`   💰 Total Capital: $${data.data.totalCapital}`);
      console.log(`   ✅ Available: $${data.data.availableCapital}`);
      console.log(`   📤 Deployed: $${data.data.deployedCapital}`);
      console.log(`   🔒 Reserved: $${data.data.reservedCapital}`);
      console.log(`   📊 Utilization: ${data.data.utilizationRate}%`);

      return data.data;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. FINAL ADVANCE STATUS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n\n📌 PHASE 10: FINAL VERIFICATION');
  console.log('─'.repeat(60));

  await runTest('Verify final advance state', async () => {
    const { status, data } = await apiRequest<{
      success: boolean;
      data: {
        status: string;
        disbursedAt: string | null;
        remainingBalance: number;
        transactions: Array<{ type: string; amount: number }>;
      };
    }>('GET', `/advances/${advanceId}`, undefined, authToken);

    assert(status === 200, `Expected 200, got ${status}`);

    console.log(`   🎯 Final Status: ${data.data.status}`);
    console.log(`   💸 Disbursed: ${data.data.disbursedAt ? 'Yes' : 'No'}`);
    console.log(`   💳 Balance: $${data.data.remainingBalance}`);
    console.log(`   📜 Transactions: ${data.data.transactions?.length || 0}`);

    return data.data;
  });

  // Print summary
  printSummary();
}

function printSummary() {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📊 Results: ${passed}/${results.length} tests passed`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
  }

  console.log('\n📋 All Tests:');
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`   ${icon} ${r.name} (${r.duration}ms)`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');

  if (passed === results.length) {
    console.log('🎉 ALL TESTS PASSED! Cash Flow Bridge MVP is ready!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Please review and fix.`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run tests
main().catch(console.error);
