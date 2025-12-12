/**
 * Generic API Client for AgroBridge Backend
 * Provides type-safe fetch wrapper with error handling
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '../config/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions<TBody = unknown> {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  authToken?: string | null;
  cache?: RequestCache;
  timeout?: number;
}

export interface ApiError {
  status: number;
  statusText: string;
  message: string;
  url: string;
}

/**
 * Safely constructs full URL from base and path
 */
function buildUrl(base: string, path: string): URL {
  const baseUrl = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(cleanPath, baseUrl);
}

/**
 * Generic API request function with timeout support
 */
export async function apiRequest<TResponse, TBody = unknown>(
  options: ApiRequestOptions<TBody>
): Promise<TResponse> {
  const {
    method = 'GET',
    path,
    query,
    body,
    authToken,
    cache = 'no-store',
    timeout = API_TIMEOUT_MS,
  } = options;

  // Build URL with query parameters
  const url = buildUrl(API_BASE_URL, path);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  // Build headers - only set Content-Type if we have a body
  const headers: HeadersInit = {};

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const error: ApiError = {
        status: res.status,
        statusText: res.statusText,
        message: text || `API error ${res.status} ${res.statusText}`,
        url: url.toString(),
      };
      throw error;
    }

    return (await res.json()) as TResponse;
  } catch (err) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutError: ApiError = {
        status: 408,
        statusText: 'Request Timeout',
        message: `Request timed out after ${timeout}ms`,
        url: url.toString(),
      };
      throw timeoutError;
    }

    // Handle network errors (CORS, etc.)
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      const networkError: ApiError = {
        status: 0,
        statusText: 'Network Error',
        message: 'Cannot connect to API. Check your internet connection or CORS configuration.',
        url: url.toString(),
      };
      throw networkError;
    }

    // Wrap unknown errors in ApiError format
    if (!(err as ApiError).status) {
      const wrappedError: ApiError = {
        status: 0,
        statusText: 'Unknown Error',
        message: err instanceof Error ? err.message : 'An unknown error occurred',
        url: url.toString(),
      };
      throw wrappedError;
    }

    throw err;
  }
}

/**
 * GET request helper
 */
export async function get<TResponse>(
  path: string,
  options?: Omit<ApiRequestOptions, 'method' | 'path' | 'body'>
): Promise<TResponse> {
  return apiRequest<TResponse>({ ...options, method: 'GET', path });
}

/**
 * POST request helper
 */
export async function post<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options?: Omit<ApiRequestOptions<TBody>, 'method' | 'path' | 'body'>
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>({ ...options, method: 'POST', path, body });
}

/**
 * PUT request helper
 */
export async function put<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options?: Omit<ApiRequestOptions<TBody>, 'method' | 'path' | 'body'>
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>({ ...options, method: 'PUT', path, body });
}

/**
 * PATCH request helper
 */
export async function patch<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options?: Omit<ApiRequestOptions<TBody>, 'method' | 'path' | 'body'>
): Promise<TResponse> {
  return apiRequest<TResponse, TBody>({ ...options, method: 'PATCH', path, body });
}

/**
 * DELETE request helper
 */
export async function del<TResponse>(
  path: string,
  options?: Omit<ApiRequestOptions, 'method' | 'path' | 'body'>
): Promise<TResponse> {
  return apiRequest<TResponse>({ ...options, method: 'DELETE', path });
}
