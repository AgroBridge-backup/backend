import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN BASE DEL CLIENTE API
// ═══════════════════════════════════════════════════════════════

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  timeout: 15000, // 15s (aumentado por Rate Limiting + Redis latency)
  withCredentials: true, // Para enviar cookies si las usa
  headers: {
    'Content-Type': 'application/json',
  },
});

// ═══════════════════════════════════════════════════════════════
// INTERCEPTOR DE REQUEST (Inyección de Token)
// ═══════════════════════════════════════════════════════════════

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Inyectar token si existe
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log de request (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ═══════════════════════════════════════════════════════════════
// INTERCEPTOR DE RESPONSE (Manejo de Errores + Trace ID)
// ═══════════════════════════════════════════════════════════════

api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Capturar Trace ID en respuestas exitosas (para logging)
    const traceId = response.headers['x-trace-id'];
    if (traceId && process.env.NODE_ENV === 'development') {
      console.log(`[API] ✅ Response | Trace ID: ${traceId}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ─────────────────────────────────────────────────────────
    // 1. CAPTURA DE TRACE ID (Para Soporte Técnico)
    // ─────────────────────────────────────────────────────────
    const traceId = error.response?.headers['x-trace-id'];
    if (traceId) {
      console.error(`[API] ❌ Error | Trace ID: ${traceId}`);
      // Inyectar en el error para mostrarlo en UI
      (error as any).traceId = traceId;
    }

    // ─────────────────────────────────────────────────────────
    // 2. RATE LIMITING (429 Too Many Requests)
    // ─────────────────────────────────────────────────────────
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

      console.warn(`[RATE LIMIT] Too many requests. Waiting ${waitTime}ms...`);

      // Mostrar notificación al usuario (implementar según tu UI library)
      if (typeof window !== 'undefined') {
        // TODO: Reemplazar con tu sistema de notificaciones
        alert(`Demasiadas peticiones. Por favor espera ${waitTime / 1000} segundos.`);
      }

      // Reintentar automáticamente después del tiempo de espera
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return api(originalRequest);
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. TOKEN INVÁLIDO O REVOCADO (401 Unauthorized)
    // ─────────────────────────────────────────────────────────
    if (error.response?.status === 401) {
      // Evitar loop si ya estamos en login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.warn('[AUTH] Token inválido o revocado. Redirigiendo a login...');

        // Limpiar tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        // Redirigir a login
        window.location.href = '/login';
      }
    }

    // ─────────────────────────────────────────────────────────
    // 4. ERRORES DE RED (Sin respuesta del servidor)
    // ─────────────────────────────────────────────────────────
    if (!error.response) {
      console.error('[NETWORK] Backend no responde o CORS bloqueado', {
        message: error.message,
        code: error.code,
      });

      // Agregar información adicional al error
      (error as any).userMessage = 
        'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    }

    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════
// EXPORT DEFAULT
// ═══════════════════════════════════════════════════════════════

export default api;

// ═══════════════════════════════════════════════════════════════
// HELPER: Extraer mensaje de error user-friendly
// ═══════════════════════════════════════════════════════════════

export const getErrorMessage = (error: any): string => {
  if (error.userMessage) return error.userMessage;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'Ocurrió un error inesperado';
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Extraer Trace ID para mostrar en UI de error
// ═══════════════════════════════════════════════════════════════

export const getTraceId = (error: any): string | null => {
  return error.traceId || error.response?.headers['x-trace-id'] || null;
};
