package com.agrobridge.data.dto

import com.google.gson.annotations.SerializedName

/**
 * Respuesta genérica de la API
 * Wrapper para todas las respuestas del backend
 */
sealed class ApiResponse<out T> {
    /**
     * Respuesta exitosa con datos
     */
    data class Success<T>(val data: T) : ApiResponse<T>()

    /**
     * Error de la API con mensaje
     */
    data class Error(
        val code: Int,
        val message: String,
        val details: String? = null
    ) : ApiResponse<Nothing>()

    /**
     * Cargando
     */
    object Loading : ApiResponse<Nothing>()

    /**
     * Mapear la respuesta a otro tipo
     */
    fun <R> map(transform: (T) -> R): ApiResponse<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> this
        Loading -> Loading
    }

    /**
     * Ejecutar acción solo si es Success
     */
    inline fun onSuccess(action: (T) -> Unit): ApiResponse<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Ejecutar acción solo si es Error
     */
    inline fun onError(action: (Error) -> Unit): ApiResponse<T> {
        if (this is Error) action(this)
        return this
    }

    /**
     * Obtener datos o null
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Obtener datos o default
     */
    fun getOrDefault(default: T): T = when (this) {
        is Success -> data
        else -> default
    }

    companion object {
        /**
         * Crear Success desde datos
         */
        fun <T> success(data: T) = Success(data)

        /**
         * Crear Error desde excepción
         */
        fun error(code: Int, message: String, details: String? = null) =
            Error(code, message, details)

        /**
         * Estado de carga
         */
        fun loading() = Loading
    }
}

/**
 * Respuesta de lista paginada
 */
data class PaginatedResponse<T>(
    @SerializedName("data")
    val data: List<T>,

    @SerializedName("page")
    val page: Int,

    @SerializedName("pageSize")
    val pageSize: Int,

    @SerializedName("total")
    val total: Int,

    @SerializedName("hasMore")
    val hasMore: Boolean
) {
    /**
     * Total de páginas
     */
    val totalPages: Int
        get() = (total + pageSize - 1) / pageSize

    /**
     * Verificar si hay página siguiente
     */
    val hasNextPage: Boolean
        get() = hasMore && page < totalPages

    /**
     * Verificar si hay página anterior
     */
    val hasPreviousPage: Boolean
        get() = page > 1
}

/**
 * Respuesta de operación simple
 */
data class OperationResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("message")
    val message: String,

    @SerializedName("data")
    val data: Any? = null
)

/**
 * Respuesta de error del servidor
 */
data class ErrorResponse(
    @SerializedName("error")
    val error: String,

    @SerializedName("message")
    val message: String,

    @SerializedName("statusCode")
    val statusCode: Int,

    @SerializedName("timestamp")
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Metadata de la respuesta
 */
data class ResponseMetadata(
    @SerializedName("requestId")
    val requestId: String?,

    @SerializedName("timestamp")
    val timestamp: Long,

    @SerializedName("version")
    val version: String?
)
