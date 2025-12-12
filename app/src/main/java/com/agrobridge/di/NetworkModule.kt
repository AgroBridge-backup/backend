package com.agrobridge.di

import com.agrobridge.BuildConfig
import com.agrobridge.data.remote.ApiService
import com.agrobridge.data.remote.AuthApiService
import com.agrobridge.data.security.AuthInterceptor
import com.agrobridge.data.security.CertificatePinnerFactory
import com.agrobridge.data.security.TokenRefreshInterceptor
import com.agrobridge.data.security.logConfiguration
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import timber.log.Timber
import javax.inject.Singleton

/**
 * Módulo de Inyección de Dependencias para Networking
 * Proporciona instancias de Retrofit, OkHttpClient y ApiService
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = "https://api.agrobridge.com/v1/"

    /**
     * Proporciona una instancia de OkHttpClient configurada
     * Incluye:
     * - AuthInterceptor: Agrega JWT token a requests
     * - TokenRefreshInterceptor: Renueva token en 401
     * - HttpLoggingInterceptor: Logging en DEBUG
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenRefreshInterceptor: TokenRefreshInterceptor
    ): OkHttpClient {
        // Crear CertificatePinner para validación de certificados
        val certificatePinner = CertificatePinnerFactory.create()
        certificatePinner.logConfiguration()

        return OkHttpClient.Builder().apply {
            // ===================================================================
            // SEGURIDAD: Certificate Pinning (prevención de MITM)
            // ===================================================================
            certificatePinner(certificatePinner)

            // ===================================================================
            // SEGURIDAD: Interceptores de autenticación
            // ===================================================================
            // Orden importante:
            // 1. AuthInterceptor agrega token a request
            // 2. TokenRefreshInterceptor maneja 401 y renueva token
            addInterceptor(authInterceptor)
            addNetworkInterceptor(tokenRefreshInterceptor)

            // ===================================================================
            // DEBUG: Logging solo en desarrollo
            // ===================================================================
            if (BuildConfig.DEBUG) {
                val loggingInterceptor = HttpLoggingInterceptor { message ->
                    Timber.tag("OkHttp").d(message)
                }.apply {
                    level = HttpLoggingInterceptor.Level.BODY
                }
                addInterceptor(loggingInterceptor)
            }

            // ===================================================================
            // NETWORKING: Configurar timeouts
            // ===================================================================
            connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        }.build()
    }

    /**
     * Proporciona una instancia de Retrofit configurada
     */
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    /**
     * Proporciona la instancia de ApiService (endpoints de lotes, clima, etc.)
     */
    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }

    /**
     * Proporciona la instancia de AuthApiService (endpoints de autenticación)
     */
    @Provides
    @Singleton
    fun provideAuthApiService(retrofit: Retrofit): AuthApiService {
        return retrofit.create(AuthApiService::class.java)
    }
}
