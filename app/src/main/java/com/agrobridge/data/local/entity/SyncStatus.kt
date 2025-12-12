package com.agrobridge.data.local.entity

/**
 * Enum que representa el estado de sincronización de un Lote
 *
 * Estados:
 * - SYNCED: Datos sincronizados con el servidor (descarga o subida exitosa)
 * - PENDING_CREATE: Lote creado localmente, esperando subida
 * - PENDING_UPDATE: Lote modificado localmente, esperando sincronización
 *
 * Flujo de Sincronización:
 * 1. Usuario crea/edita lote → PENDING_CREATE o PENDING_UPDATE
 * 2. Se guarda localmente en Room → UI se actualiza inmediatamente
 * 3. WorkManager detecta estados PENDING → Encola SyncLotesWorker
 * 4. Worker intenta subir a API → Si éxito, cambia a SYNCED
 * 5. Si falla, se reintentan automáticamente con backoff exponencial
 */
enum class SyncStatus {
    /** Datos están sincronizados con el servidor */
    SYNCED,

    /** Lote fue creado localmente, esperando primer upload */
    PENDING_CREATE,

    /** Lote fue modificado localmente, esperando update */
    PENDING_UPDATE
}
