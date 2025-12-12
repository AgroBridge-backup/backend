package com.agrobridge.util

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - PERMISSION MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: Unified permission request and checking system
// Coverage: Location, Camera, Storage, Calendar permissions
// ═══════════════════════════════════════════════════════════════════

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * PermissionManager - Unified permission management
 *
 * FIXED: HIGH-6 Permission Handling
 * - Accepta Activity context para shouldShowRationale (no solo Application context)
 * - Prevent crashes en permisiion requests
 * - Proper rationale display
 *
 * Responsabilidades:
 * ✓ Verificar permisos concedidos/denegados
 * ✓ Generar mensajes de justificación (rationale) en español
 * ✓ Rastrear estado de solicitudes
 * ✓ Manejar respuestas de usuario (grant/deny)
 * ✓ Integración con Activity/Fragment resultado
 *
 * Uso:
 * ```
 * // Verificar permiso
 * if (permissionManager.isPermissionGranted(PermissionManager.Permission.LOCATION_FINE)) {
 *     startLocationTracking()
 * }
 *
 * // Solicitar permiso (requiere Activity context)
 * permissionManager.shouldShowRationale(
 *     activity,
 *     PermissionManager.Permission.LOCATION_FINE
 * )
 *
 * // Manejar respuesta
 * override fun onRequestPermissionsResult(...) {
 *     permissionManager.handlePermissionResult(requestCode, grantResults)
 * }
 * ```
 */
@Singleton
class PermissionManager @Inject constructor(
    @ApplicationContext private val appContext: Context
) {

    enum class Permission(
        val manifestPermission: String,
        val requestCode: Int,
        val category: PermissionCategory
    ) {
        // Location Permissions
        LOCATION_FINE(
            Manifest.permission.ACCESS_FINE_LOCATION,
            REQUEST_CODE_LOCATION_FINE,
            PermissionCategory.LOCATION
        ),
        LOCATION_COARSE(
            Manifest.permission.ACCESS_COARSE_LOCATION,
            REQUEST_CODE_LOCATION_COARSE,
            PermissionCategory.LOCATION
        ),

        // Camera Permission
        CAMERA(
            Manifest.permission.CAMERA,
            REQUEST_CODE_CAMERA,
            PermissionCategory.CAMERA
        ),

        // Storage Permissions
        READ_EXTERNAL_STORAGE(
            Manifest.permission.READ_EXTERNAL_STORAGE,
            REQUEST_CODE_READ_STORAGE,
            PermissionCategory.STORAGE
        ),
        WRITE_EXTERNAL_STORAGE(
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            REQUEST_CODE_WRITE_STORAGE,
            PermissionCategory.STORAGE
        ),

        // Calendar Permission
        READ_CALENDAR(
            Manifest.permission.READ_CALENDAR,
            REQUEST_CODE_READ_CALENDAR,
            PermissionCategory.CALENDAR
        );

        val rationale: String
            get() = when (this) {
                LOCATION_FINE, LOCATION_COARSE ->
                    "Necesitamos acceso a tu ubicación para marcar lotes en el mapa y proporcionar información precisa del terreno."

                CAMERA ->
                    "Necesitamos acceso a la cámara para tomar fotos de tus cultivos y campos."

                READ_EXTERNAL_STORAGE ->
                    "Necesitamos permiso para acceder a tus fotos y archivos."

                WRITE_EXTERNAL_STORAGE ->
                    "Necesitamos permiso para guardar fotos y datos de los cultivos."

                READ_CALENDAR ->
                    "Necesitamos acceso a tu calendario para programar tareas agrícolas."
            }

        val userFriendlyName: String
            get() = when (this) {
                LOCATION_FINE, LOCATION_COARSE -> "Ubicación"
                CAMERA -> "Cámara"
                READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE -> "Almacenamiento"
                READ_CALENDAR -> "Calendario"
            }
    }

    enum class PermissionCategory {
        LOCATION, CAMERA, STORAGE, CALENDAR
    }

    sealed class PermissionResult {
        object Granted : PermissionResult()
        object Denied : PermissionResult()
        object DeniedPermanently : PermissionResult()
    }

    companion object {
        private const val REQUEST_CODE_LOCATION_FINE = 1001
        private const val REQUEST_CODE_LOCATION_COARSE = 1002
        private const val REQUEST_CODE_CAMERA = 1003
        private const val REQUEST_CODE_READ_STORAGE = 1004
        private const val REQUEST_CODE_WRITE_STORAGE = 1005
        private const val REQUEST_CODE_READ_CALENDAR = 1006
    }

    private val permissionCallbacks = mutableMapOf<Int, (PermissionResult) -> Unit>()

    /**
     * Verificar si un permiso está otorgado
     * (Funciona con Application o Activity context)
     */
    fun isPermissionGranted(permission: Permission): Boolean {
        val result = ContextCompat.checkSelfPermission(
            appContext,
            permission.manifestPermission
        )
        return result == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Verificar múltiples permisos
     */
    fun arePermissionsGranted(permissions: List<Permission>): Boolean {
        return permissions.all { isPermissionGranted(it) }
    }

    /**
     * Verificar si permiso fue denegado permanentemente
     * (sin opción de pedir de nuevo)
     * Requiere Activity context para funcionar correctamente
     */
    fun isDeniedPermanently(activity: Activity, permission: Permission): Boolean {
        return !isPermissionGranted(permission) &&
                !shouldShowRationale(activity, permission)
    }

    /**
     * FIXED: HIGH-6
     * Verificar si debería mostrarse el rationale
     * Ahora requiere Activity context explícitamente para evitar crashes
     *
     * @param activity Activity actual (necesario para ActivityCompat)
     * @param permission Permiso a verificar
     * @return true si debería mostrar el rationale, false si fue denegado permanentemente
     */
    fun shouldShowRationale(activity: Activity, permission: Permission): Boolean {
        return ActivityCompat.shouldShowRequestPermissionRationale(
            activity,
            permission.manifestPermission
        )
    }

    fun getRationale(permission: Permission): String {
        return permission.rationale
    }

    fun registerCallback(
        requestCode: Int,
        callback: (PermissionResult) -> Unit
    ) {
        permissionCallbacks[requestCode] = callback
    }

    fun handlePermissionResult(
        requestCode: Int,
        grantResults: IntArray
    ) {
        if (grantResults.isEmpty()) {
            executeCallback(requestCode, PermissionResult.Denied)
            return
        }

        val result = if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            PermissionResult.Granted
        } else {
            PermissionResult.Denied
        }

        executeCallback(requestCode, result)
    }

    private fun executeCallback(
        requestCode: Int,
        result: PermissionResult
    ) {
        val callback = permissionCallbacks.remove(requestCode)
        callback?.invoke(result)
    }

    fun getPermissionByRequestCode(requestCode: Int): Permission? {
        return Permission.values().find { it.requestCode == requestCode }
    }

    fun getAllPermissionsByCategory(category: PermissionCategory): List<Permission> {
        return Permission.values().filter { it.category == category }
    }

    fun getPermissionsThatNeedRequest(permissions: List<Permission>): List<Permission> {
        return permissions.filter { !isPermissionGranted(it) }
    }

    fun logPermissionStatus(permission: Permission) {
        val status = if (isPermissionGranted(permission)) "GRANTED" else "DENIED"
        Timber.d("Permission ${permission.name}: $status")
    }
}
