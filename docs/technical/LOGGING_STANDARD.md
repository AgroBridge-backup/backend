# Estándar de Logging Contextual y Observabilidad Enterprise

**Versión:** 1.0.0
**Fecha:** 2025-11-25
**Estado:** Activo

## 1. Introducción

Este documento define el estándar de logging para el backend de AgroBridge (AgroBridge API). El objetivo es garantizar una observabilidad completa, facilitando la depuración distribuida y la integración con sistemas de monitoreo empresarial (Datadog, CloudWatch, Elastic).

## 2. Principios Fundamentales

1.  **Cero `console.log`:** Todo log debe pasar por el logger central (`src/shared/utils/logger.ts`).
2.  **Contexto Enriquecido:** Todo log debe incluir automáticamente metadatos críticos (Trace ID, User ID, Timestamp).
3.  **Estructura JSON:** En producción, los logs deben ser objetos JSON estructurados para su fácil ingestión.
4.  **Niveles Semánticos:** Uso estricto de niveles (`error`, `warn`, `info`, `debug`).

## 3. Estructura del Log

Todo log generado por la aplicación sigue este esquema estándar:

```json
{
  "timestamp": "2025-11-25T19:32:00Z",
  "level": "info",
  "message": "Producer listed successfully",
  "traceId": "cde1d8ac-cdaa-41bf-9137-f657ebbed069",
  "userId": "user-uuid-123",
  "producerId": "prod-uuid-456",
  "route": "/api/v1/producers",
  "meta": {
    "params": { "filter": "whitelisted" },
    "responseTimeMs": 56
  }
}
```

### Campos Obligatorios y Automáticos

| Campo | Descripción | Fuente |
| :--- | :--- | :--- |
| `timestamp` | Momento exacto del evento (ISO UTC). | Automático (Logger) |
| `level` | Severidad (`info`, `error`, etc.). | Desarrollador |
| `message` | Descripción textual breve del evento. | Desarrollador |
| `traceId` | UUID único por request. Permite trazar una petición a través de microservicios. | `req.context.traceId` |

### Campos Contextuales (Si aplican)

| Campo | Descripción | Fuente |
| :--- | :--- | :--- |
| `userId` | ID del usuario autenticado. | `req.user.id` |
| `producerId` | ID del productor asociado (si aplica). | `req.user.producerId` |
| `route` | Endpoint invocado. | `req.path` |
| `meta` | Objeto con detalles técnicos adicionales (stack trace, params, ids de entidades afectadas). | Desarrollador |

## 4. Implementación en Código

### 4.1. Middleware de Contexto
El sistema inyecta automáticamente un `traceId` y `startTime` en cada petición mediante `contextMiddleware`.

### 4.2. Uso del Logger en Controladores/Casos de Uso

**Correcto (Con Contexto):**

```typescript
import logger from '../../shared/utils/logger';

// En un controlador o ruta
logger.info({
  traceId: req.context?.traceId, // Propagación manual del traceId (temporal hasta automatización completa)
  userId: req.user?.userId,
  route: req.path,
  message: 'Batch created successfully',
  meta: {
    batchId: result.id,
    responseTimeMs: Date.now() - req.context?.startTime
  }
});
```

**Para Errores:**

```typescript
logger.error({
  traceId: req.context?.traceId,
  message: 'Failed to process payment',
  meta: {
    error: error.message,
    stack: error.stack,
    amount: 5000
  }
});
```

## 5. Integración con Datadog (Enterprise Monitoring)

El logger está configurado para enviar logs automáticamente a Datadog si la variable de entorno `DATADOG_API_KEY` está presente.

### Configuración .env

```bash
DATADOG_API_KEY=su_api_key_aqui
# NODE_ENV debe ser 'production' o 'staging' para activar formato JSON
NODE_ENV=production
```

## 6. Checklist de Desarrollo

Antes de enviar un PR, verifica:
- [ ] No hay `console.log` residuales.
- [ ] Los logs de error incluyen el stack trace en `meta`.
- [ ] Los logs transaccionales importantes incluyen `traceId`.
