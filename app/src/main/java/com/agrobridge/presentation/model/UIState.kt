package com.agrobridge.presentation.model

/**
 * Estado genérico de UI
 * Usado para representar el estado de cualquier operación async en la UI
 */
sealed class UIState<out T> {
    /**
     * Estado inicial/idle
     */
    object Idle : UIState<Nothing>()

    /**
     * Cargando datos
     */
    data class Loading(
        val message: String? = null,
        val progress: Float? = null // 0.0 a 1.0
    ) : UIState<Nothing>()

    /**
     * Datos cargados exitosamente
     */
    data class Success<T>(
        val data: T,
        val message: String? = null
    ) : UIState<T>()

    /**
     * Error al cargar
     */
    data class Error(
        val error: Throwable,
        val message: String = error.message ?: "Error desconocido",
        val code: Int? = null
    ) : UIState<Nothing>()

    /**
     * Datos vacíos (success pero sin datos)
     */
    data class Empty(
        val message: String = "No hay datos disponibles"
    ) : UIState<Nothing>()

    // ========================================================================
    // Helper functions
    // ========================================================================

    /**
     * ¿Es loading?
     */
    fun isLoading() = this is Loading

    /**
     * ¿Es success?
     */
    fun isSuccess() = this is Success

    /**
     * ¿Es error?
     */
    fun isError() = this is Error

    /**
     * ¿Es empty?
     */
    fun isEmpty() = this is Empty

    /**
     * ¿Es idle?
     */
    fun isIdle() = this is Idle

    /**
     * Obtener datos o null
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Mapear datos
     */
    fun <R> map(transform: (T) -> R): UIState<R> = when (this) {
        is Success -> Success(transform(data), message)
        is Loading -> this
        is Error -> this
        is Empty -> this
        Idle -> Idle
    }

    /**
     * Ejecutar acción en success
     */
    inline fun onSuccess(action: (T) -> Unit): UIState<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Ejecutar acción en error
     */
    inline fun onError(action: (Error) -> Unit): UIState<T> {
        if (this is Error) action(this)
        return this
    }

    /**
     * Ejecutar acción en loading
     */
    inline fun onLoading(action: (Loading) -> Unit): UIState<T> {
        if (this is Loading) action(this)
        return this
    }

    companion object {
        /**
         * Crear estado de carga
         */
        fun loading(message: String? = null, progress: Float? = null) =
            Loading(message, progress)

        /**
         * Crear estado de éxito
         */
        fun <T> success(data: T, message: String? = null) =
            Success(data, message)

        /**
         * Crear estado de error
         */
        fun error(error: Throwable, message: String? = null, code: Int? = null) =
            Error(error, message ?: error.message ?: "Error desconocido", code)

        /**
         * Crear estado vacío
         */
        fun empty(message: String = "No hay datos disponibles") =
            Empty(message)

        /**
         * Estado inicial
         */
        fun idle() = Idle
    }
}

/**
 * Estado de operación (crear, actualizar, eliminar)
 */
sealed class OperationState {
    /**
     * Idle (no hay operación en curso)
     */
    object Idle : OperationState()

    /**
     * Procesando operación
     */
    data class Processing(val message: String? = null) : OperationState()

    /**
     * Operación exitosa
     */
    data class Success(val message: String) : OperationState()

    /**
     * Operación fallida
     */
    data class Failure(val error: String) : OperationState()

    fun isProcessing() = this is Processing
    fun isSuccess() = this is Success
    fun isFailure() = this is Failure
}

/**
 * Estado de lista
 */
sealed class ListState<out T> {
    /**
     * Cargando primera página
     */
    object InitialLoading : ListState<Nothing>()

    /**
     * Cargando más items (paginación)
     */
    object LoadingMore : ListState<Nothing>()

    /**
     * Refrescando datos
     */
    object Refreshing : ListState<Nothing>()

    /**
     * Lista cargada
     */
    data class Success<T>(
        val items: List<T>,
        val hasMore: Boolean = false,
        val page: Int = 1
    ) : ListState<T>()

    /**
     * Error
     */
    data class Error(
        val error: Throwable,
        val message: String = error.message ?: "Error al cargar"
    ) : ListState<Nothing>()

    /**
     * Lista vacía
     */
    data class Empty(
        val message: String = "No hay items"
    ) : ListState<Nothing>()

    fun isLoading() = this is InitialLoading || this is LoadingMore || this is Refreshing
    fun isSuccess() = this is Success
    fun isEmpty() = this is Empty
    fun isError() = this is Error
    fun hasMore() = (this as? Success)?.hasMore == true
}

/**
 * Estado de validación de formulario
 */
data class FormFieldState(
    val value: String = "",
    val error: String? = null,
    val isValid: Boolean = true
) {
    /**
     * ¿Tiene error?
     */
    fun hasError() = error != null

    /**
     * ¿Está vacío?
     */
    fun isEmpty() = value.isBlank()

    /**
     * Actualizar valor
     */
    fun updateValue(newValue: String) = copy(value = newValue, error = null)

    /**
     * Actualizar error
     */
    fun updateError(newError: String?) = copy(error = newError, isValid = newError == null)
}

/**
 * Estado de autenticación
 */
sealed class AuthState {
    /**
     * Verificando autenticación
     */
    object Checking : AuthState()

    /**
     * Autenticado
     */
    data class Authenticated(val userId: String, val displayName: String) : AuthState()

    /**
     * No autenticado
     */
    object Unauthenticated : AuthState()

    /**
     * Error de autenticación
     */
    data class Error(val message: String) : AuthState()

    fun isAuthenticated() = this is Authenticated
    fun isChecking() = this is Checking
}
