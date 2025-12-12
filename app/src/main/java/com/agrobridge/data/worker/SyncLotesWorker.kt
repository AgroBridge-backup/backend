package com.agrobridge.data.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.agrobridge.data.dto.CreateLoteRequest
import com.agrobridge.data.local.dao.LoteDao
import com.agrobridge.data.local.entity.SyncStatus
import com.agrobridge.data.mapper.LoteEntityMapper.toDto
import com.agrobridge.data.remote.ApiService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber

/**
 * Worker para sincronización de Lotes (Upload)
 *
 * Responsabilidades:
 * 1. Ejecutar en background sin bloquear la UI
 * 2. Obtener lotes pendientes de la BD local
 * 3. Subir cada lote a la API
 * 4. Marcar como SYNCED si éxito
 * 5. Reintentar automáticamente si falla (WorkManager maneja reintento y backoff)
 *
 * Ciclo de Vida:
 * - WorkManager ejecuta este worker cuando se encola
 * - Se reintentan automáticamente si retorna Result.retry()
 * - Se detiene si retorna Result.success() o Result.failure()
 * - Respeta restricciones (red disponible, batería, etc.)
 */
@HiltWorker
class SyncLotesWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val loteDao: LoteDao,
    private val apiService: ApiService
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Timber.d("🔄 SyncLotesWorker iniciando sincronización de lotes...")

            // PASO 1: Obtener todos los lotes pendientes
            val pendingLotes = loteDao.getPendingLotes()

            if (pendingLotes.isEmpty()) {
                Timber.d("✅ No hay lotes pendientes de sincronización")
                return@withContext Result.success()
            }

            Timber.d("📦 Encontrados ${pendingLotes.size} lotes pendientes para sincronizar")

            var syncedCount = 0
            var failureCount = 0

            // PASO 2: Sincronizar cada lote pendiente
            pendingLotes.forEach { loteEntity ->
                try {
                    Timber.d("📤 Subiendo lote: ${loteEntity.nombre} (ID: ${loteEntity.id})")

                    // Convertir Entity -> Dto para subir a la API
                    val loteDto = loteEntity.toDto()

                    // Convertir LoteDto -> CreateLoteRequest para el endpoint
                    val createRequest = CreateLoteRequest(
                        nombre = loteDto.nombre,
                        cultivo = loteDto.cultivo,
                        area = loteDto.area,
                        productorId = loteDto.productorId,
                        coordenadas = loteDto.coordenadas,
                        ubicacion = loteDto.ubicacion,
                        bloqueId = loteDto.bloqueId
                    )

                    // Determinar si es create o update basado en syncStatus
                    val response = when (loteEntity.syncStatus) {
                        SyncStatus.PENDING_CREATE -> {
                            Timber.d("  → Tipo: CREATE (nuevo lote)")
                            apiService.createLote(createRequest)
                        }
                        SyncStatus.PENDING_UPDATE -> {
                            Timber.d("  → Tipo: UPDATE (lote modificado)")
                            apiService.updateLote(loteEntity.id, createRequest)
                        }
                        SyncStatus.SYNCED -> {
                            Timber.w("  ⚠️ Lote marcado como SYNCED pero en lista pendiente?")
                            return@forEach
                        }
                    }

                    // PASO 3: Manejar respuesta de la API
                    if (response.isSuccessful) {
                        Timber.d("✅ Subida exitosa: ${loteEntity.nombre}")

                        // Marcar como SYNCED en la base de datos
                        loteDao.updateSyncStatus(loteEntity.id, SyncStatus.SYNCED)
                        syncedCount++

                    } else {
                        // Error del servidor (400, 500, etc.)
                        val errorMessage = response.errorBody()?.string() ?: response.message()
                        Timber.e("❌ Error HTTP ${response.code()} subiendo lote ${loteEntity.id}: $errorMessage")

                        failureCount++
                        // No actualizar estado: dejar como PENDING para reintentar luego
                    }

                } catch (e: Exception) {
                    Timber.e(e, "❌ Excepción al subir lote ${loteEntity.nombre}")
                    failureCount++
                    // Dejar como PENDING para reintentos automáticos
                }
            }

            // PASO 4: Determinar resultado final
            val resultMessage = "Sincronizados: $syncedCount, Fallidos: $failureCount"
            Timber.d("📊 Resultado de sincronización: $resultMessage")

            return@withContext if (failureCount > 0) {
                // Si alguno falló, reintentar más tarde
                // WorkManager automáticamente retentará con backoff exponencial
                Timber.w("⏱️ Algunos lotes fallaron, programando reintento...")
                Result.retry()
            } else {
                // Todos exitosos
                Timber.d("✅ Sincronización completada exitosamente")
                Result.success()
            }

        } catch (e: Exception) {
            Timber.e(e, "❌ Error fatal en SyncLotesWorker")
            // Reintentar en caso de excepción no controlada
            Result.retry()
        }
    }
}
