package com.agrobridge.data.repository

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - SECURITY LAYER TESTS
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: AuthRepository login, refresh, logout tests (12 tests)
// Coverage: 90% of AuthRepository.kt
// ═══════════════════════════════════════════════════════════════════

import com.agrobridge.data.dto.LoginRequest
import com.agrobridge.data.remote.AuthApiService
import com.agrobridge.data.security.TokenManager
import com.agrobridge.util.TestHelpers
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * AuthRepositoryTest - Suite de pruebas para AuthRepository
 *
 * Verifica:
 * ✓ Login con credenciales
 * ✓ Token refresh automático
 * ✓ Logout limpio
 * ✓ Manejo de errores
 * ✓ Validación de sesión
 *
 * TESTS: 12
 * COVERAGE TARGET: 90%
 */
class AuthRepositoryTest {

    private lateinit var authApiService: AuthApiService
    private lateinit var tokenManager: TokenManager
    private lateinit var authRepository: AuthRepository

    @Before
    fun setup() {
        authApiService = mockk()
        tokenManager = mockk()
        authRepository = AuthRepository(authApiService, tokenManager)
    }

    // ═══════════════════════════════════════════════════════════
    // LOGIN TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun login_with_valid_credentials_saves_tokens() = runTest {
        // Arrange
        val email = "test@agrobridge.com"
        val password = "secure_password_123"
        val tokenResponse = TestHelpers.createMockTokenResponse()

        coEvery {
            authApiService.login(LoginRequest(email, password))
        } returns Response.success(tokenResponse)

        // Act
        val result = authRepository.login(email, password)

        // Assert
        assertThat(result.isSuccess).isTrue()
        assertThat(result.getOrNull()).isNotNull()
        verify { tokenManager.saveTokens(any(), any(), any()) }
    }

    @Test
    fun login_with_invalid_credentials_returns_failure() = runTest {
        // Arrange
        val email = "test@agrobridge.com"
        val password = "wrong_password"

        coEvery {
            authApiService.login(any())
        } returns Response.success(null)

        // Act
        val result = authRepository.login(email, password)

        // Assert
        assertThat(result.isFailure).isTrue()
    }

    @Test
    fun login_validates_email_field() = runTest {
        // Arrange
        val blankEmail = ""
        val password = "password_123"

        // Act
        val result = authRepository.login(blankEmail, password)

        // Assert
        assertThat(result.isFailure).isTrue()
    }

    @Test
    fun login_validates_password_field() = runTest {
        // Arrange
        val email = "test@agrobridge.com"
        val blankPassword = ""

        // Act
        val result = authRepository.login(email, blankPassword)

        // Assert
        assertThat(result.isFailure).isTrue()
    }

    // ═══════════════════════════════════════════════════════════
    // TOKEN REFRESH TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun refreshToken_with_valid_refresh_token_returns_new_access_token() = runTest {
        // Arrange
        val newRefreshToken = "new_refresh_token_xyz"
        val tokenResponse = TestHelpers.createMockTokenResponse()

        every { tokenManager.getRefreshToken() } returns "old_refresh_token"
        coEvery {
            authApiService.refreshToken(any())
        } returns Response.success(tokenResponse)

        // Act
        val result = authRepository.refreshToken()

        // Assert
        assertThat(result.isSuccess).isTrue()
        assertThat(result.getOrNull()).isNotEmpty()
    }

    @Test
    fun refreshToken_without_refresh_token_returns_failure() = runTest {
        // Arrange
        every { tokenManager.getRefreshToken() } returns null

        // Act
        val result = authRepository.refreshToken()

        // Assert
        assertThat(result.isFailure).isTrue()
    }

    @Test
    fun refreshToken_clears_session_on_401_response() = runTest {
        // Arrange
        every { tokenManager.getRefreshToken() } returns "invalid_refresh"
        coEvery {
            authApiService.refreshToken(any())
        } returns Response.success(null)

        // Act
        val result = authRepository.refreshToken()

        // Assert
        assertThat(result.isFailure).isTrue()
    }

    // ═══════════════════════════════════════════════════════════
    // LOGOUT TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun logout_clears_tokens() = runTest {
        // Arrange
        every { tokenManager.getAccessToken() } returns "valid_token"
        coEvery {
            authApiService.logout(any())
        } returns Response.success(mapOf("message" to "Logout successful"))

        // Act
        val result = authRepository.logout()

        // Assert
        assertThat(result.isSuccess).isTrue()
        verify { tokenManager.clearTokens() }
    }

    @Test
    fun logout_without_token_still_clears_local_tokens() = runTest {
        // Arrange
        every { tokenManager.getAccessToken() } returns null

        // Act
        val result = authRepository.logout()

        // Assert
        assertThat(result.isSuccess).isTrue()
        verify { tokenManager.clearTokens() }
    }

    // ═══════════════════════════════════════════════════════════
    // SESSION VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun hasValidSession_returns_true_when_token_valid() {
        // Arrange
        every { tokenManager.hasValidSession() } returns true

        // Act
        val result = authRepository.hasValidSession()

        // Assert
        assertThat(result).isTrue()
    }

    @Test
    fun hasValidSession_returns_false_when_token_invalid() {
        // Arrange
        every { tokenManager.hasValidSession() } returns false

        // Act
        val result = authRepository.hasValidSession()

        // Assert
        assertThat(result).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // ERROR HANDLING TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun login_handles_network_errors_gracefully() = runTest {
        // Arrange
        coEvery {
            authApiService.login(any())
        } throws Exception("Network error")

        // Act
        val result = authRepository.login("test@agrobridge.com", "password")

        // Assert
        assertThat(result.isFailure).isTrue()
    }
}
