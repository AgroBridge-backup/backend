/**
 * API Configuration for AgroBridge Backend
 * Centralizes API base URL and timeout settings
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://api.agrobridge.io';

export const API_TIMEOUT_MS = 15000;

export const API_ENDPOINTS = {
  // Producers
  PRODUCERS: '/producers',
  PRODUCER_BY_ID: (id: string) => `/producers/${id}`,

  // Lots
  LOTS: '/lots',
  LOT_BY_ID: (id: string) => `/lots/${id}`,
  LOT_BY_CODE: (code: string) => `/lots?code=${encodeURIComponent(code)}`,
  LOT_CERTIFICATES: (lotId: string) => `/lots/${lotId}/certificates`,
  LOT_ORDERS: (lotId: string) => `/lots/${lotId}/orders`,
  LOT_TIMELINE: (lotId: string) => `/lots/${lotId}/timeline`,

  // Certificates
  CERTIFICATES: '/certificates',
  CERTIFICATE_BY_ID: (id: string) => `/certificates/${id}`,

  // Orders
  ORDERS: '/orders',
  ORDER_BY_ID: (id: string) => `/orders/${id}`,

  // Auth (for future use)
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
} as const;

// Utility to build full URL
export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
