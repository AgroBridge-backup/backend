# Manual de Operaciones y Observabilidad (Staging/Prod)

**Versión:** 1.0.0
**Fecha:** 2025-11-25
**Target:** DevOps, Backend Team, SREs

## 1. Introducción

Este documento guía al equipo técnico en el uso de las herramientas de observabilidad implementadas para AgroBridge. El objetivo es reducir el MTTR (Mean Time To Repair) y detectar anomalías proactivamente.

## 2. Acceso a Dashboards

Los dashboards están centralizados en Datadog (o CloudWatch si aplica).

*   **URL Staging Dashboard:** `https://app.datadoghq.com/dashboard/staging-agrobridge-overview` (Simulado)
*   **URL Alerts:** `https://app.datadoghq.com/monitors/manage?q=service:agrobridge`

### Paneles Clave
1.  **Global Error Rate:** Semáforo de salud. Si está rojo (> 10 errores/hora), detener despliegues.
2.  **Latency by Endpoint:** Identifica cuellos de botella en rutas específicas.
3.  **Recent Errors:** Stream en tiempo real de logs nivel `error`. Muestra `traceId` y stack traces.

## 3. Cómo Trazar una Petición (Troubleshooting)

**Caso de Uso:** Un usuario reporta "Falló mi carga de lote".

1.  **Obtener User ID:** Pedir email al usuario o buscar en base de datos.
2.  **Filtrar en Logs Explorer:**
    *   Query: `@userId:user-uuid-123 status:error`
3.  **Identificar el Trace ID:**
    *   En el log del error, copiar el campo `traceId` (ej: `16d80354-f7c5-43ed-9ab1-5e8f6e0b012b`).
4.  **Ver el Flujo Completo:**
    *   Query: `@traceId:16d80354-f7c5-43ed-9ab1-5e8f6e0b012b`
    *   Esto mostrará **todos** los logs asociados a esa petición específica (Info -> Debug -> Warn -> Error), permitiendo ver exactamente qué paso falló.

## 4. Alertas Configuradas

| Alerta | Umbral | Acción Requerida |
| :--- | :--- | :--- |
| **High Error Rate** | > 10 errores/min | Rollback inmediato si es tras deploy. Revisar logs críticos. |
| **High Latency** | > 1000ms avg | Investigar endpoint lento. Revisar índices de BD o llamadas externas. |

## 5. KPIs y Queries Avanzadas

Copia y pega estas queries en el "Logs Explorer" para análisis ad-hoc.

### Latencia Promedio por Ruta (Últimas 24h)
```sql
avg(@duration) by @route
```

### Tasa de Errores por Usuario
```sql
count_not_null(@userId) where status:error group by @userId
```

### Top Productores Activos
```sql
top(count) by @producerId
```

## 6. Onboarding para Desarrolladores

1.  **Nunca usar `console.log`**: Usar `logger.info`, `logger.warn`, etc.
2.  **Propagar Contexto**: Si creas un worker o script fuera de Express, genera tu propio `traceId`:
    ```typescript
    import { v4 as uuidv4 } from 'uuid';
    const traceId = uuidv4();
    logger.info({ traceId, message: 'Starting background job' });
    ```
3.  **Validar antes de Merge**: Ejecutar `npm run ops:verify` (script simulado) para asegurar que los logs salen en JSON válido.
