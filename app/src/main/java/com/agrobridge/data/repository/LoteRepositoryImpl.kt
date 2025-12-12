package com.agrobridge.data.repository

import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.agrobridge.data.dto.PaginatedResponse
import com.agrobridge.data.local.dao.LoteDao
import com.agrobridge.data.local.entity.SyncStatus
import com.agrobridge.data.mapper.LoteEntityMapper.toEntity
import com.agrobridge.data.mapper.LoteEntityToDomainMapper.toDomain
import com.agrobridge.data.model.Lote
import com.agrobridge.data.remote.ApiService
import com.agrobridge.data.worker.SyncLotesWorker
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import timber.log.Timber
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementación del repositorio de Lotes con arquitectura OFFLINE-FIRST
 *
 * Flujo de datos:
 * 1. API (Retrofit) obtiene datos remotos
 * 2. Los datos se persisten en Room (SQLite local)
 * 3. La UI observa los datos de Room (siempre tiene algo que mostrar)
 * 4. Si no hay internet, la UI muestra datos cacheados localmente
 *
 * Patrón: Single Source of Truth (SSOT) - La DB local es la verdad
 *
 * Upload Sync (Offline-First Write):
 * 1. Usuario crea/edita lote localmente → PENDING_CREATE/PENDING_UPDATE
 * 2. Se guarda en Room → UI se actualiza inmediatamente
 * 3. WorkManager detecta cambios y encola SyncLotesWorker
 * 4. Worker sube en background, reintenta si falla
 */
@Singleton
class LoteRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val loteDao: LoteDao,
    private val workManager: WorkManager
) : LoteRepository {

    /**
     * OBSERVABLE: Obtener lotes de un productor específico desde la base de datos
     * Este es el flujo que la UI observa. Emite datos automáticamente
     * cada vez que la DB cambia
     *
     * VENTAJA OFFLINE-FIRST:
     * - Si la app se abre sin internet, la UI muestra lotes cacheados
     * - Cuando hay conexión, se actualiza automáticamente
     *
     * FIXED: HIGH-11
     * - Antes: ignoraba productorId, retornaba TODOS los lotes
     * - Ahora: filtra por productorId específico
     */
    override fun getLotes(
        productorId: String,
        page: Int,
        pageSize: Int
    ): Flow<List<Lote>> {
        // FIXED: HIGH-11 - Use productorId parameter instead of ignoring it
        return loteDao.getLotesByProducer(productorId).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    /**
     * Obtener un lote específico
     */
    override fun getLoteById(loteId: String): Flow<Lote?> {
        return loteDao.getLoteById(loteId).map { entity ->
            entity?.toDomain()
        }
    }

    /**
     * Obtener lotes activos
     */
    override fun getActiveLotes(productorId: String): Flow<List<Lote>> {
        return loteDao.getActiveLotes().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    /**
     * SINCRONIZACIÓN: Descargar lotes desde la API y guardar en DB
     * Se ejecuta en background sin bloquear la UI
     *
     * FLUJO:
     * 1. Intenta obtener datos de la API
     * 2. Si éxito, guarda en la DB (transacción atómica)
     * 3. El Flow de getLotes() se actualiza automáticamente
     * 4. La UI se refresca sin intervención manual
     */
    override suspend fun refreshLotes(productorId: String): Result<Unit> {
        return runCatching {
            Timber.d("🔄 Iniciando sincronización de lotes para productor: $productorId")

            try {
                // 1. Obtener datos de la API
                val response = apiService.getLotes(productorId)

                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.data.isNotEmpty()) {
                        // 2. Convertir DTOs a Entities
                        val entities = body.data.map { it.toEntity() }

                        // 3. Guardar en DB (transacción atómica: borrar e insertar)
                        loteDao.refreshLotes(entities)

                        Timber.d("✅ Sincronización exitosa: ${entities.size} lotes guardados")
                    } else {
                        Timber.w("⚠️ API retornó respuesta vacía")
                        // Los datos viejos en la DB se mantienen, la UX sigue funcionando
                    }
                } else {
                    Timber.e("❌ Error HTTP ${response.code()}: ${response.message()}")
                    throw Exception("Error HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                Timber.e(e, "❌ Error sincronizando lotes")
                throw e
            }
        }
    }

    /**
     * Crear un nuevo lote (Offline-First Write)
     *
     * FLUJO:
     * 1. Convertir Lote (Domain) -> LoteEntity (Persistence)
     * 2. Marcar con syncStatus = PENDING_CREATE
     * 3. Guardar localmente en Room (INMEDIATO)
     * 4. Encolar SyncLotesWorker para subir en background
     * 5. UI se actualiza automáticamente vía Flow desde Room
     *
     * Ventajas:
     * - Feedback inmediato al usuario (sin esperar red)
     * - Si no hay internet, se guarda y sube luego automáticamente
     * - Sin bloqueo de UI
     */
    suspend fun createLote(lote: Lote): Result<Unit> {
        return runCatching {
            Timber.d("➕ Creando lote: ${lote.nombre}")

            // 1. Convertir Lote (Domain) a LoteEntity (Entity)
            // y marcar como PENDING_CREATE
            // FIXED: HIGH-13 - Use newly implemented mapper for domain to entity conversion
            val loteEntity = lote.toEntity().copy(
                syncStatus = SyncStatus.PENDING_CREATE,
                fechaActualizacion = System.currentTimeMillis()
            )

            // 2. Guardar localmente (INMEDIATO - no espera red)
            loteDao.saveLocal(loteEntity)
            Timber.d("✅ Lote guardado localmente: ${lote.nombre}")

            // 3. Encolar trabajo de sincronización
            enqueueSyncWork()
        }
    }

    /**
     * Editar un lote existente (Offline-First Write)
     *
     * Mismo flujo que createLote pero con PENDING_UPDATE
     */
    suspend fun updateLote(loteId: String, lote: Lote): Result<Unit> {
        return runCatching {
            Timber.d("✏️ Actualizando lote: ${lote.nombre}")

            // 1. Convertir a Entity con estado PENDING_UPDATE
            // FIXED: HIGH-13 - Use mapper for domain to entity conversion
            val loteEntity = lote.toEntity().copy(
                id = loteId,
                syncStatus = SyncStatus.PENDING_UPDATE,
                fechaActualizacion = System.currentTimeMillis()
            )

            // 2. Guardar localmente
            loteDao.saveLocal(loteEntity)
            Timber.d("✅ Lote actualizado localmente: ${lote.nombre}")

            // 3. Encolar sincronización
            enqueueSyncWork()
        }
    }

    /**
     * Guardar un lote individual en la DB (alias para compatibilidad)
     * Ahora implementado correctamente con Upload Sync
     */
    override suspend fun saveLote(lote: Lote): Result<Unit> {
        // Asumimos que es una creación si es nuevo, sino sería update
        return createLote(lote)
    }

    /**
     * Encolar trabajo de sincronización
     * WorkManager ejecutará SyncLotesWorker cuando:
     * - Haya conexión a internet
     * - Batería disponible
     * - Condiciones del sistema lo permitan
     */
    private fun enqueueSyncWork() {
        Timber.d("📋 Encolando trabajo de sincronización...")

        try {
            // Crear restricciones para el trabajo
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED) // Solo con conexión
                .build()

            // Crear la solicitud de trabajo
            val syncRequest = OneTimeWorkRequestBuilder<SyncLotesWorker>()
                .setConstraints(constraints)
                // Politica de reintento: exponencial (5s, 10s, 20s, ...)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            // Encolar con política KEEP
            // (KEEP = no encolar si ya hay un trabajo en progreso)
            workManager.enqueueUniqueWork(
                "sync_lotes_work",
                ExistingWorkPolicy.KEEP, // O APPEND_OR_REPLACE para acumular
                syncRequest
            )

            Timber.d("✅ Trabajo encolado exitosamente")

        } catch (e: Exception) {
            Timber.e(e, "❌ Error encolando trabajo de sincronización")
        }
    }

    /**
     * Limpiar la base de datos local
     * Útil después de logout o para testing
     */
    override suspend fun clearDatabase(): Result<Unit> {
        return runCatching {
            Timber.d("🗑️ Limpiando base de datos local")
            loteDao.clearAll()
            Timber.d("✅ Base de datos limpiada")
        }
    }

    /**
     * Obtener información de sincronización
     * Útil para mostrar timestamp de última actualización en la UI
     */
    override suspend fun getLastSyncTimestamp(): Long? {
        return try {
            loteDao.getLastSyncTimestamp()
        } catch (e: Exception) {
            Timber.e(e, "Error obteniendo timestamp de sincronización")
            null
        }
    }

    /**
     * Obtener el count de lotes pendientes como Flow
     * Útil para mostrar badges en UI: "3 cambios sin sincronizar"
     *
     * @return Flow<Int> que emite el número de lotes pendientes
     */
    fun getPendingLotesCount(): Flow<Int> {
        return loteDao.getPendingLotesCount()
    }

    /**
     * Obtener lotes pendientes como Flow (para observar en tiempo real)
     * Útil para mostrar lista de cambios sin sincronizar
     *
     * @return Flow<List<Lote>> con los lotes que están PENDING_CREATE o PENDING_UPDATE
     */
    fun getPendingLotes(): Flow<List<Lote>> {
        return loteDao.getPendingLotesFlow().map { entities ->
            entities.map { it.toDomain() }
        }
    }
}
