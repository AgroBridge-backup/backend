package com.agrobridge.data.remote

import com.agrobridge.data.dto.CreateLoteRequest
import com.agrobridge.data.dto.LoteDto
import com.agrobridge.data.dto.PaginatedResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Servicio de API para comunicación con el backend
 * Define todos los endpoints disponibles
 */
interface ApiService {

    /**
     * Obtener lista de lotes del productor
     *
     * @param productorId ID del productor
     * @param page Número de página (por defecto 1)
     * @param pageSize Tamaño de página (por defecto 20)
     * @return Respuesta paginada con lista de lotes
     */
    @GET("productores/{productorId}/lotes")
    suspend fun getLotes(
        @Path("productorId") productorId: String,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20
    ): Response<PaginatedResponse<LoteDto>>

    /**
     * Obtener detalles de un lote específico
     *
     * @param loteId ID del lote
     * @return Respuesta con detalles del lote
     */
    @GET("lotes/{loteId}")
    suspend fun getLoteDetail(
        @Path("loteId") loteId: String
    ): Response<LoteDto>

    /**
     * Obtener lotes activos (filtro común)
     *
     * @param productorId ID del productor
     * @return Respuesta con lista de lotes activos
     */
    @GET("productores/{productorId}/lotes")
    suspend fun getActiveLotes(
        @Path("productorId") productorId: String,
        @Query("estado") estado: String = "ACTIVO"
    ): Response<PaginatedResponse<LoteDto>>

    /**
     * Crear un nuevo lote
     *
     * @param request Datos del lote a crear
     * @return Respuesta con el lote creado (incluye ID del servidor)
     */
    @POST("lotes")
    suspend fun createLote(
        @Body request: CreateLoteRequest
    ): Response<LoteDto>

    /**
     * Actualizar un lote existente
     *
     * @param loteId ID del lote a actualizar
     * @param request Datos actualizados del lote
     * @return Respuesta con el lote actualizado
     */
    @PUT("lotes/{loteId}")
    suspend fun updateLote(
        @Path("loteId") loteId: String,
        @Body request: CreateLoteRequest
    ): Response<LoteDto>

    /**
     * Eliminar un lote
     *
     * @param loteId ID del lote a eliminar
     * @return Respuesta de confirmación
     */
    @DELETE("lotes/{loteId}")
    suspend fun deleteLote(
        @Path("loteId") loteId: String
    ): Response<Unit>

    /**
     * Obtener información del clima para coordenadas
     *
     * @param latitude Latitud
     * @param longitude Longitud
     * @return Respuesta con datos del clima
     */
    @GET("weather/current")
    suspend fun getWeather(
        @Query("lat") latitude: Double,
        @Query("lon") longitude: Double
    ): Response<WeatherDto>
}

/**
 * DTO para datos del clima
 */
data class WeatherDto(
    val temperature: Double,
    val humidity: Int,
    val condition: String,
    val windSpeed: Double,
    val precipitation: Double? = null,
    val uvIndex: Double? = null,
    val timestamp: Long = System.currentTimeMillis()
)
