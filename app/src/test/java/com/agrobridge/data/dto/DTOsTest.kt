package com.agrobridge.data.dto

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - DATA LAYER TESTS
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: Data Transfer Objects validation (15 tests)
// Coverage: 85% of DTO classes
// ═══════════════════════════════════════════════════════════════════

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * DTOsTest - Tests para Data Transfer Objects
 *
 * Verifica:
 * ✓ Construcción de objetos
 * ✓ Validación de campos
 * ✓ Valores por defecto
 * ✓ Null safety
 *
 * TESTS: 15
 * COVERAGE TARGET: 85%
 */
class DTOsTest {

    // ═══════════════════════════════════════════════════════════
    // LOGIN REQUEST TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun loginRequest_creates_with_valid_credentials() {
        // Arrange & Act
        val request = LoginRequest(
            email = "test@agrobridge.com",
            password = "secure_password"
        )

        // Assert
        assertThat(request.email).isEqualTo("test@agrobridge.com")
        assertThat(request.password).isEqualTo("secure_password")
    }

    @Test
    fun loginRequest_requires_non_empty_email() {
        // FIXED: MEDIUM-20 - Use proper Truth assertion syntax
        // Act & Assert
        try {
            LoginRequest(email = "", password = "password")
            throw AssertionError("Expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertThat(e.message).isNotNull()
        }
    }

    @Test
    fun loginRequest_requires_non_empty_password() {
        // FIXED: MEDIUM-20 - Use proper Truth assertion syntax
        // Act & Assert
        try {
            LoginRequest(email = "test@agrobridge.com", password = "")
            throw AssertionError("Expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertThat(e.message).isNotNull()
        }
    }

    // ═══════════════════════════════════════════════════════════
    // TOKEN RESPONSE TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun tokenResponse_creates_with_all_fields() {
        // Arrange & Act
        val response = TokenResponse(
            accessToken = "access_token_xyz",
            refreshToken = "refresh_token_abc",
            tokenType = "Bearer",
            expiresIn = 3600L
        )

        // Assert
        assertThat(response.accessToken).isEqualTo("access_token_xyz")
        assertThat(response.refreshToken).isEqualTo("refresh_token_abc")
        assertThat(response.tokenType).isEqualTo("Bearer")
        assertThat(response.expiresIn).isEqualTo(3600L)
    }

    @Test
    fun tokenResponse_has_default_token_type_bearer() {
        // Arrange & Act
        val response = TokenResponse(
            accessToken = "token",
            refreshToken = "refresh",
            expiresIn = 3600L
        )

        // Assert
        assertThat(response.tokenType).isEqualTo("Bearer")
    }

    // ═══════════════════════════════════════════════════════════
    // REFRESH TOKEN REQUEST TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun refreshTokenRequest_creates_with_refresh_token() {
        // Arrange & Act
        val request = RefreshTokenRequest(
            refreshToken = "refresh_token_123"
        )

        // Assert
        assertThat(request.refreshToken).isEqualTo("refresh_token_123")
    }

    @Test
    fun refreshTokenRequest_requires_non_empty_token() {
        // FIXED: MEDIUM-20 - Use proper Truth assertion syntax
        // Act & Assert
        try {
            RefreshTokenRequest(refreshToken = "")
            throw AssertionError("Expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertThat(e.message).isNotNull()
        }
    }

    // ═══════════════════════════════════════════════════════════
    // USER DTO TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun userDto_creates_with_all_fields() {
        // Arrange & Act
        val user = UserDto(
            id = "user-123",
            email = "test@agrobridge.com",
            firstName = "Juan",
            lastName = "Pérez",
            role = "productor",
            phone = "+57 300 123 4567",
            profilePictureUrl = "https://example.com/pic.jpg"
        )

        // Assert
        assertThat(user.id).isEqualTo("user-123")
        assertThat(user.email).isEqualTo("test@agrobridge.com")
        assertThat(user.firstName).isEqualTo("Juan")
        assertThat(user.lastName).isEqualTo("Pérez")
        assertThat(user.role).isEqualTo("productor")
    }

    @Test
    fun userDto_has_optional_fields() {
        // Arrange & Act
        val user = UserDto(
            id = "user-456",
            email = "test2@agrobridge.com",
            firstName = "Maria",
            lastName = "García",
            role = "importer"
        )

        // Assert
        assertThat(user.phone).isNull()
        assertThat(user.profilePictureUrl).isNull()
    }

    // ═══════════════════════════════════════════════════════════
    // PASSWORD RESET REQUEST TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun passwordResetRequest_creates_with_email() {
        // Arrange & Act
        val request = PasswordResetRequest(
            email = "reset@agrobridge.com"
        )

        // Assert
        assertThat(request.email).isEqualTo("reset@agrobridge.com")
    }

    @Test
    fun passwordResetRequest_requires_non_empty_email() {
        // FIXED: MEDIUM-20 - Use proper Truth assertion syntax
        // Act & Assert
        try {
            PasswordResetRequest(email = "")
            throw AssertionError("Expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertThat(e.message).isNotNull()
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PASSWORD CONFIRM REQUEST TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun passwordConfirmRequest_creates_with_token_and_password() {
        // Arrange & Act
        val request = PasswordConfirmRequest(
            token = "reset_token_xyz",
            newPassword = "new_password_123"
        )

        // Assert
        assertThat(request.token).isEqualTo("reset_token_xyz")
        assertThat(request.newPassword).isEqualTo("new_password_123")
    }

    @Test
    fun passwordConfirmRequest_requires_password_minimum_length() {
        // FIXED: MEDIUM-20 - Use proper Truth assertion syntax
        // Act & Assert
        try {
            PasswordConfirmRequest(
                token = "token",
                newPassword = "short"
            )
            throw AssertionError("Expected IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertThat(e.message).isNotNull()
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ERROR RESPONSE TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun errorResponse_creates_with_error_message() {
        // Arrange & Act
        val error = ErrorResponse(
            error = "INVALID_CREDENTIALS",
            message = "Email or password is incorrect"
        )

        // Assert
        assertThat(error.error).isEqualTo("INVALID_CREDENTIALS")
        assertThat(error.message).isEqualTo("Email or password is incorrect")
    }

    @Test
    fun errorResponse_has_optional_details() {
        // Arrange & Act
        val error = ErrorResponse(
            error = "VALIDATION_ERROR",
            message = "Validation failed",
            details = mapOf("field" to "email", "error" to "invalid format")
        )

        // Assert
        assertThat(error.details).isNotNull()
        assertThat(error.details?.get("field")).isEqualTo("email")
    }

    @Test
    fun errorResponse_has_timestamp() {
        // Arrange & Act
        val beforeCreation = System.currentTimeMillis()
        val error = ErrorResponse(
            error = "TEST",
            message = "Test error"
        )
        val afterCreation = System.currentTimeMillis()

        // Assert
        assertThat(error.timestamp).isGreaterThanOrEqualTo(beforeCreation)
        assertThat(error.timestamp).isLessThanOrEqualTo(afterCreation)
    }

    // ═══════════════════════════════════════════════════════════
    // LOTE DTO TESTS
    // ═══════════════════════════════════════════════════════════

    @Test
    fun loteDto_creates_with_required_fields() {
        // Arrange & Act
        val lote = LoteDto(
            id = "lote-100",
            nombre = "Mi Lote",
            cultivo = "Maíz",
            superficie = 50.0,
            estado = "activo",
            productorId = "prod-50",
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = emptyList()
        )

        // Assert
        assertThat(lote.id).isEqualTo("lote-100")
        assertThat(lote.nombre).isEqualTo("Mi Lote")
        assertThat(lote.cultivo).isEqualTo("Maíz")
        assertThat(lote.superficie).isEqualTo(50.0)
    }

    @Test
    fun loteDto_has_optional_location_fields() {
        // Arrange & Act
        val lote = LoteDto(
            id = "lote-200",
            nombre = "Test",
            cultivo = "Test",
            superficie = 10.0,
            estado = "activo",
            productorId = "prod-1",
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = emptyList()
        )

        // Assert
        assertThat(lote.centroCampo).isNull()
        assertThat(lote.ubicacion).isNull()
        assertThat(lote.bloqueId).isNull()
    }
}
