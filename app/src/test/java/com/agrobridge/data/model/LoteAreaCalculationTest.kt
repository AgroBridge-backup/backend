package com.agrobridge.data.model

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Tests for Lote.areaCalculada property
 * Validates geodetic area calculation with proper Earth radius projection
 *
 * Bug Fix: HIGH-1
 * Issue: Previous hardcoded 111,320 m/degree only worked at equator
 * Solution: Use proper Earth radius projection with cos(latitude) adjustment
 */
class LoteAreaCalculationTest {

    private val mockProductor = Productor(
        id = "prod-001",
        nombreCompleto = "Test Producer",
        email = "test@agrobridge.com"
    )

    @Test
    fun areaCalculada_returns_null_when_coordenadas_is_null() {
        val lote = Lote(
            id = "test-1",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = null
        )

        assertThat(lote.areaCalculada).isNull()
    }

    @Test
    fun areaCalculada_returns_null_when_coordenadas_is_empty() {
        val lote = Lote(
            id = "test-2",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = emptyList()
        )

        assertThat(lote.areaCalculada).isNull()
    }

    @Test
    fun areaCalculada_returns_null_when_fewer_than_3_coordinates() {
        val lote = Lote(
            id = "test-3",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0)
            )
        )

        assertThat(lote.areaCalculada).isNull()
    }

    @Test
    fun areaCalculada_returns_null_for_collinear_points() {
        // All points on a line = no area
        val lote = Lote(
            id = "test-4",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 0.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.2, -100.0)  // All same longitude
            )
        )

        assertThat(lote.areaCalculada).isNull()
    }

    @Test
    fun areaCalculada_calculates_area_for_valid_polygon() {
        // Simple square polygon near Michoacán, Mexico (20°N latitude)
        // Approximate coordinates for a ~100m × 100m square
        val lote = Lote(
            id = "test-5",
            nombre = "Test Square",
            cultivo = "Aguacate",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.001, -100.0),      // ~111m north
                Coordenada(20.001, -100.001),    // ~93m east at 20°N (due to cos(lat))
                Coordenada(20.0, -100.001)       // ~93m east
            )
        )

        val area = lote.areaCalculada
        assertThat(area).isNotNull()
        // Should be roughly 1 hectare (10,000m²), with tolerance for projection differences
        // Actual might be 0.8-1.2 hectares due to Cartesian approximation
        assertThat(area).isGreaterThan(0.5)
        assertThat(area).isLessThan(2.0)
    }

    @Test
    fun areaCalculada_uses_geodetic_projection_not_equatorial() {
        // Test at high latitude (50°N) to verify cos(latitude) adjustment
        // At 50°N, cos(50°) ≈ 0.643, so longitude distance is much less
        val highLatLote = Lote(
            id = "test-6",
            nombre = "High Latitude Test",
            cultivo = "Papa",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(50.0, -5.0),
                Coordenada(50.001, -5.0),
                Coordenada(50.001, -5.001),
                Coordenada(50.0, -5.001)
            )
        )

        // Equatorial version of same shape
        val equatorLote = Lote(
            id = "test-7",
            nombre = "Equator Test",
            cultivo = "Papa",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(0.0, 0.0),
                Coordenada(0.001, 0.0),
                Coordenada(0.001, 0.001),
                Coordenada(0.0, 0.001)
            )
        )

        val highLatArea = highLatLote.areaCalculada
        val equatorArea = equatorLote.areaCalculada

        assertThat(highLatArea).isNotNull()
        assertThat(equatorArea).isNotNull()

        // High latitude area should be less than equator area for same degree-based coordinates
        // because cos(50°) < cos(0°)
        assertThat(highLatArea).isLessThan(equatorArea!!)
    }

    @Test
    fun hasValidGPS_returns_true_for_polygon_with_3_plus_coordinates() {
        val lote = Lote(
            id = "test-8",
            nombre = "Valid GPS",
            cultivo = "Tomate",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.05, -100.1)
            )
        )

        assertThat(lote.hasValidGPS).isTrue()
    }

    @Test
    fun hasValidGPS_returns_false_for_less_than_3_coordinates() {
        val lote = Lote(
            id = "test-9",
            nombre = "Invalid GPS",
            cultivo = "Tomate",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0)
            )
        )

        assertThat(lote.hasValidGPS).isFalse()
    }

    @Test
    fun hasValidGPS_returns_false_when_coordenadas_is_null() {
        val lote = Lote(
            id = "test-10",
            nombre = "No GPS",
            cultivo = "Tomate",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = null
        )

        assertThat(lote.hasValidGPS).isFalse()
    }
}
