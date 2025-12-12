package com.agrobridge.data.mapper

import com.agrobridge.data.local.entity.LoteEntity
import com.agrobridge.data.model.Coordenada
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * LoteEntityMapperTest - Tests para conversión Lote (Domain) → LoteEntity
 *
 * FIXED: HIGH-13 - Undefined Mapper Methods
 * Issue: Missing Lote.toEntity() mapper causing compilation errors
 * Solution: Implemented domain-to-entity mapper with proper serialization
 *
 * COVERAGE TARGET: 100%
 * TESTS: 5 (critical path coverage)
 * FOCUS: Domain model to entity conversion, coordinate serialization, null handling
 */
class LoteEntityMapperTest {

    // ═══════════════════════════════════════════════════════════
    // DOMAIN → ENTITY CONVERSION
    // ═══════════════════════════════════════════════════════════

    @Test
    fun lote_toEntity_converts_all_fields_correctly() {
        // Arrange
        val productor = Productor(
            id = "prod-123",
            nombre = "Juan Pérez",
            apellido = "García",
            email = "juan@agrobridge.mx",
            telefono = "+5215551234567",
            direccion = "Calle Principal 123",
            ciudad = "Monterrey",
            estado = "Nuevo León",
            codigoPostal = "64000",
            pais = "México",
            certificaciones = listOf("Orgánico"),
            activo = true,
            fechaRegistro = System.currentTimeMillis()
        )

        val lote = Lote(
            id = "lote-abc-001",
            nombre = "Parcela Centro",
            cultivo = "Maíz",
            area = 150.5,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(25.6866, -100.3161),
                Coordenada(25.6870, -100.3165)
            ),
            centroCampo = Coordenada(25.6868, -100.3163),
            ubicacion = "Monterrey, NL",
            bloqueId = "bloque-1",
            bloqueNombre = "Bloque A"
        )

        // Act
        val entity = lote.toEntity()

        // Assert
        assertThat(entity.id).isEqualTo("lote-abc-001")
        assertThat(entity.nombre).isEqualTo("Parcela Centro")
        assertThat(entity.cultivo).isEqualTo("Maíz")
        assertThat(entity.area).isEqualTo(150.5)
        assertThat(entity.estado).isEqualTo("ACTIVO")
        assertThat(entity.productorId).isEqualTo("prod-123")
        assertThat(entity.productorNombre).isEqualTo("Juan Pérez")
        assertThat(entity.coordenadas).isNotNull()
        assertThat(entity.centroCampoLatitud).isEqualTo(25.6868)
        assertThat(entity.centroCampoLongitud).isEqualTo(-100.3163)
        assertThat(entity.ubicacion).isEqualTo("Monterrey, NL")
        assertThat(entity.bloqueId).isEqualTo("bloque-1")
        assertThat(entity.bloqueNombre).isEqualTo("Bloque A")
    }

    @Test
    fun lote_toEntity_serializes_coordenadas_as_json() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-coords-001",
            nombre = "Lote con Coordenadas",
            cultivo = "Trigo",
            area = 75.0,
            estado = LoteEstado.EN_PREPARACION,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = listOf(
                Coordenada(25.5, -100.0),
                Coordenada(25.6, -100.1),
                Coordenada(25.7, -100.2)
            )
        )

        // Act
        val entity = lote.toEntity()

        // Assert - coordenadas should be serialized as JSON string, not null
        assertThat(entity.coordenadas).isNotNull()
        assertThat(entity.coordenadas).contains("25.5") // Should contain latitude values
        assertThat(entity.coordenadas).contains("-100") // Should contain longitude values
    }

    @Test
    fun lote_toEntity_handles_null_coordenadas() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-no-coords",
            nombre = "Lote sin Coordenadas",
            cultivo = "Arroz",
            area = 200.0,
            estado = LoteEstado.INACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis(),
            coordenadas = null // No coordinates
        )

        // Act
        val entity = lote.toEntity()

        // Assert
        assertThat(entity.coordenadas).isNull()
        assertThat(entity.centroCampoLatitud).isNull()
        assertThat(entity.centroCampoLongitud).isNull()
    }

    @Test
    fun lote_toEntity_converts_estado_enum_to_string() {
        // Arrange
        val productor = Productor.mock()
        val estados = listOf(
            LoteEstado.ACTIVO to "ACTIVO",
            LoteEstado.INACTIVO to "INACTIVO",
            LoteEstado.EN_COSECHA to "EN_COSECHA",
            LoteEstado.COSECHADO to "COSECHADO",
            LoteEstado.EN_PREPARACION to "EN_PREPARACION"
        )

        // Act & Assert
        for ((estado, expectedString) in estados) {
            val lote = Lote(
                id = "lote-${estado.name}",
                nombre = "Test Lote",
                cultivo = "Test",
                area = 100.0,
                estado = estado,
                productor = productor,
                fechaCreacion = System.currentTimeMillis()
            )

            val entity = lote.toEntity()
            assertThat(entity.estado).isEqualTo(expectedString)
        }
    }

    @Test
    fun lote_toEntity_sets_sync_timestamps() {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-timestamps",
            nombre = "Lote para Tests de Timestamp",
            cultivo = "Café",
            area = 50.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis()
        )

        // Act
        val entity = lote.toEntity()

        // Assert
        assertThat(entity.fechaActualizacion).isGreaterThan(0)
        assertThat(entity.localSyncTimestamp).isGreaterThan(0)
        assertThat(entity.localSyncTimestamp).isAtMost(System.currentTimeMillis())
    }
}
