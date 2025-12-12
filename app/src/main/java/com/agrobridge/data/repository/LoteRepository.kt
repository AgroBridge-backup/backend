package com.agrobridge.data.repository

import com.agrobridge.data.model.Lote
import kotlinx.coroutines.flow.Flow

/**
 * Interfaz de repositorio para operaciones de Lotes (Offline-First)
 * Define el contrato que debe cumplir cualquier implementación
 *
 * ARQUITECTURA: Single Source of Truth (SSOT)
 * - La BD local (Room) es la única fuente de verdad
 * - Los métodos de lectura (Flow) siempre devuelven datos de la BD
 * - Los métodos de escritura/sincronización actualizan la BD
 * - La UI observa los Flows y se actualiza automáticamente
 */
interface LoteRepository {

    /**
     * OBSERVABLE: Obtener todos los lotes
     * Emite datos desde la BD local. Se actualiza automáticamente cuando la BD cambia.
     *
     * OFFLINE-FIRST:
     * - Retorna datos inmediatamente (del cache local)
     * - Si no hay internet, sigue mostrando datos viejos
     * - Cuando hay conexión, `refreshLotes()` actualiza automáticamente
     */
    fun getLotes(
        productorId: String,
        page: Int = 1,
        pageSize: Int = 20
    ): Flow<List<Lote>>

    /**
     * Obtener un lote específico por ID
     * Emite null si no existe en la BD local
     */
    fun getLoteById(loteId: String): Flow<Lote?>

    /**
     * Obtener solo lotes activos
     * Filtro realizado en la BD local
     */
    fun getActiveLotes(productorId: String): Flow<List<Lote>>

    /**
     * SINCRONIZACIÓN: Descargar lotes desde la API y guardar en BD
     * Operación asíncrona que NO bloquea la UI
     *
     * FLUJO:
     * 1. Obtiene datos de la API
     * 2. Guarda en BD local (transacción atómica)
     * 3. Los Flows de lectura se actualizan automáticamente
     *
     * @param productorId ID del productor a sincronizar
     * @return Result<Unit> - Success si sincronización OK, Failure si error
     */
    suspend fun refreshLotes(productorId: String): Result<Unit>

    /**
     * Guardar un lote individual
     * Persiste cambios locales inmediatamente
     *
     * @param lote Lote a guardar
     * @return Result<Unit>
     */
    suspend fun saveLote(lote: Lote): Result<Unit>

    /**
     * Limpiar toda la base de datos local
     * Útil para logout o reset de datos
     */
    suspend fun clearDatabase(): Result<Unit>

    /**
     * Obtener timestamp de última sincronización
     * Útil para mostrar "Última actualización: hace 5 min"
     */
    suspend fun getLastSyncTimestamp(): Long?

    /**
     * CREAR LOTE (Offline-First Write)
     * Guarda el lote localmente con estado PENDING_CREATE
     *
     * FLUJO:
     * 1. Si hay conexión: Sincroniza con API inmediatamente
     * 2. Si NO hay conexión: Marca como PENDING_CREATE
     * 3. WorkManager sincroniza cuando vuelve la conexión
     *
     * @param lote Lote a crear
     * @return Result<Unit> - Success si guardó, Failure si error
     */
    suspend fun createLote(lote: Lote): Result<Unit>

    /**
     * ACTUALIZAR LOTE (Offline-First Write)
     * Guarda cambios localmente con estado PENDING_UPDATE
     *
     * FLUJO:
     * 1. Si hay conexión: Sincroniza con API inmediatamente
     * 2. Si NO hay conexión: Marca como PENDING_UPDATE
     * 3. WorkManager sincroniza cuando vuelve la conexión
     *
     * @param loteId ID del lote a actualizar
     * @param lote Lote con cambios
     * @return Result<Unit> - Success si guardó, Failure si error
     */
    suspend fun updateLote(loteId: String, lote: Lote): Result<Unit>

    /**
     * OBTENER LOTES PENDIENTES DE SINCRONIZAR
     * Retorna todos los lotes con estado PENDING_CREATE o PENDING_UPDATE
     *
     * OBSERVABLE:
     * - Emite cambios automáticamente cuando hay nuevos lotes pendientes
     * - Se actualiza cuando WorkManager sincroniza exitosamente
     *
     * @return Flow<List<Lote>> - Lista de lotes sin sincronizar
     */
    fun getPendingLotes(): Flow<List<Lote>>

    /**
     * CONTAR LOTES PENDIENTES
     * Retorna cantidad de lotes que faltan sincronizar
     *
     * OBSERVABLE:
     * - Se actualiza automáticamente
     * - Útil para mostrar badge "3 cambios pendientes" en UI
     *
     * @return Flow<Int> - Cantidad de lotes pendientes
     */
    fun getPendingLotesCount(): Flow<Int>
}
