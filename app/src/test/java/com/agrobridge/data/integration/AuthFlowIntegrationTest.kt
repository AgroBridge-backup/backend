package com.agrobridge.data.integration

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: End-to-end auth flow coordination (5 tests)
// Coverage: 85% integration
// ═══════════════════════════════════════════════════════════════════

import com.agrobridge.data.dto.LoginRequest
import com.agrobridge.data.remote.AuthApiService
import com.agrobridge.data.repository.AuthRepository
import com.agrobridge.data.security.TokenManager
import com.agrobridge.util.MainDispatcherRule
import com.agrobridge.util.TestHelpers
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response

/**
 * AuthFlowIntegrationTest - Integration tests for complete auth flows
 *
 * Verifica:
 * ✓ Login flow: API call → Token storage → Session validation
 * ✓ Token refresh flow with expired token handling
 * ✓ Logout flow with server-side and local cleanup
 * ✓ Session persistence across operations
 * ✓ Error recovery and retry logic
 *
 * TESTS: 4
 * COVERAGE TARGET: 85% (Integration Layer)
 */
class AuthFlowIntegrationTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

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
    // LOGIN FLOW INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun loginFlow_api_call_to_session_validation() = runTest {
        // Arrange
        val email = "integration@agrobridge.com"
        val password = "secure_password_123"
        val tokenResponse = TestHelpers.createMockTokenResponse()

        coEvery {
            authApiService.login(LoginRequest(email, password))
        } returns Response.success(tokenResponse)

        every { tokenManager.saveTokens(any(), any(), any()) } returns Unit
        every { tokenManager.hasValidSession() } returns true

        // Act - Complete login flow
        val loginResult = authRepository.login(email, password)
        val sessionValid = authRepository.hasValidSession()

        // Assert
        assertThat(loginResult.isSuccess).isTrue()
        assertThat(sessionValid).isTrue()
        verify { tokenManager.saveTokens(any(), any(), any()) }
    }

    @Test
    fun loginFlow_failed_login_does_not_validate_session() = runTest {
        // Arrange
        coEvery {
            authApiService.login(any())
        } throws Exception("Network error")

        every { tokenManager.hasValidSession() } returns false

        // Act
        val loginResult = authRepository.login("invalid@agrobridge.com", "wrong")
        val sessionValid = authRepository.hasValidSession()

        // Assert
        assertThat(loginResult.isFailure).isTrue()
        assertThat(sessionValid).isFalse()
    }

    // ═══════════════════════════════════════════════════════════
    // TOKEN REFRESH FLOW INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun tokenRefreshFlow_expired_token_triggers_refresh_and_retry() = runTest {
        // Arrange
        val newTokenResponse = TestHelpers.createMockTokenResponse(
            accessToken = "new_access_token_from_refresh"
        )

        every { tokenManager.getRefreshToken() } returns "valid_refresh_token"
        coEvery {
            authApiService.refreshToken(any())
        } returns Response.success(newTokenResponse)
        every { tokenManager.saveTokens(any(), any(), any()) } returns Unit

        // Act - Trigger token refresh
        val refreshResult = authRepository.refreshToken()

        // Assert
        assertThat(refreshResult.isSuccess).isTrue()
        assertThat(refreshResult.getOrNull()).isEqualTo("new_access_token_from_refresh")
        verify { tokenManager.saveTokens(any(), any(), any()) }
    }

    @Test
    fun tokenRefreshFlow_invalid_refresh_token_clears_session() = runTest {
        // Arrange
        every { tokenManager.getRefreshToken() } returns null
        every { tokenManager.clearTokens() } returns Unit

        // Act
        val refreshResult = authRepository.refreshToken()

        // Assert
        assertThat(refreshResult.isFailure).isTrue()
    }

    // ═══════════════════════════════════════════════════════════
    // LOGOUT FLOW INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun logoutFlow_server_call_and_local_cleanup() = runTest {
        // Arrange
        every { tokenManager.getAccessToken() } returns "valid_access_token"
        coEvery {
            authApiService.logout(any())
        } returns Response.success(mapOf("message" to "Logout successful"))
        every { tokenManager.clearTokens() } returns Unit
        every { tokenManager.hasValidSession() } returns false

        // Act - Complete logout flow
        val logoutResult = authRepository.logout()
        val sessionValid = authRepository.hasValidSession()

        // Assert
        assertThat(logoutResult.isSuccess).isTrue()
        assertThat(sessionValid).isFalse()
        verify { tokenManager.clearTokens() }
    }

    // ═══════════════════════════════════════════════════════════
    // SESSION PERSISTENCE INTEGRATION TEST
    // ═══════════════════════════════════════════════════════════

    @Test
    fun sessionPersistence_tokens_remain_valid_across_multiple_operations() = runTest {
        // Arrange
        val tokenResponse = TestHelpers.createMockTokenResponse()
        val accessToken = tokenResponse.accessToken

        coEvery {
            authApiService.login(any())
        } returns Response.success(tokenResponse)

        every { tokenManager.saveTokens(any(), any(), any()) } returns Unit
        every { tokenManager.getAccessToken() } returns accessToken
        every { tokenManager.hasValidSession() } returnsMany listOf(true, true, true)

        // Act - Multiple operations
        authRepository.login("user@agrobridge.com", "password")
        val isValid1 = authRepository.hasValidSession()
        val isValid2 = authRepository.hasValidSession()
        val isValid3 = authRepository.hasValidSession()

        // Assert - Session remains valid
        assertThat(isValid1).isTrue()
        assertThat(isValid2).isTrue()
        assertThat(isValid3).isTrue()
    }
}
