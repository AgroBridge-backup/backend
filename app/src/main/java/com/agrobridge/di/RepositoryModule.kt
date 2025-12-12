package com.agrobridge.di

import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.data.repository.LoteRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Módulo de Inyección de Dependencias para Repositorios
 * Bindea las interfaces a sus implementaciones
 * Asegura que exista una única instancia (Singleton)
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    /**
     * Bindear LoteRepository a su implementación
     * Proporciona una instancia Singleton de LoteRepositoryImpl
     * cuando se solicite LoteRepository
     */
    @Binds
    @Singleton
    abstract fun bindLoteRepository(
        impl: LoteRepositoryImpl
    ): LoteRepository
}
