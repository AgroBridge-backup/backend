package com.agrobridge.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters
import com.agrobridge.data.local.converter.CoordenadaListConverter

/**
 * Entidad de Room para persistencia local de Lotes
 * Representa la tabla "lotes" en la base de datos SQLite
 *
 * Nota: Esta es una capa de persistencia separada de LoteDto (API) y Lote (Domain)
 * para mantener desacoplamiento entre las capas
 */
@Entity(tableName = "lotes")
@TypeConverters(CoordenadaListConverter::class)
data class LoteEntity(
    @PrimaryKey
    val id: String,

    val nombre: String,
    val cultivo: String,
    val area: Double,
    val estado: String, // Estado como String, se convierte a enum en mapper

    val productorId: String,
    val productorNombre: String,

    val fechaCreacion: Long,
    val fechaActualizacion: Long = System.currentTimeMillis(),

    // Coordenadas almacenadas como JSON (convertidas por TypeConverter)
    val coordenadas: String?, // JSON string de List<CoordenadaEntity>

    val centroCampoLatitud: Double?,
    val centroCampoLongitud: Double?,

    val ubicacion: String? = null,
    val bloqueId: String? = null,
    val bloqueNombre: String? = null,

    // Timestamp de sincronización local
    val localSyncTimestamp: Long = System.currentTimeMillis(),

    // Estado de sincronización con servidor (Offline-First Write)
    val syncStatus: SyncStatus = SyncStatus.SYNCED
)
