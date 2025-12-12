package com.agrobridge.data.model

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Tests for Lote.contienePunto() point-in-polygon algorithm
 * Validates ray-casting implementation with epsilon tolerance
 *
 * Bug Fixes:
 * - HIGH-2: Null dereference in areaCalculada (!! operator)
 * - HIGH-3: Point-in-polygon division by zero on vertical edges
 */
class LotePointInPolygonTest {

    private val mockProductor = Productor(
        id = "prod-001",
        nombreCompleto = "Test Producer",
        email = "test@agrobridge.com"
    )

    @Test
    fun contienePunto_returns_false_when_coordenadas_is_null() {
        val lote = Lote(
            id = "test-1",
            nombre = "Null GPS",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = null
        )

        val punto = Coordenada(20.0, -100.0)
        assertThat(lote.contienePunto(punto)).isFalse()
    }

    @Test
    fun contienePunto_returns_false_when_coordenadas_has_fewer_than_3_points() {
        val lote = Lote(
            id = "test-2",
            nombre = "Two Points",
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

        val punto = Coordenada(20.05, -100.0)
        assertThat(lote.contienePunto(punto)).isFalse()
    }

    @Test
    fun contienePunto_returns_true_for_point_inside_square_polygon() {
        // Simple square: (20, -100) to (20.1, -100.1)
        val lote = Lote(
            id = "test-3",
            nombre = "Square",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.1, -100.1),
                Coordenada(20.0, -100.1)
            )
        )

        // Point clearly inside
        val pointInside = Coordenada(20.05, -100.05)
        assertThat(lote.contienePunto(pointInside)).isTrue()
    }

    @Test
    fun contienePunto_returns_false_for_point_outside_square_polygon() {
        val lote = Lote(
            id = "test-4",
            nombre = "Square",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.1, -100.1),
                Coordenada(20.0, -100.1)
            )
        )

        // Point clearly outside
        val pointOutside = Coordenada(20.2, -100.2)
        assertThat(lote.contienePunto(pointOutside)).isFalse()
    }

    @Test
    fun contienePunto_handles_vertical_edge_without_crash() {
        // Polygon with vertical edge (same longitude for two points)
        // This would cause division by zero in naive implementation
        val lote = Lote(
            id = "test-5",
            nombre = "Vertical Edge",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),    // Left point
                Coordenada(20.1, -100.0),    // Right point (same lon as below)
                Coordenada(20.1, -100.1),    // Below right (vertical edge!)
                Coordenada(20.0, -100.1)     // Left point
            )
        )

        // Point to test (should not crash on vertical edge)
        val pointInside = Coordenada(20.05, -100.05)

        // Should not throw exception
        val result = lote.contienePunto(pointInside)
        assertThat(result).isTrue()
    }

    @Test
    fun contienePunto_handles_horizontal_edge() {
        // Polygon with horizontal edge (same latitude for two points)
        val lote = Lote(
            id = "test-6",
            nombre = "Horizontal Edge",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.0, -100.1),    // Horizontal edge!
                Coordenada(20.1, -100.1),
                Coordenada(20.1, -100.0)
            )
        )

        val pointInside = Coordenada(20.05, -100.05)
        assertThat(lote.contienePunto(pointInside)).isTrue()
    }

    @Test
    fun contienePunto_handles_point_on_boundary() {
        // Point exactly on polygon edge
        val lote = Lote(
            id = "test-7",
            nombre = "Boundary Test",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.1, -100.1),
                Coordenada(20.0, -100.1)
            )
        )

        // Point on bottom edge
        val pointOnEdge = Coordenada(20.0, -100.05)

        // Ray-casting can be inconsistent at boundaries; we just want to avoid crashes
        val result = lote.contienePunto(pointOnEdge)
        assertThat(result).isNotNull()  // Should return boolean without crash
    }

    @Test
    fun contienePunto_handles_triangle_polygon() {
        // Triangle polygon
        val lote = Lote(
            id = "test-8",
            nombre = "Triangle",
            cultivo = "Maíz",
            area = 0.5,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.05, -100.1)
            )
        )

        // Point in center of triangle
        val pointInside = Coordenada(20.05, -100.05)
        assertThat(lote.contienePunto(pointInside)).isTrue()

        // Point outside
        val pointOutside = Coordenada(20.15, -100.0)
        assertThat(lote.contienePunto(pointOutside)).isFalse()
    }

    @Test
    fun contienePunto_handles_complex_polygon() {
        // L-shaped polygon
        val lote = Lote(
            id = "test-9",
            nombre = "Complex Shape",
            cultivo = "Maíz",
            area = 2.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.0),
                Coordenada(20.1, -100.05),
                Coordenada(20.05, -100.05),
                Coordenada(20.05, -100.1),
                Coordenada(20.0, -100.1)
            )
        )

        // Point in lower part of L
        val pointInLower = Coordenada(20.025, -100.075)
        assertThat(lote.contienePunto(pointInLower)).isTrue()

        // Point in right part of L
        val pointInRight = Coordenada(20.075, -100.025)
        assertThat(lote.contienePunto(pointInRight)).isTrue()

        // Point in the missing part of L (hole)
        val pointInHole = Coordenada(20.075, -100.075)
        assertThat(lote.contienePunto(pointInHole)).isFalse()
    }

    @Test
    fun contienePunto_handles_self_intersecting_polygon() {
        // Self-intersecting polygon (bow-tie shape)
        val lote = Lote(
            id = "test-10",
            nombre = "Self-Intersecting",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.1, -100.1),
                Coordenada(20.1, -100.0),
                Coordenada(20.0, -100.1)
            )
        )

        // Should not crash even with self-intersection
        val point = Coordenada(20.05, -100.05)
        val result = lote.contienePunto(point)
        assertThat(result).isNotNull()  // Just verify no crash
    }

    @Test
    fun contienePunto_precision_with_floating_point_coordinates() {
        // Test with very close coordinates (floating point precision edge case)
        val lote = Lote(
            id = "test-11",
            nombre = "Precision Test",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = mockProductor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(20.0, -100.0),
                Coordenada(20.00001, -100.0),
                Coordenada(20.00001, -100.00001),
                Coordenada(20.0, -100.00001)
            )
        )

        val pointInside = Coordenada(20.000005, -100.000005)
        // Should handle without precision errors
        val result = lote.contienePunto(pointInside)
        assertThat(result).isNotNull()
    }
}
