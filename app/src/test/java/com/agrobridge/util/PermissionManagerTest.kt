package com.agrobridge.util

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.verify
import org.junit.Before
import org.junit.Test

/**
 * Tests for PermissionManager
 * Validates Activity context usage and permission handling
 *
 * Bug Fix: HIGH-6
 * Issue: Used ApplicationContext for shouldShowRationale() causing crashes
 * Solution: Accept Activity context explicitly via method parameter
 */
class PermissionManagerTest {

    private lateinit var mockContext: Context
    private lateinit var mockActivity: Activity
    private lateinit var permissionManager: PermissionManager

    @Before
    fun setup() {
        mockContext = mockk()
        mockActivity = mockk()
        permissionManager = PermissionManager(mockContext)

        // Mock static methods
        mockkStatic(ContextCompat::class)
        mockkStatic(ActivityCompat::class)
    }

    // ═══════════════════════════════════════════════════════════
    // PERMISSION GRANT TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun isPermissionGranted_withGrantedPermission_returns_true() {
        // Arrange
        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.CAMERA.manifestPermission
            )
        } returns PackageManager.PERMISSION_GRANTED

        // Act
        val result = permissionManager.isPermissionGranted(
            PermissionManager.Permission.CAMERA
        )

        // Assert
        assertThat(result).isTrue()
    }

    @Test
    fun isPermissionGranted_withDeniedPermission_returns_false() {
        // Arrange
        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.CAMERA.manifestPermission
            )
        } returns PackageManager.PERMISSION_DENIED

        // Act
        val result = permissionManager.isPermissionGranted(
            PermissionManager.Permission.CAMERA
        )

        // Assert
        assertThat(result).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // MULTIPLE PERMISSIONS TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun arePermissionsGranted_allGranted_returns_true() {
        // Arrange
        every {
            android.content.ContextCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_GRANTED

        val permissions = listOf(
            PermissionManager.Permission.LOCATION_FINE,
            PermissionManager.Permission.CAMERA
        )

        // Act
        val result = permissionManager.arePermissionsGranted(permissions)

        // Assert
        assertThat(result).isTrue()
    }

    @Test
    fun arePermissionsGranted_someDenied_returns_false() {
        // Arrange
        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.LOCATION_FINE.manifestPermission
            )
        } returns PackageManager.PERMISSION_GRANTED

        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.CAMERA.manifestPermission
            )
        } returns PackageManager.PERMISSION_DENIED

        val permissions = listOf(
            PermissionManager.Permission.LOCATION_FINE,
            PermissionManager.Permission.CAMERA
        )

        // Act
        val result = permissionManager.arePermissionsGranted(permissions)

        // Assert
        assertThat(result).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // RATIONALE MESSAGE TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun getRationale_cameraPermission_returns_spanish_message() {
        // Arrange
        val permission = PermissionManager.Permission.CAMERA

        // Act
        val rationale = permissionManager.getRationale(permission)

        // Assert
        assertThat(rationale).contains("cámara")
        assertThat(rationale).contains("fotos")
    }

    @Test
    fun getRationale_locationPermission_returns_location_message() {
        // Arrange
        val permission = PermissionManager.Permission.LOCATION_FINE

        // Act
        val rationale = permissionManager.getRationale(permission)

        // Assert
        assertThat(rationale).contains("ubicación")
        assertThat(rationale).contains("mapa")
    }

    // ═══════════════════════════════════════════════════════════
    // CALLBACK TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun handlePermissionResult_withGrantedResult_executesCallback() {
        // Arrange
        val requestCode = 1001
        var callbackExecuted = false
        var receivedResult: PermissionManager.PermissionResult? = null

        permissionManager.registerCallback(requestCode) { result ->
            callbackExecuted = true
            receivedResult = result
        }

        // Act
        permissionManager.handlePermissionResult(
            requestCode,
            intArrayOf(PackageManager.PERMISSION_GRANTED)
        )

        // Assert
        assertThat(callbackExecuted).isTrue()
        assertThat(receivedResult).isInstanceOf(
            PermissionManager.PermissionResult.Granted::class.java
        )
    }

    @Test
    fun handlePermissionResult_withDeniedResult_executesCallback() {
        // Arrange
        val requestCode = 1001
        var callbackExecuted = false
        var receivedResult: PermissionManager.PermissionResult? = null

        permissionManager.registerCallback(requestCode) { result ->
            callbackExecuted = true
            receivedResult = result
        }

        // Act
        permissionManager.handlePermissionResult(
            requestCode,
            intArrayOf(PackageManager.PERMISSION_DENIED)
        )

        // Assert
        assertThat(callbackExecuted).isTrue()
        assertThat(receivedResult).isInstanceOf(
            PermissionManager.PermissionResult.Denied::class.java
        )
    }

    // ═══════════════════════════════════════════════════════════
    // PERMISSION ENUMERATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun getAllPermissionsByCategory_locationCategory_returns_location_permissions() {
        // Act
        val permissions = permissionManager.getAllPermissionsByCategory(
            PermissionManager.PermissionCategory.LOCATION
        )

        // Assert
        assertThat(permissions).hasSize(2)
        assertThat(permissions).contains(
            PermissionManager.Permission.LOCATION_FINE
        )
        assertThat(permissions).contains(
            PermissionManager.Permission.LOCATION_COARSE
        )
    }

    @Test
    fun getPermissionsThatNeedRequest_withMixedPermissions_returns_only_denied() {
        // Arrange
        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.CAMERA.manifestPermission
            )
        } returns PackageManager.PERMISSION_GRANTED

        every {
            android.content.ContextCompat.checkSelfPermission(
                any(),
                PermissionManager.Permission.LOCATION_FINE.manifestPermission
            )
        } returns PackageManager.PERMISSION_DENIED

        val permissions = listOf(
            PermissionManager.Permission.CAMERA,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Act
        val result = permissionManager.getPermissionsThatNeedRequest(permissions)

        // Assert
        assertThat(result).hasSize(1)
        assertThat(result[0]).isEqualTo(PermissionManager.Permission.LOCATION_FINE)
    }

    // ═══════════════════════════════════════════════════════════
    // ACTIVITY CONTEXT TESTS (HIGH-6 FIX)
    // ═══════════════════════════════════════════════════════════

    @Test
    fun shouldShowRationale_with_activity_calls_activitycompat() {
        // Arrange
        every {
            ActivityCompat.shouldShowRequestPermissionRationale(
                mockActivity,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns true

        // Act
        val result = permissionManager.shouldShowRationale(
            mockActivity,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Assert
        assertThat(result).isTrue()
        verify {
            ActivityCompat.shouldShowRequestPermissionRationale(
                mockActivity,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
    }

    @Test
    fun shouldShowRationale_returns_false_for_permanently_denied() {
        // Arrange
        every {
            ActivityCompat.shouldShowRequestPermissionRationale(
                mockActivity,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns false

        // Act
        val result = permissionManager.shouldShowRationale(
            mockActivity,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Assert
        assertThat(result).isFalse()
    }

    @Test
    fun isDeniedPermanently_returns_true_when_denied_and_no_rationale() {
        // Arrange
        every {
            ContextCompat.checkSelfPermission(
                mockContext,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns PackageManager.PERMISSION_DENIED

        every {
            ActivityCompat.shouldShowRequestPermissionRationale(
                mockActivity,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns false

        // Act
        val result = permissionManager.isDeniedPermanently(
            mockActivity,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Assert
        assertThat(result).isTrue()
    }

    @Test
    fun isDeniedPermanently_returns_false_when_rationale_should_show() {
        // Arrange
        every {
            ContextCompat.checkSelfPermission(
                mockContext,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns PackageManager.PERMISSION_DENIED

        every {
            ActivityCompat.shouldShowRequestPermissionRationale(
                mockActivity,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns true

        // Act
        val result = permissionManager.isDeniedPermanently(
            mockActivity,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Assert
        assertThat(result).isFalse()
    }

    @Test
    fun isDeniedPermanently_returns_false_when_permission_granted() {
        // Arrange
        every {
            ContextCompat.checkSelfPermission(
                mockContext,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            )
        } returns PackageManager.PERMISSION_GRANTED

        // Act
        val result = permissionManager.isDeniedPermanently(
            mockActivity,
            PermissionManager.Permission.LOCATION_FINE
        )

        // Assert
        assertThat(result).isFalse()
    }
}
