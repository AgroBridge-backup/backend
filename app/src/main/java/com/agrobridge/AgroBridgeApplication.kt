package com.agrobridge

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.agrobridge.util.CrashReportingTree
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber
import javax.inject.Inject

/**
 * Application class de AgroBridge
 * Inicializa configuraciones globales de la aplicación
 * Anotado con @HiltAndroidApp para inyección de dependencias
 *
 * Responsabilidades:
 * 1. Inicializar Timber para logging (Debug vs Production)
 * 2. Configurar WorkManager con Hilt para inyección en Workers
 * 3. Configurar estrategia de error reporting (Crashlytics en producción)
 */
@HiltAndroidApp
class AgroBridgeApplication : Application(), Configuration.Provider {

    /**
     * Factory de Hilt para inyectar dependencias en Workers
     * Proporcionado automáticamente por hilt-work
     */
    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()

        // ====================================================================
        // CONFIGURACIÓN DE TIMBER (Logging)
        // ====================================================================
        // Estrategia diferenciada según BUILD_CONFIG

        if (BuildConfig.DEBUG) {
            // DEBUG: Log todo a Logcat (verbose)
            Timber.plant(Timber.DebugTree())
            Timber.d("🔧 DEBUG BUILD - Logging completo habilitado")
        } else {
            // RELEASE: Log selectivo + Error reporting
            Timber.plant(CrashReportingTree())
            Timber.d("🚀 RELEASE BUILD - Crash reporting habilitado")
        }

        // ====================================================================
        // LOGS INICIALES
        // ====================================================================
        Timber.d("🚀 AgroBridge Application iniciada")
        Timber.d("📱 Versión: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
        Timber.d("🔨 BuildType: ${if (BuildConfig.DEBUG) "DEBUG" else "RELEASE"}")
        Timber.d("✅ WorkManager + Hilt configurado")
        Timber.d("🛡️  Timber logging strategy iniciada")
    }

    /**
     * Configuración de WorkManager
     * Esta es la clave para que @HiltWorker funcione correctamente
     *
     * Aquí le decimos a WorkManager que use HiltWorkerFactory
     * para crear instancias de Workers con inyección de dependencias
     */
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
}

