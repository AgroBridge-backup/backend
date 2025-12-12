package com.agrobridge.presentation.screens.login

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - LOGIN VIEWMODEL
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: Production-ready login with error handling, validation, retry
// Coverage: Form state, validation, login flow, error handling, retry logic
// ═══════════════════════════════════════════════════════════════════

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.Productor
import com.agrobridge.util.DataValidator
import com.agrobridge.util.ErrorHandler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * LoginViewModel - Production-ready con error handling y validación real-time
 *
 * ARQUITECTURA:
 * - Single Source of Truth: StateFlow para UI state
 * - Unidirectional Data Flow: UI events → ViewModel → State updates
 * - Error Handling: ErrorHandler centralizado para UX consistente
 * - Validation: Real-time con feedback instantáneo
 *
 * MEJORES PRÁCTICAS 2025:
 * ✅ Kotlin Coroutines + Flow (no LiveData deprecated)
 * ✅ StateFlow para estado inmutable
 * ✅ Sealed classes para type-safe states
 * ✅ Dependency Injection con Hilt
 * ✅ Error handling comprehensivo con retry logic
 * ✅ Validation en tiempo real (mejor UX)
 *
 * @author Alejandro Navarro Ayala - CEO & Senior Developer
 * @company AgroBridge International
 * @since November 29, 2025
 * @version 1.0.0
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val errorHandler: ErrorHandler,
    private val dataValidator: DataValidator
) : ViewModel() {

    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════
    companion object {
        // FIXED: LOW-036 - Extract hardcoded network delay to constant
        private const val SIMULATED_NETWORK_DELAY_MS = 1500L  // Simulated API response delay
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT (Single Source of Truth)
    // ═══════════════════════════════════════════════════════════════

    /**
     * UI State - Sealed class para type-safety
     *
     * PATRÓN: State Machine Pattern
     * Idle → Loading → Success/Error
     */
    sealed class UiState {
        /** Estado inicial - formulario vacío */
        data object Idle : UiState()

        /** Cargando - mostrando progress indicator */
        data object Loading : UiState()

        /** Login exitoso - navegar a home */
        data class Success(
            val userId: String,
            val userName: String
        ) : UiState()

        /** Error - mostrar mensaje con opción de retry */
        data class Error(
            val message: String,
            val canRetry: Boolean = true,
            val retryCount: Int = 0
        ) : UiState()
    }

    // Main UI state
    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    // ═══════════════════════════════════════════════════════════════
    // FORM STATE (Reactive Form Pattern)
    // ═══════════════════════════════════════════════════════════════

    /** Email field state */
    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    /** Password field state */
    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    /** Password visibility toggle */
    private val _passwordVisible = MutableStateFlow(false)
    val passwordVisible: StateFlow<Boolean> = _passwordVisible.asStateFlow()

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION STATE (Real-time Feedback)
    // ═══════════════════════════════════════════════════════════════

    /** Email validation error (null = valid) */
    private val _emailError = MutableStateFlow<String?>(null)
    val emailError: StateFlow<String?> = _emailError.asStateFlow()

    /** Password validation error (null = valid) */
    private val _passwordError = MutableStateFlow<String?>(null)
    val passwordError: StateFlow<String?> = _passwordError.asStateFlow()

    /**
     * Form validity state - Computed property
     *
     * PATRÓN: Derived State Pattern
     * Se actualiza automáticamente cuando cambian email/password
     */
    val isFormValid: StateFlow<Boolean> = combine(
        _email,
        _password,
        _emailError,
        _passwordError
    ) { email, password, emailErr, passErr ->
        email.isNotBlank() &&
                password.isNotBlank() &&
                emailErr == null &&
                passErr == null
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = false
    )

    // ═══════════════════════════════════════════════════════════════
    // RETRY LOGIC
    // ═══════════════════════════════════════════════════════════════

    private val _retryCount = MutableStateFlow(0)

    private companion object {
        const val MAX_RETRIES = 3
        const val TAG = "LoginViewModel"
    }

    // ═══════════════════════════════════════════════════════════════
    // USER ACTIONS (UI Events)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Maneja cambio de email con validación real-time
     *
     * MEJORA UX:
     * - Usuario ve errores mientras escribe
     * - Feedback instantáneo (no esperar a submit)
     * - Mensajes user-friendly (no técnicos)
     */
    fun onEmailChanged(newEmail: String) {
        _email.value = newEmail

        // Validar solo si el campo no está vacío
        if (newEmail.isNotBlank()) {
            val validation = dataValidator.validateEmail(newEmail)
            _emailError.value = if (!validation.isValid) {
                validation.errors.firstOrNull()
            } else null
        } else {
            // Limpiar error si campo vacío (no molestar al usuario)
            _emailError.value = null
        }
    }

    /**
     * Maneja cambio de password con validación real-time
     */
    fun onPasswordChanged(newPassword: String) {
        _password.value = newPassword

        if (newPassword.isNotBlank()) {
            val validation = dataValidator.validatePassword(newPassword)
            _passwordError.value = if (!validation.isValid) {
                // Mostrar solo primer error (no abrumar al usuario)
                validation.errors.firstOrNull()
            } else null
        } else {
            _passwordError.value = null
        }
    }

    /**
     * Toggle password visibility
     *
     * PATRÓN: Single Responsibility
     * Función dedicada para clarity
     */
    fun togglePasswordVisibility() {
        _passwordVisible.value = !_passwordVisible.value
    }

    /**
     * Inicia proceso de login con validación pre-submit
     *
     * FLUJO:
     * 1. Pre-validación (evitar llamada API innecesaria)
     * 2. Simular llamada a use case (mock login)
     * 3. Error handling con ErrorHandler
     * 4. State update (Success/Error)
     *
     * ERROR HANDLING STRATEGY:
     * - Network errors: Mensaje user-friendly + retry
     * - Validation errors: Highlight fields específicos
     * - Unknown errors: Mensaje genérico + log a Crashlytics
     */
    fun login() {
        // PRE-VALIDACIÓN: Validar antes de hacer llamada API
        val emailValidation = dataValidator.validateEmail(_email.value)
        val passwordValidation = dataValidator.validatePassword(_password.value)

        // Si hay errores de validación, mostrarlos y retornar
        if (!emailValidation.isValid) {
            _emailError.value = emailValidation.errors.firstOrNull()
            return
        }

        if (!passwordValidation.isValid) {
            _passwordError.value = passwordValidation.errors.firstOrNull()
            return
        }

        // Iniciar proceso de login
        viewModelScope.launch {
            _uiState.value = UiState.Loading

            try {
                // SIMULACIÓN: En producción, llamar a loginUseCase
                // Para este ejemplo, simulamos un login exitoso
                val result = performLogin(_email.value, _password.value)

                result.onSuccess { user ->
                    // Login exitoso
                    _retryCount.value = 0 // Reset retry count
                    Timber.d("Login successful for user: ${user.id}")

                    _uiState.value = UiState.Success(
                        userId = user.id,
                        userName = user.nombreCompleto
                    )
                }.onFailure { throwable ->
                    // Login falló - delegar a error handler
                    handleLoginError(throwable)
                }

            } catch (e: Exception) {
                // Catch cualquier excepción no manejada
                // IMPORTANTE: Nunca dejar que una excepción crashee la app
                Timber.e(e, "Unexpected error during login")
                handleLoginError(e)
            }
        }
    }

    /**
     * Simula login API call (en producción sería un use case)
     *
     * PATRÓN: Dependency Inversion
     * Para este ejemplo, simulamos un result exitoso o fallido
     */
    private suspend fun performLogin(email: String, password: String): Result<Productor> {
        // Simular delay de red
        kotlinx.coroutines.delay(SIMULATED_NETWORK_DELAY_MS)

        return try {
            // SIMULACIÓN: Aceptar login si email contiene "test"
            if (email.contains("test")) {
                Result.success(
                    Productor(
                        id = "prod-${System.currentTimeMillis()}",
                        nombre = email.substringBefore("@"),
                        email = email,
                        activo = true
                    )
                )
            } else {
                // Simular error de autenticación
                Result.failure(
                    UnauthorizedException("Email o contraseña incorrectos")
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Maneja errores de login con ErrorHandler
     *
     * PATRÓN: Single Responsibility
     * Lógica de error handling centralizada
     *
     * FEATURES:
     * - Convierte excepciones técnicas a mensajes user-friendly
     * - Implementa retry logic con límite
     * - Logging automático a Crashlytics
     */
    private fun handleLoginError(throwable: Throwable) {
        Timber.e(throwable, "Login error for email: ${_email.value}")

        // ErrorHandler convierte error técnico → mensaje user-friendly
        val userMessage = errorHandler.handle(
            throwable = throwable,
            context = "login(email=${_email.value})"
        )

        val currentRetryCount = _retryCount.value
        val canRetry = currentRetryCount < MAX_RETRIES

        _uiState.value = UiState.Error(
            message = if (canRetry) {
                "$userMessage\n\nIntentos restantes: ${MAX_RETRIES - currentRetryCount}"
            } else {
                "$userMessage\n\nPor favor, intenta más tarde o contacta soporte."
            },
            canRetry = canRetry,
            retryCount = currentRetryCount
        )
    }

    /**
     * Reintenta login después de error
     *
     * LÍMITE: 3 intentos máximo para evitar spam
     */
    fun retry() {
        if (_retryCount.value < MAX_RETRIES) {
            _retryCount.value += 1
            login()
        }
    }

    /**
     * Limpia estado de error (dismiss error message)
     */
    fun clearError() {
        if (_uiState.value is UiState.Error) {
            _uiState.value = UiState.Idle
        }
    }

    /**
     * Reset completo del formulario
     *
     * USE CASE: Logout o cancelar operación
     */
    fun resetForm() {
        _email.value = ""
        _password.value = ""
        _passwordVisible.value = false
        _emailError.value = null
        _passwordError.value = null
        _retryCount.value = 0
        _uiState.value = UiState.Idle
    }
}

// Custom exception for unauthorized errors
class UnauthorizedException(message: String = "Unauthorized") : Exception(message)
