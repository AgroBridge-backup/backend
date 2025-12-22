/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CASH FLOW BRIDGE - FRONTEND SERVICE
 * API client for Cash Flow Bridge endpoints
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import api from './api';

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type RiskTier = 'A' | 'B' | 'C';
export type AdvanceStatus =
  | 'PENDING_APPROVAL'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'DELIVERY_IN_PROGRESS'
  | 'DELIVERY_CONFIRMED'
  | 'PARTIALLY_REPAID'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'DEFAULT_WARNING'
  | 'DEFAULTED'
  | 'IN_COLLECTIONS'
  | 'CANCELLED';

export interface CreditScore {
  id: string;
  producerId: string;
  overallScore: number;
  riskTier: RiskTier;
  deliveryScore: number;
  qualityScore: number;
  paymentScore: number;
  volumeScore: number;
  blockchainScore: number;
  maxAdvanceAmount: number;
  availableCredit: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  lastCalculatedAt: string;
}

export interface LiquidityPool {
  id: string;
  name: string;
  description?: string;
  totalCapital: number;
  availableCapital: number;
  deployedCapital: number;
  reservedCapital: number;
  riskTier: RiskTier;
  targetReturnRate: number;
  actualReturnRate: number;
  utilizationRate: number;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  totalAdvancesIssued: number;
  totalAdvancesCompleted: number;
  totalAdvancesDefaulted: number;
  defaultRate: number;
  createdAt: string;
}

export interface PoolMetrics {
  poolId: string;
  totalCapital: number;
  availableCapital: number;
  deployedCapital: number;
  utilizationRate: number;
  activeAdvances: number;
  completedAdvances: number;
  defaultedAdvances: number;
  defaultRate: number;
  totalDisbursed: number;
  totalRepaid: number;
  targetReturnRate: number;
  actualReturnRate: number;
}

export interface Advance {
  id: string;
  contractNumber: string;
  orderId: string;
  farmerId: string;
  farmerName?: string;
  status: AdvanceStatus;
  orderAmount: number;
  advanceAmount: number;
  advancePercentage: number;
  remainingBalance: number;
  amountRepaid: number;
  riskTier: RiskTier;
  creditScoreValue: number;
  disbursedAt?: string;
  dueDate: string;
  createdAt: string;
}

export interface AdvanceCalculation {
  orderId: string;
  orderAmount: number;
  advancePercentage: number;
  advanceAmount: number;
  farmerFeeAmount: number;
  platformFeeTotal: number;
  netAdvanceAmount: number;
  estimatedDueDate: string;
  riskTier: RiskTier;
}

export interface Order {
  id: string;
  orderNumber: string;
  producerId: string;
  productType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  advanceEligible: boolean;
  advanceRequested: boolean;
  expectedDeliveryDate: string;
  createdAt: string;
}

export interface Farmer {
  id: string;
  businessName: string;
  state: string;
  municipality: string;
  isWhitelisted: boolean;
  creditScore?: CreditScore;
}

// ════════════════════════════════════════════════════════════════════════════════
// LIQUIDITY POOL SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export const liquidityPoolService = {
  /**
   * Get all liquidity pools
   */
  async getPools(): Promise<LiquidityPool[]> {
    const response = await api.get('/liquidity-pools');
    return response.data.data;
  },

  /**
   * Get a single pool by ID
   */
  async getPool(poolId: string): Promise<LiquidityPool> {
    const response = await api.get(`/liquidity-pools/${poolId}`);
    return response.data.data;
  },

  /**
   * Get pool performance metrics
   */
  async getPoolMetrics(poolId: string): Promise<PoolMetrics> {
    const response = await api.get(`/liquidity-pools/${poolId}/metrics`);
    return response.data.data;
  },

  /**
   * Get pool transactions
   */
  async getPoolTransactions(poolId: string, page = 1, limit = 20) {
    const response = await api.get(`/liquidity-pools/${poolId}/transactions`, {
      params: { page, limit },
    });
    return response.data;
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// ADVANCE SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export const advanceService = {
  /**
   * Get all advances (admin view)
   */
  async getAdvances(params?: {
    status?: AdvanceStatus;
    poolId?: string;
    farmerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Advance[]; pagination: { total: number; page: number; limit: number } }> {
    const response = await api.get('/advances', { params });
    return response.data;
  },

  /**
   * Get a single advance by ID
   */
  async getAdvance(advanceId: string): Promise<Advance> {
    const response = await api.get(`/advances/${advanceId}`);
    return response.data.data;
  },

  /**
   * Get advances for a specific farmer
   */
  async getFarmerAdvances(farmerId: string): Promise<Advance[]> {
    const response = await api.get(`/advances/farmer/${farmerId}`);
    return response.data.data;
  },

  /**
   * Calculate advance terms for an order
   */
  async calculateAdvance(orderId: string): Promise<AdvanceCalculation> {
    const response = await api.post('/advances/calculate', { orderId });
    return response.data.data;
  },

  /**
   * Request an advance
   */
  async requestAdvance(data: {
    orderId: string;
    requestedAmount?: number;
    disbursementMethod?: string;
  }): Promise<Advance> {
    const response = await api.post('/advances', data);
    return response.data.data;
  },

  /**
   * Approve an advance (admin)
   */
  async approveAdvance(advanceId: string, notes?: string): Promise<Advance> {
    const response = await api.post(`/advances/${advanceId}/approve`, { notes });
    return response.data.data;
  },

  /**
   * Reject an advance (admin)
   */
  async rejectAdvance(advanceId: string, reason: string): Promise<Advance> {
    const response = await api.post(`/advances/${advanceId}/reject`, { reason });
    return response.data.data;
  },

  /**
   * Disburse an advance (admin)
   */
  async disburseAdvance(advanceId: string, paymentReference: string): Promise<Advance> {
    const response = await api.post(`/advances/${advanceId}/disburse`, { paymentReference });
    return response.data.data;
  },

  /**
   * Record a repayment
   */
  async recordRepayment(
    advanceId: string,
    data: {
      amount: number;
      paymentMethod: string;
      paymentReference: string;
    }
  ): Promise<Advance> {
    const response = await api.post(`/advances/${advanceId}/repay`, data);
    return response.data.data;
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// CREDIT SCORE SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export const creditScoreService = {
  /**
   * Get credit score for a producer
   */
  async getCreditScore(producerId: string): Promise<CreditScore> {
    const response = await api.get(`/credit-scores/${producerId}`);
    return response.data.data;
  },

  /**
   * Recalculate credit score
   */
  async recalculateCreditScore(producerId: string): Promise<CreditScore> {
    const response = await api.post(`/credit-scores/${producerId}/calculate`);
    return response.data.data;
  },

  /**
   * Get score history
   */
  async getScoreHistory(producerId: string, limit = 30) {
    const response = await api.get(`/credit-scores/${producerId}/history`, {
      params: { limit },
    });
    return response.data.data;
  },

  /**
   * Check eligibility for an advance
   */
  async checkEligibility(producerId: string, requestedAmount: number, orderId: string) {
    const response = await api.get(`/credit-scores/${producerId}/eligibility`, {
      params: { requestedAmount, orderId },
    });
    return response.data.data;
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE
// ════════════════════════════════════════════════════════════════════════════════

export const orderService = {
  /**
   * Get orders for a farmer
   */
  async getFarmerOrders(farmerId: string, advanceEligible?: boolean): Promise<Order[]> {
    const params = advanceEligible !== undefined ? { advanceEligible } : {};
    const response = await api.get(`/orders/farmer/${farmerId}`, { params });
    return response.data.data;
  },

  /**
   * Get a single order
   */
  async getOrder(orderId: string): Promise<Order> {
    const response = await api.get(`/orders/${orderId}`);
    return response.data.data;
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ════════════════════════════════════════════════════════════════════════════════

export default {
  liquidityPool: liquidityPoolService,
  advance: advanceService,
  creditScore: creditScoreService,
  order: orderService,
};
