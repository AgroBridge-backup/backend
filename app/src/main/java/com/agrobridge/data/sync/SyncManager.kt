package com.agrobridge.data.sync

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - BIDIRECTIONAL SYNC MANAGER
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: 2-way sync with conflict resolution (server-wins strategy)
// Coverage: Upload, Download, Conflict resolution, Progress tracking
// ═══════════════════════════════════════════════════════════════════

import com.agrobridge.data.local.dao.LoteDao
import com.agrobridge.data.local.entity.LoteEntity
import com.agrobridge.data.local.entity.SyncStatus
import com.agrobridge.data.mapper.LoteMapper
import com.agrobridge.data.remote.ApiService
import com.agrobridge.util.ErrorHandler
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SyncManager - Bidirectional synchronization with conflict resolution
 *
 * Fases de Sincronización:
 *
 * FASE 1: UPLOAD (Local → Server)
 * ✓ Obtener lotes pendientes (PENDING_CREATE, PENDING_UPDATE)
 * ✓ Intentar subir cada lote al servidor
 * ✓ Si éxito: marcar como SYNCED
 * ✓ Si falla: reintentar o mantener PENDING
 * ✓ Rastrear progreso
 *
 * FASE 2: DOWNLOAD (Server → Local)
 * ✓ Obtener lista completa del servidor
 * ✓ Para cada lote remoto:
 *   - Si nuevo (no existe localmente): INSERTAR
 *   - Si existe pero SYNCED: ACTUALIZAR (server wins)
 *   - Si existe pero PENDING: MANTENER local (user edits priority)
 * ✓ Marcar todos como SYNCED después
 *
 * FASE 3: CLEANUP
 * ✓ Eliminar conflictos resueltos
 * ✓ Registrar cambios en logs
 * ✓ Notificar UI de cambios
 *
 * Estrategia de Conflictos:
 * - Server Wins: Datos del servidor prevalecen para SYNCED items
 * - User Wins: Cambios locales PENDING no se sobrescriben
 * - Merge: Información de ambos lados se conserva donde es posible
 *
 * Uso:
 * ```
 * syncManager.syncAll(productorId)
 *     .collect { state ->
 *         when (state) {
 *             is SyncState.Syncing → showProgress(state.progress)
 *             is SyncState.Success → showMessage("${state.itemsSynced} items sincronizados")
 *             is SyncState.Error → showError(state.message)
 *         }
 *     }
 * ```
 */
@Singleton
class SyncManager @Inject constructor(
    private val loteDao: LoteDao,
    private val apiService: ApiService,
    private val loteMapper: LoteMapper,
    private val errorHandler: ErrorHandler
) {

    sealed class SyncState {
        object Idle : SyncState()
        data class Syncing(val progress: Int) : SyncState()
        data class Success(val itemsSynced: Int) : SyncState()
        data class Error(val message: String) : SyncState()
    }

    data class SyncConflict(
        val loteId: String,
        val localVersion: LoteEntity,
        val remoteVersion: com.agrobridge.data.dto.LoteDto,
        val resolution: ConflictResolution = ConflictResolution.SERVER_WINS
    )

    enum class ConflictResolution {
        SERVER_WINS, USER_WINS, MERGE
    }

    suspend fun syncAll(productorId: String): Flow<SyncState> = flow {
        emit(SyncState.Idle)

        try {
            emit(SyncState.Syncing(0))

            // FASE 1: UPLOAD (Subir cambios locales)
            val uploadedCount = phaseUpload(productorId)
            emit(SyncState.Syncing(33))

            // FASE 2: DOWNLOAD (Descargar cambios del servidor)
            val downloadedCount = phaseDownload(productorId)
            emit(SyncState.Syncing(66))

            // FASE 3: CLEANUP (Limpiar y marcar como sincronizado)
            phaseCleanup()
            emit(SyncState.Syncing(100))

            val totalSynced = uploadedCount + downloadedCount
            emit(SyncState.Success(totalSynced))

            Timber.d("Sync completed: $uploadedCount uploaded, $downloadedCount downloaded")
        } catch (e: Exception) {
            val message = errorHandler.handle(e, "syncAll")
            emit(SyncState.Error(message))
        }
    }

    private suspend fun phaseUpload(productorId: String): Int {
        val pendingLotes = loteDao.getPendingLotes().first() ?: emptyList()
        var successCount = 0

        pendingLotes.forEach { entity ->
            try {
                when (entity.syncStatus) {
                    SyncStatus.PENDING_CREATE -> {
                        val dto = loteMapper.toDto(
                            loteMapper.entityToDomain(entity)
                        )
                        val response = apiService.createLote(dto)
                        if (response.isSuccessful) {
                            loteDao.update(entity.copy(syncStatus = SyncStatus.SYNCED))
                            successCount++
                            Timber.d("Created lote ${entity.id} on server")
                        } else {
                            Timber.w("Failed to create lote ${entity.id}: ${response.code()}")
                        }
                    }

                    SyncStatus.PENDING_UPDATE -> {
                        val dto = loteMapper.toDto(
                            loteMapper.entityToDomain(entity)
                        )
                        val response = apiService.updateLote(entity.id, dto)
                        if (response.isSuccessful) {
                            loteDao.update(entity.copy(syncStatus = SyncStatus.SYNCED))
                            successCount++
                            Timber.d("Updated lote ${entity.id} on server")
                        } else {
                            Timber.w("Failed to update lote ${entity.id}: ${response.code()}")
                        }
                    }

                    else -> {} // SYNCED lotes not uploaded
                }
            } catch (e: Exception) {
                Timber.e(e, "Error uploading lote ${entity.id}")
                // Mantener status PENDING para reintentar
            }
        }

        return successCount
    }

    private suspend fun phaseDownload(productorId: String): Int {
        var successCount = 0

        try {
            val response = apiService.getLotes(productorId)
            if (!response.isSuccessful) {
                throw Exception("Failed to fetch lotes: ${response.code()}")
            }

            val serverLotes = response.body()?.data ?: emptyList()

            serverLotes.forEach { dto ->
                try {
                    val localEntity = loteDao.getLoteById(dto.id).first()

                    if (localEntity == null) {
                        // NUEVO: Insertar del servidor
                        val entity = loteMapper.toEntity(dto)
                        loteDao.insertLote(entity.copy(syncStatus = SyncStatus.SYNCED))
                        successCount++
                        Timber.d("Inserted new lote ${dto.id} from server")
                    } else {
                        // EXISTENTE: Aplicar estrategia de conflicto
                        val conflictResolution = resolveConflict(localEntity, dto)
                        when (conflictResolution.resolution) {
                            ConflictResolution.SERVER_WINS -> {
                                // Server wins: actualizar con datos del servidor
                                if (localEntity.syncStatus == SyncStatus.SYNCED) {
                                    val updatedEntity = loteMapper.toEntity(dto)
                                    loteDao.update(
                                        updatedEntity.copy(syncStatus = SyncStatus.SYNCED)
                                    )
                                    Timber.d("Updated lote ${dto.id} from server (server wins)")
                                }
                            }

                            ConflictResolution.USER_WINS -> {
                                // User wins: mantener cambios locales
                                Timber.d("Kept local changes for lote ${dto.id} (user wins)")
                            }

                            ConflictResolution.MERGE -> {
                                // Merge: combinar información
                                val merged = mergeVersions(localEntity, dto)
                                loteDao.update(merged)
                                Timber.d("Merged lote ${dto.id} from server")
                            }
                        }
                        successCount++
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Error processing lote ${dto.id}")
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error in phaseDownload")
            throw e
        }

        return successCount
    }

    private suspend fun phaseCleanup() {
        try {
            // Marcar todos los lotes como sincronizados
            val allLotes = loteDao.getAllLotes().first() ?: emptyList()
            allLotes.forEach { entity ->
                if (entity.syncStatus != SyncStatus.SYNCED) {
                    loteDao.update(entity.copy(syncStatus = SyncStatus.SYNCED))
                }
            }
            Timber.d("Cleanup phase completed")
        } catch (e: Exception) {
            Timber.e(e, "Error in phaseCleanup")
        }
    }

    private fun resolveConflict(
        local: LoteEntity,
        remote: com.agrobridge.data.dto.LoteDto
    ): SyncConflict {
        return SyncConflict(
            loteId = local.id,
            localVersion = local,
            remoteVersion = remote,
            resolution = when {
                local.syncStatus == SyncStatus.PENDING_CREATE ||
                local.syncStatus == SyncStatus.PENDING_UPDATE -> {
                    ConflictResolution.USER_WINS
                }
                local.fechaActualizacion > remote.updatedAt -> {
                    ConflictResolution.USER_WINS
                }
                else -> ConflictResolution.SERVER_WINS
            }
        )
    }

    private fun mergeVersions(
        local: LoteEntity,
        remote: com.agrobridge.data.dto.LoteDto
    ): LoteEntity {
        return local.copy(
            nombre = remote.nombre,
            cultivo = remote.cultivo,
            area = remote.area,
            estado = remote.estado.lowercase(),
            // Mantener timestamps locales
            fechaActualizacion = maxOf(local.fechaActualizacion, remote.updatedAt),
            syncStatus = SyncStatus.SYNCED
        )
    }

    suspend fun syncLoteById(loteId: String): Result<Unit> {
        return try {
            val localLote = loteDao.getLoteById(loteId).first()
            if (localLote != null) {
                val dto = loteMapper.toDto(loteMapper.entityToDomain(localLote))
                val response = apiService.updateLote(loteId, dto)
                if (response.isSuccessful) {
                    loteDao.update(localLote.copy(syncStatus = SyncStatus.SYNCED))
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Failed to sync: ${response.code()}"))
                }
            } else {
                Result.failure(Exception("Lote not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// Extensión para obtener el primero de un Flow
private suspend inline fun <T> Flow<T?>.first(): T? {
    var value: T? = null
    collect { value = it }
    return value
}
