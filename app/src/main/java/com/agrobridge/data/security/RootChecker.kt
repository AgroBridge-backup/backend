package com.agrobridge.data.security

import android.content.Context
import timber.log.Timber
import java.io.File

/**
 * RootChecker - Detecta si el dispositivo está rooteado/jailbroken
 *
 * Responsabilidades:
 * - Detectar acceso root en el dispositivo
 * - Advertir al usuario sobre riesgos de seguridad
 * - Bloquear funcionalidades sensibles si está rooteado
 * - Loguear intentos de bypass de seguridad
 *
 * ¿Por qué detectar root?
 * - Dispositivos rooteados tienen acceso a:
 *   - System files (incluyendo certificados)
 *   - Datos de otras apps
 *   - Memoria de runtime
 *   - Datos cifrados (si el atacante tiene privilegios)
 * - Pueden instalar malware a nivel de sistema
 * - Pueden interceptar tráfico HTTPS (fakear certificados)
 *
 * Métodos de detección:
 * 1. Búsqueda de binarios de root (su, busybox, superuser)
 * 2. Búsqueda de apps rooting populares (Magisk, SuperSU)
 * 3. Búsqueda de directorios específicos de root (/system/xbin)
 * 4. Validación de system properties
 * 5. Búsqueda de SELinux permissivo
 *
 * Limitaciones:
 * - Detección es probabilística, no 100% segura
 * - Algunos malwares pueden ocultar el hecho de estar rooteado
 * - No reemplaza otras medidas de seguridad
 * - Usar en combinación con Certificate Pinning y HTTPS
 *
 * Estrategia de AgroBridge:
 * - ADVERTIR al usuario (log + UI toast)
 * - REDUCIR funcionalidad pero permitir uso básico
 * - NO BLOQUEAR completamente (mejor UX)
 * - LOGUEAR para auditoría
 */
class RootChecker(private val context: Context) {

    companion object {
        private const val TAG = "RootChecker"

        // Rutas comunes de binarios de root
        private val ROOT_BINARIES = arrayOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/system/bin/superuser",
            "/system/bin/daemonsu",
            "/system/bin/magisk",
            "/sbin/su",
            "/sbin/superuser",
            "/sbin/daemonsu",
            "/sbin/magisk",
            "/data/local/tmp/su",
            "/data/local/su",
            "/data/adb/magisk",
            "/system/app/Superuser.apk",
            "/system/app/SuperUser.apk",
            "/system/app/superuser.apk",
            "/system/xbin/busybox"
        )

        // Directorios que indican rooting
        private val ROOT_DIRECTORIES = arrayOf(
            "/system/xbin/",
            "/system/app/superuser.apk",
            "/system/app/Superuser.apk",
            "/system/app/SuperUser.apk",
            "/data/adb/magisk",
            "/data/local/tmp/",
            "/data/adb/"
        )

        // Properties que indican rooting
        private val ROOT_PROPERTIES = arrayOf(
            "ro.build.selinux",
            "ro.debuggable",
            "ro.secure"
        )

        // Packages de apps rooting populares
        private val ROOT_PACKAGES = arrayOf(
            "com.topjohnwu.magisk", // Magisk
            "eu.chainfire.supersu", // SuperSU
            "com.koushikdutta.superuser", // Koush's Superuser
            "com.thirdparty.superuser", // Superuser by Koush
            "me.phh.superuser", // phh's Superuser
            "com.noshufou.android.su", // Superuser by noshufou
            "com.zachspong.temprootremovejellybeans", // Temporary Root
            "com.ramdroid.appquarantine", // App Quarantine
            "com.zachspong.temprootremovejellybeans" // Temporary Root Remove Jellybeans
        )
    }

    private var cachedResult: Boolean? = null

    /**
     * Verificar si el dispositivo está rooteado
     *
     * @return true si hay indicios de root, false si parece seguro
     */
    fun isDeviceRooted(): Boolean {
        // Usar cache para no verificar múltiples veces
        cachedResult?.let { return it }

        val result = performRootCheck()
        cachedResult = result

        if (result) {
            Timber.w("🚨 DISPOSITIVO ROOTEADO DETECTADO")
            logRootWarning()
        } else {
            Timber.d("✅ Dispositivo no rooteado")
        }

        return result
    }

    /**
     * Realizar verificación de root
     *
     * Retorna true si cualquiera de los siguientes es verdadero:
     * - Archivo de binary de root existe
     * - Directorio de root existe
     * - App rooting está instalada
     * - Properties de root están activos
     */
    private fun performRootCheck(): Boolean {
        // Check 1: Búsqueda de binarios de root
        if (checkRootBinaries()) {
            Timber.w("⚠ Binarios de root detectados")
            return true
        }

        // Check 2: Búsqueda de directorios de root
        if (checkRootDirectories()) {
            Timber.w("⚠ Directorios de root detectados")
            return true
        }

        // Check 3: Búsqueda de apps rooting instaladas
        if (checkRootPackages()) {
            Timber.w("⚠ Apps rooting detectadas")
            return true
        }

        // Check 4: Validación de properties
        if (checkRootProperties()) {
            Timber.w("⚠ Properties de root detectadas")
            return true
        }

        return false
    }

    /**
     * Verificar si existen binarios de root
     */
    private fun checkRootBinaries(): Boolean {
        return ROOT_BINARIES.any { binary ->
            val file = File(binary)
            val exists = file.exists()
            if (exists) {
                Timber.d("Binario encontrado: $binary")
            }
            exists
        }
    }

    /**
     * Verificar si existen directorios de root
     */
    private fun checkRootDirectories(): Boolean {
        return ROOT_DIRECTORIES.any { directory ->
            val file = File(directory)
            val exists = file.exists() && file.isDirectory
            if (exists) {
                Timber.d("Directorio encontrado: $directory")
            }
            exists
        }
    }

    /**
     * Verificar si apps rooting están instaladas
     */
    private fun checkRootPackages(): Boolean {
        val packageManager = context.packageManager
        return ROOT_PACKAGES.any { packageName ->
            try {
                packageManager.getPackageInfo(packageName, 0)
                Timber.d("Package rooting encontrado: $packageName")
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    /**
     * Verificar properties del sistema que indican root
     *
     * Nota: En Android moderno, esto es más difícil debido a restricciones
     * de acceso a system properties
     */
    private fun checkRootProperties(): Boolean {
        return try {
            val properties = arrayOf(
                "ro.build.selinux" to "0",
                "ro.debuggable" to "1",
                "ro.secure" to "0"
            )

            properties.any { (prop, expectedValue) ->
                try {
                    val clazz = Class.forName("android.os.SystemProperties")
                    val method = clazz.getMethod("get", String::class.java)
                    val value = method.invoke(null, prop) as String
                    if (value == expectedValue) {
                        Timber.d("Property sospechosa: $prop=$value")
                        return@any true
                    }
                    false
                } catch (e: Exception) {
                    false
                }
            }
        } catch (e: Exception) {
            Timber.d("No se pudieron verificar properties: ${e.message}")
            false
        }
    }

    /**
     * Loguear advertencia de dispositivo rooteado
     *
     * Información relevante para auditoría:
     * - Fecha/hora de detección
     * - Qué tipo de rooting fue detectado
     * - Estado de la sesión
     */
    private fun logRootWarning() {
        Timber.e("""
            ════════════════════════════════════════════════════════════════════
            🚨 ADVERTENCIA DE SEGURIDAD: DISPOSITIVO ROOTEADO
            ════════════════════════════════════════════════════════════════════

            El dispositivo parece estar rooteado, lo cual puede comprometer la
            seguridad de los datos sensibles de AgroBridge.

            Riesgos:
            • Acceso a datos de aplicaciones no autorizado
            • Instalación de certificados falsos (MITM attacks)
            • Acceso a archivos de caché y bases de datos
            • Ejecución de código malicioso a nivel de sistema

            Recomendaciones:
            • Usar un dispositivo no rooteado para funcionalidad sensible
            • Instalar anti-virus para detectar malware
            • Cambiar contraseñas desde un dispositivo seguro
            • Revisar permisos otorgados a aplicaciones

            Timestamp: ${System.currentTimeMillis()}
            ════════════════════════════════════════════════════════════════════
        """.trimIndent())
    }

    /**
     * Obtener información de depuración (auditoría)
     */
    fun getDebugInfo(): String {
        return """
            RootChecker Debug Info:
            - Device Rooted: ${isDeviceRooted()}
            - Check Time: ${System.currentTimeMillis()}
            - Root Binaries Found: ${checkRootBinaries()}
            - Root Directories Found: ${checkRootDirectories()}
            - Root Packages Found: ${checkRootPackages()}
            - Root Properties Found: ${checkRootProperties()}
        """.trimIndent()
    }
}
