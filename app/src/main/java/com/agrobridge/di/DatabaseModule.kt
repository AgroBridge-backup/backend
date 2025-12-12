package com.agrobridge.di

import android.content.Context
import androidx.room.Room
import com.agrobridge.data.local.AgroBridgeDatabase
import com.agrobridge.data.local.dao.LoteDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo de Inyección de Dependencias para la capa de Persistencia
 * Proporciona la instancia de base de datos y DAOs
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private const val DATABASE_NAME = "agrobridge.db"

    /**
     * Provee la instancia Singleton de la base de datos
     * Se crea una sola vez durante toda la vida de la aplicación
     */
    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): AgroBridgeDatabase {
        return Room.databaseBuilder(
            context,
            AgroBridgeDatabase::class.java,
            DATABASE_NAME
        )
            // ⚠️ NOTA: allowMainThreadQueries() está deshabilitado por defecto
            // Esto força el uso de coroutines/suspendFunctions (mejor para UX)
            // Si necesitas debugging, descomentar temporalmente:
            // .allowMainThreadQueries()
            .build()
    }

    /**
     * Provee el DAO de Lotes
     * Se inyecta automáticamente donde se necesite acceder a lotes en DB
     */
    @Provides
    @Singleton
    fun provideLoteDao(database: AgroBridgeDatabase): LoteDao {
        return database.loteDao()
    }
}
