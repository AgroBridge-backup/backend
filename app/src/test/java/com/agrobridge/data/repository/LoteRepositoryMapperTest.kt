package com.agrobridge.data.repository

import com.agrobridge.data.local.dao.LoteDao
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.agrobridge.data.remote.ApiService
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test

/**
 * LoteRepositoryMapperTest - Tests para crear/editar lotes con mapeo correcto
 *
 * FIXED: HIGH-13 - Undefined Mapper Methods
 * Tests que verifican que createLote() y updateLote() usan correctamente
 * el nuevo mapper Lote.toEntity() para convertir modelos de dominio a entidades
 *
 * COVERAGE TARGET: 100% of mapper integration points
 * TESTS: 2 (critical: create and update paths)
 * FOCUS: Mapper correctness, sync status setting, database persistence
 */
class LoteRepositoryMapperTest {

    private lateinit var apiService: ApiService
    private lateinit var loteDao: LoteDao
    private lateinit var workManager: androidx.work.WorkManager
    private lateinit var repository: LoteRepositoryImpl

    @Before
    fun setup() {
        apiService = mockk()
        loteDao = mockk(relaxed = true)
        workManager = mockk(relaxed = true)
        repository = LoteRepositoryImpl(apiService, loteDao, workManager)
    }

    @Test
    fun createLote_uses_mapper_to_convert_domain_to_entity() = runTest {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-create-001",
            nombre = "Nueva Parcela",
            cultivo = "Maíz",
            area = 100.0,
            estado = LoteEstado.ACTIVO,
            productor = productor,
            fechaCreacion = System.currentTimeMillis()
        )

        val loteDaoSlot = slot<com.agrobridge.data.local.entity.LoteEntity>()
        coEvery { loteDao.saveLocal(capture(loteDaoSlot)) } returns Unit

        // Act
        val result = repository.createLote(lote)

        // Assert
        assertThat(result.isSuccess).isTrue()
        verify(exactly = 1) { loteDao.saveLocal(any()) }

        // Verify the entity was properly converted from domain model
        val savedEntity = loteDaoSlot.captured
        assertThat(savedEntity.id).isEqualTo("lote-create-001")
        assertThat(savedEntity.nombre).isEqualTo("Nueva Parcela")
        assertThat(savedEntity.cultivo).isEqualTo("Maíz")
        assertThat(savedEntity.area).isEqualTo(100.0)
        assertThat(savedEntity.estado).isEqualTo("ACTIVO")
        assertThat(savedEntity.productorId).isEqualTo(productor.id)
    }

    @Test
    fun updateLote_uses_mapper_to_convert_domain_to_entity() = runTest {
        // Arrange
        val productor = Productor.mock()
        val lote = Lote(
            id = "lote-update-orig",
            nombre = "Parcela Actualizada",
            cultivo = "Trigo",
            area = 150.0,
            estado = LoteEstado.EN_COSECHA,
            productor = productor,
            fechaCreacion = System.currentTimeMillis()
        )

        val loteDaoSlot = slot<com.agrobridge.data.local.entity.LoteEntity>()
        coEvery { loteDao.saveLocal(capture(loteDaoSlot)) } returns Unit

        // Act
        val result = repository.updateLote("lote-update-new-id", lote)

        // Assert
        assertThat(result.isSuccess).isTrue()
        verify(exactly = 1) { loteDao.saveLocal(any()) }

        // Verify the entity was properly converted and ID was updated
        val savedEntity = loteDaoSlot.captured
        assertThat(savedEntity.id).isEqualTo("lote-update-new-id") // ID should be updated
        assertThat(savedEntity.nombre).isEqualTo("Parcela Actualizada")
        assertThat(savedEntity.cultivo).isEqualTo("Trigo")
        assertThat(savedEntity.area).isEqualTo(150.0)
        assertThat(savedEntity.estado).isEqualTo("EN_COSECHA")
        assertThat(savedEntity.productorId).isEqualTo(productor.id)
    }
}
