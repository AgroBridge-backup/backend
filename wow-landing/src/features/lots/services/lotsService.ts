/**
 * Lots Service - API calls for lots, certificates, and orders
 * Handles all backend communication for lot-related data
 */

import { get } from '/lib/apiClient';
import { API_ENDPOINTS } from '/config/api';
import type { BackendLot, Certificate, Order, TimelineEvent } from '/types';

/**
 * Fetch all lots from the backend
 */
export async function fetchLots(): Promise<BackendLot[]> {
  return get<BackendLot[]>(API_ENDPOINTS.LOTS);
}

/**
 * Fetch a single lot by ID
 */
export async function fetchLotById(lotId: string): Promise<BackendLot> {
  return get<BackendLot>(API_ENDPOINTS.LOT_BY_ID(lotId));
}

/**
 * Fetch a lot by code (e.g., "AVT-2024-001")
 */
export async function fetchLotByCode(code: string): Promise<BackendLot[]> {
  return get<BackendLot[]>(API_ENDPOINTS.LOT_BY_CODE(code));
}

/**
 * Fetch certificates for a specific lot
 */
export async function fetchCertificatesByLot(lotId: string): Promise<Certificate[]> {
  return get<Certificate[]>(API_ENDPOINTS.LOT_CERTIFICATES(lotId));
}

/**
 * Fetch orders for a specific lot
 */
export async function fetchOrdersByLot(lotId: string): Promise<Order[]> {
  return get<Order[]>(API_ENDPOINTS.LOT_ORDERS(lotId));
}

/**
 * Fetch timeline events for a specific lot
 */
export async function fetchTimelineByLot(lotId: string): Promise<TimelineEvent[]> {
  return get<TimelineEvent[]>(API_ENDPOINTS.LOT_TIMELINE(lotId));
}

// ============================================================================
// Utility Functions for Data Transformation
// ============================================================================

/**
 * Map backend lot status to frontend status
 */
export function mapBackendStatusToFrontend(
  backendStatus: BackendLot['status']
): 'verified' | 'pending' | 'rejected' {
  switch (backendStatus) {
    case 'DELIVERED':
      return 'verified';
    case 'PENDING':
    case 'IN_TRANSIT':
      return 'pending';
    case 'CANCELLED':
      return 'rejected';
    default:
      return 'pending';
  }
}

/**
 * Map Certificate type to human-readable string
 */
export function mapCertificateType(type: Certificate['type']): string {
  const map: Record<Certificate['type'], string> = {
    ORGANIC: 'Orgánico',
    FAIR_TRADE: 'Fair Trade',
    RAINFOREST_ALLIANCE: 'Rainforest Alliance',
    GLOBALGAP: 'GlobalGAP',
    BLOCKCHAIN_PROOF: 'Prueba Blockchain',
    CO2_FOOTPRINT: 'Huella de Carbono',
    QUALITY_ASSURANCE: 'Aseguramiento de Calidad',
  };
  return map[type] || type;
}

/**
 * Map Order status to human-readable string
 */
export function mapOrderStatus(status: Order['status']): string {
  const map: Record<Order['status'], string> = {
    CREATED: 'Creada',
    CONFIRMED: 'Confirmada',
    SHIPPED: 'Enviada',
    DELIVERED: 'Entregada',
    CANCELLED: 'Cancelada',
  };
  return map[status] || status;
}
