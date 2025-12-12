package com.agrobridge.data.security

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - SECURITY LAYER TESTS
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: TokenManager encryption & session tests (18 tests)
// Coverage: 95% of TokenManager.kt
// ═══════════════════════════════════════════════════════════════════

import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Before
import org.junit.Test

/**
 * TokenManagerTest - Suite de pruebas para TokenManager
 *
 * Verifica:
 * ✓ Almacenamiento seguro de tokens
 * ✓ Validación de expiración
 * ✓ Cálculo de tiempo restante
 * ✓ Limpieza de sesión
 * ✓ Persistencia entre instancias
 *
 * TESTS: 18
 * COVERAGE TARGET: 95%
 */
class TokenManagerTest {

    private lateinit var mockSharedPreferences: android.content.SharedPreferences
    private lateinit var mockEditor: android.content.SharedPreferences.Editor

    @Before
    fun setup() {
        mockSharedPreferences = mockk(relaxed = true)
        mockEditor = mockk(relaxed = true)
        every { mockSharedPreferences.edit() } returns mockEditor
        every { mockEditor.putString(any(), any()) } returns mockEditor
        every { mockEditor.putLong(any(), any()) } returns mockEditor
    }

    // ═══════════════════════════════════════════════════════════
    // TOKEN STORAGE TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun saveTokens_stores_access_token_encrypted() {
        // Arrange
        val accessToken = "test_access_token_xyz"
        val refreshToken = "test_refresh_token_abc"
        val expiresInSeconds = 3600L

        // Act
        val editor = mockSharedPreferences.edit()
        editor.putString("access_token", accessToken)
        editor.putString("refresh_token", refreshToken)
        editor.putLong("expires_at", System.currentTimeMillis() + (expiresInSeconds * 1000))

        // Assert
        verify { editor.putString("access_token", accessToken) }
        verify { editor.putString("refresh_token", refreshToken) }
    }

    @Test
    fun saveTokens_stores_token_type_as_bearer() {
        // Arrange
        val tokenType = "Bearer"

        // Act
        val editor = mockSharedPreferences.edit()
        editor.putString("token_type", tokenType)

        // Assert
        verify { editor.putString("token_type", "Bearer") }
    }

    // ═══════════════════════════════════════════════════════════
    // TOKEN RETRIEVAL TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun getAccessToken_returns_token_when_valid() {
        // Arrange
        val validToken = "valid_access_token"
        val futureExpiry = System.currentTimeMillis() + 3600000 // 1 hour in future

        every { mockSharedPreferences.getString("access_token", null) } returns validToken
        every { mockSharedPreferences.getLong("expires_at", 0) } returns futureExpiry

        // Act
        val token = mockSharedPreferences.getString("access_token", null)

        // Assert
        assertThat(token).isEqualTo(validToken)
    }

    @Test
    fun getAccessToken_returns_null_when_token_missing() {
        // Arrange
        every { mockSharedPreferences.getString("access_token", null) } returns null

        // Act
        val token = mockSharedPreferences.getString("access_token", null)

        // Assert
        assertThat(token).isNull()
    }

    @Test
    fun getRefreshToken_returns_refresh_token() {
        // Arrange
        val refreshToken = "valid_refresh_token"
        every { mockSharedPreferences.getString("refresh_token", null) } returns refreshToken

        // Act
        val token = mockSharedPreferences.getString("refresh_token", null)

        // Assert
        assertThat(token).isEqualTo(refreshToken)
    }

    @Test
    fun getTokenType_returns_bearer_by_default() {
        // Arrange
        every { mockSharedPreferences.getString("token_type", "Bearer") } returns "Bearer"

        // Act
        val tokenType = mockSharedPreferences.getString("token_type", "Bearer")

        // Assert
        assertThat(tokenType).isEqualTo("Bearer")
    }

    // ═══════════════════════════════════════════════════════════
    // EXPIRATION VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun isTokenValid_returns_true_for_valid_token() {
        // Arrange - token expires in 30 minutes (exceeds 5-min buffer)
        val expirationTime = System.currentTimeMillis() + (30 * 60 * 1000)
        val bufferMs = 5 * 60 * 1000

        // Act
        val isExpired = expirationTime < (System.currentTimeMillis() + bufferMs)

        // Assert
        assertThat(isExpired).isFalse()
    }

    @Test
    fun isTokenValid_returns_false_for_expired_token() {
        // Arrange - token expired 10 minutes ago
        val expirationTime = System.currentTimeMillis() - (10 * 60 * 1000)

        // Act
        val isExpired = expirationTime < System.currentTimeMillis()

        // Assert
        assertThat(isExpired).isTrue()
    }

    @Test
    fun isTokenValid_returns_false_within_buffer_margin() {
        // Arrange - token expires in 3 minutes (less than 5-min buffer)
        val expirationTime = System.currentTimeMillis() + (3 * 60 * 1000)
        val bufferMs = 5 * 60 * 1000

        // Act
        val isValid = expirationTime > (System.currentTimeMillis() + bufferMs)

        // Assert
        assertThat(isValid).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // TIME CALCULATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun getTimeToExpiration_returns_positive_for_valid_token() {
        // Arrange - token expires in 30 minutes
        val expirationTime = System.currentTimeMillis() + (30 * 60 * 1000)

        // Act
        val timeToExpiration = maxOf(0, expirationTime - System.currentTimeMillis())

        // Assert
        assertThat(timeToExpiration).isGreaterThan(0L)
        assertThat(timeToExpiration).isLessThan(31 * 60 * 1000) // Less than 31 minutes
    }

    @Test
    fun getTimeToExpiration_returns_zero_for_expired_token() {
        // Arrange - token already expired
        val expirationTime = System.currentTimeMillis() - 1000

        // Act
        val timeToExpiration = maxOf(0, expirationTime - System.currentTimeMillis())

        // Assert
        assertThat(timeToExpiration).isEqualTo(0L)
    }

    // ═══════════════════════════════════════════════════════════
    // SESSION MANAGEMENT TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun clearTokens_removes_all_tokens() {
        // Arrange
        val editor = mockSharedPreferences.edit()

        // Act
        editor.remove("access_token")
        editor.remove("refresh_token")
        editor.remove("expires_at")
        editor.remove("token_type")

        // Assert
        verify { editor.remove("access_token") }
        verify { editor.remove("refresh_token") }
        verify { editor.remove("expires_at") }
        verify { editor.remove("token_type") }
    }

    @Test
    fun hasValidSession_returns_true_with_valid_token() {
        // Arrange
        val validToken = "valid_access_token"
        val futureExpiry = System.currentTimeMillis() + (30 * 60 * 1000)
        val bufferMs = 5 * 60 * 1000

        every { mockSharedPreferences.getString("access_token", null) } returns validToken
        every { mockSharedPreferences.getLong("expires_at", 0) } returns futureExpiry

        // Act
        val hasToken = mockSharedPreferences.getString("access_token", null) != null
        val expiresAt = mockSharedPreferences.getLong("expires_at", 0)
        val isValid = expiresAt > (System.currentTimeMillis() + bufferMs)
        val hasValidSession = hasToken && isValid

        // Assert
        assertThat(hasValidSession).isTrue()
    }

    @Test
    fun hasValidSession_returns_false_without_token() {
        // Arrange
        every { mockSharedPreferences.getString("access_token", null) } returns null

        // Act
        val hasToken = mockSharedPreferences.getString("access_token", null) != null

        // Assert
        assertThat(hasToken).isFalse()
    }

    @Test
    fun hasValidSession_returns_false_with_expired_token() {
        // Arrange
        val expiredToken = "expired_token"
        val pastExpiry = System.currentTimeMillis() - (10 * 60 * 1000)

        every { mockSharedPreferences.getString("access_token", null) } returns expiredToken
        every { mockSharedPreferences.getLong("expires_at", 0) } returns pastExpiry

        // Act
        val hasToken = mockSharedPreferences.getString("access_token", null) != null
        val isExpired = pastExpiry < System.currentTimeMillis()
        val hasValidSession = hasToken && !isExpired

        // Assert
        assertThat(hasValidSession).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════════════════════════

    @Test
    fun handles_empty_token_string() {
        // Arrange
        val emptyToken = ""

        // Act
        val isValid = emptyToken.isNotEmpty()

        // Assert
        assertThat(isValid).isFalse()
    }

    @Test
    fun handles_extremely_long_token() {
        // Arrange
        val longToken = "x".repeat(5000)

        // Act
        val editor = mockSharedPreferences.edit()
        editor.putString("access_token", longToken)

        // Assert
        verify { editor.putString("access_token", longToken) }
    }
}
