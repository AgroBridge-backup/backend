package com.agrobridge.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.agrobridge.data.local.converter.CoordenadaListConverter
import com.agrobridge.data.local.dao.LoteDao
import com.agrobridge.data.local.entity.LoteEntity

/**
 * Base de datos local de AgroBridge usando Room
 * Almacena los datos de lotes de forma persistente en el dispositivo
 *
 * Arquitectura:
 * - Entities: Representan las tablas de la DB (LoteEntity)
 * - DAOs: Interfaz para acceder a los datos (LoteDao)
 * - Database: Contenedor principal que proporciona acceso a los DAOs
 *
 * FIXED: MEDIUM-3 - Enable schema export for migration support
 * Exporta el schema a 'schemas/' directory para versionado y migraciones
 * Si cambias el schema, incrementa la version e implementa una Migration
 *
 * Schema location: app/schemas/com.agrobridge.data.local.AgroBridgeDatabase/
 */
@Database(
    entities = [LoteEntity::class],
    version = 1,
    exportSchema = true // Exporta schemas para versionado y migraciones futuras
)
@TypeConverters(CoordenadaListConverter::class)
abstract class AgroBridgeDatabase : RoomDatabase() {

    /**
     * Acceso al DAO de Lotes
     * El compilador de Room genera la implementación automáticamente (KSP)
     */
    abstract fun loteDao(): LoteDao

    companion object {
        private const val DATABASE_NAME = "agrobridge.db"

        @Volatile
        private var instance: AgroBridgeDatabase? = null

        /**
         * Obtener o crear la instancia de la base de datos (Singleton)
         * Usa synchronized para thread-safety
         */
        fun getDatabase(context: Context): AgroBridgeDatabase {
            return instance ?: synchronized(this) {
                val newInstance = Room.databaseBuilder(
                    context.applicationContext,
                    AgroBridgeDatabase::class.java,
                    DATABASE_NAME
                )
                    // Habilitar acceso desde el thread principal (solo para testing)
                    // En producción, Room fuerza que uses coroutines (recomendado)
                    .allowMainThreadQueries() // ⚠️ Usa solo si es necesario
                    .build()

                instance = newInstance
                newInstance
            }
        }
    }
}
