package com.agrobridge.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.agrobridge.data.local.entity.LoteEntity
import com.agrobridge.data.local.entity.SyncStatus
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object para la tabla "lotes"
 * Define todas las operaciones que se pueden realizar en la base de datos
 *
 * Nota: Los métodos que retornan Flow se observan automáticamente
 * y notifican cambios a la UI
 */
@Dao
interface LoteDao {

    /**
     * Obtener todos los lotes
     * Retorna un Flow que emite actualizaciones cada vez que la tabla cambia
     * (Esto es lo que hace "reactive" la arquitectura)
     */
    @Query("SELECT * FROM lotes ORDER BY fechaCreacion DESC")
    fun getAllLotes(): Flow<List<LoteEntity>>

    /**
     * Obtener un lote específico por ID
     */
    @Query("SELECT * FROM lotes WHERE id = :loteId")
    fun getLoteById(loteId: String): Flow<LoteEntity?>

    /**
     * Obtener lotes de un productor específico
     */
    @Query("SELECT * FROM lotes WHERE productorId = :productorId ORDER BY fechaCreacion DESC")
    fun getLotesByProducer(productorId: String): Flow<List<LoteEntity>>

    /**
     * Obtener lotes activos (filtro común)
     */
    @Query("SELECT * FROM lotes WHERE estado = 'ACTIVO' ORDER BY fechaCreacion DESC")
    fun getActiveLotes(): Flow<List<LoteEntity>>

    /**
     * Insertar un solo lote
     * Si ya existe (mismo ID), lo reemplaza (OnConflictStrategy.REPLACE)
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLote(lote: LoteEntity)

    /**
     * Insertar múltiples lotes
     * Útil después de una sincronización con la API
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(lotes: List<LoteEntity>)

    /**
     * Actualizar un lote existente
     */
    @Update
    suspend fun updateLote(lote: LoteEntity)

    /**
     * Eliminar un lote por ID
     */
    @Query("DELETE FROM lotes WHERE id = :loteId")
    suspend fun deleteLoteById(loteId: String)

    /**
     * Eliminar todos los lotes
     */
    @Query("DELETE FROM lotes")
    suspend fun clearAll()

    /**
     * Transacción atómica: borrar todos y insertar nuevos
     * Garantiza que la DB nunca quede en un estado intermedio
     * (Importante para UX: la UI no parpadea mostrando datos viejos a medias)
     */
    @Transaction
    suspend fun refreshLotes(lotes: List<LoteEntity>) {
        clearAll()
        insertAll(lotes)
    }

    /**
     * Contar el total de lotes
     * Útil para debugging y pruebas
     */
    @Query("SELECT COUNT(*) FROM lotes")
    suspend fun countLotes(): Int

    /**
     * Obtener último timestamp de sincronización
     */
    @Query("SELECT MAX(localSyncTimestamp) FROM lotes")
    suspend fun getLastSyncTimestamp(): Long?

    // ========================================================================
    // MÉTODOS PARA SINCRONIZACIÓN (Upload Sync - Offline-First Write)
    // ========================================================================

    /**
     * Obtener todos los lotes que están pendientes de sincronización
     * Usado por el WorkManager para identificar qué subir
     *
     * @return Lista de lotes con estado PENDING_CREATE o PENDING_UPDATE
     */
    @Query("SELECT * FROM lotes WHERE syncStatus IN ('PENDING_CREATE', 'PENDING_UPDATE') ORDER BY fechaActualizacion ASC")
    suspend fun getPendingLotes(): List<LoteEntity>

    /**
     * Obtener lotes pendientes como Flow (para observar cambios en tiempo real)
     * Útil para mostrar en UI cuántos items están pendientes
     */
    @Query("SELECT * FROM lotes WHERE syncStatus IN ('PENDING_CREATE', 'PENDING_UPDATE') ORDER BY fechaActualizacion ASC")
    fun getPendingLotesFlow(): Flow<List<LoteEntity>>

    /**
     * Actualizar el estado de sincronización de un lote
     * Llamado después de un upload exitoso o al crear/editar localmente
     *
     * @param loteId ID del lote a actualizar
     * @param status Nuevo estado (SYNCED, PENDING_CREATE, PENDING_UPDATE)
     */
    @Query("UPDATE lotes SET syncStatus = :status WHERE id = :loteId")
    suspend fun updateSyncStatus(loteId: String, status: SyncStatus)

    /**
     * Guardar o actualizar un lote localmente
     * Usado para crear nuevos lotes o editar existentes sin sincronizar inmediatamente
     * La UI se actualiza automáticamente vía getAllLotes() Flow
     *
     * @param lote Entidad con syncStatus = PENDING_CREATE o PENDING_UPDATE
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveLocal(lote: LoteEntity)

    /**
     * Obtener el count de lotes pendientes
     * Útil para badges en UI mostrando "3 cambios sin sincronizar"
     */
    @Query("SELECT COUNT(*) FROM lotes WHERE syncStatus IN ('PENDING_CREATE', 'PENDING_UPDATE')")
    fun getPendingLotesCount(): Flow<Int>
}
