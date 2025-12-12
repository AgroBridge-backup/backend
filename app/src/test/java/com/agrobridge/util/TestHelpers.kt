package com.agrobridge.util

// ═══════════════════════════════════════════════════════════════════
// AGROBRIDGE ANDROID - TEST INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════
// Author:  Alejandro Navarro Ayala
// Role:    CEO & Senior Developer
// Email:   ceo@agrobridge.mx
// Company: AgroBridge International
// Date:    November 29, 2025
// Purpose: Factory methods for deterministic test object creation
// Coverage: N/A
// ═══════════════════════════════════════════════════════════════════

import com.agrobridge.data.dto.*
import com.agrobridge.data.model.*
import java.util.*

/**
 * TestHelpers - Factory methods para objetos de prueba
 *
 * USAGE:
 * val lote = TestHelpers.createMockLote(nombre = "Custom Name")
 *
 * BENEFITS:
 * - Reduce boilerplate en tests
 * - Centraliza datos de prueba
 * - Facilita mantenimiento
 */
object TestHelpers {

    // ═══════════════════════════════════════════════════════════
    // DOMAIN MODELS
    // ═══════════════════════════════════════════════════════════

    fun createMockLote(
        id: String = UUID.randomUUID().toString(),
        nombre: String = "Lote Test ${System.currentTimeMillis().toString().takeLast(4)}",
        cultivo: String = "Maíz",
        area: Double = 100.0,
        estado: LoteEstado = LoteEstado.ACTIVO,
        productorId: String = "prod-test-123"
    ): Lote {
        return Lote(
            id = id,
            nombre = nombre,
            cultivo = cultivo,
            area = area,
            estado = estado,
            productor = createMockProductor(id = productorId),
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = emptyList(),
            centroCampo = null,
            ubicacion = null,
            bloqueId = null,
            bloqueNombre = null
        )
    }

    fun createMockLotes(count: Int): List<Lote> {
        return (1..count).map { index ->
            createMockLote(
                id = "lote-$index",
                nombre = "Lote $index",
                area = (50.0 + index * 10)
            )
        }
    }

    fun createMockProductor(
        id: String = "prod-test-123",
        nombre: String = "Productor Test"
    ): Productor {
        return Productor(id = id, nombre = nombre)
    }

    // ═══════════════════════════════════════════════════════════
    // DTOs
    // ═══════════════════════════════════════════════════════════

    fun createMockLoteDto(
        id: String = UUID.randomUUID().toString(),
        nombre: String = "Lote DTO Test"
    ): LoteDto {
        return LoteDto(
            id = id,
            nombre = nombre,
            cultivo = "Maíz",
            superficie = 100.0,
            estado = "activo",
            productorId = "prod-123",
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = emptyList(),
            centroCampo = null,
            ubicacion = null,
            bloqueId = null,
            bloqueNombre = null
        )
    }

    fun createMockTokenResponse(
        accessToken: String = "mock_jwt_token_${System.currentTimeMillis()}",
        refreshToken: String = "mock_refresh_${System.currentTimeMillis()}"
    ): TokenResponse {
        return TokenResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            tokenType = "Bearer",
            expiresIn = 3600L,
            user = UserDto(
                id = "user-test-123",
                email = "test@agrobridge.com",
                firstName = "Test",
                lastName = "User",
                role = "productor"
            )
        )
    }

    fun <T> createMockPaginatedResponse(
        data: List<T>,
        page: Int = 1,
        pageSize: Int = 20,
        total: Int = data.size,
        hasMore: Boolean = false
    ): PaginatedResponse<T> {
        return PaginatedResponse(
            data = data,
            page = page,
            pageSize = pageSize,
            total = total,
            hasMore = hasMore
        )
    }

    // ═══════════════════════════════════════════════════════════
    // TIME HELPERS
    // ═══════════════════════════════════════════════════════════

    fun nowInSeconds(): Long = System.currentTimeMillis() / 1000

    fun futureInSeconds(minutesFromNow: Int): Long {
        return nowInSeconds() + (minutesFromNow * 60)
    }

    fun pastInSeconds(minutesAgo: Int): Long {
        return nowInSeconds() - (minutesAgo * 60)
    }
}
