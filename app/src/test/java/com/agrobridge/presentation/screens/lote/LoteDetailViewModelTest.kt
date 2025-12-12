package com.agrobridge.presentation.screens.lote

import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.presentation.model.UIState
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test

/**
 * Tests for LoteDetailViewModel
 * Validates null/empty loteId handling and navigation safety
 *
 * Bug Fix: HIGH-8
 * Issue: Null pointer when navigating with null loteId
 * Solution: Validate loteId is not null/empty before loading
 */
@ExperimentalCoroutinesApi
class LoteDetailViewModelTest {

    private lateinit var loteRepository: LoteRepository
    private lateinit var viewModel: LoteDetailViewModel
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        loteRepository = mockk()
        viewModel = LoteDetailViewModel(loteRepository)
    }

    @Test
    fun loadLote_with_null_id_returns_error() = runTest(testDispatcher) {
        // Act
        viewModel.loadLote("")

        // Assert
        assertThat(viewModel.loteState.value).isInstanceOf(UIState.Error::class.java)
        val errorState = viewModel.loteState.value as UIState.Error
        assertThat(errorState.message).contains("inválido")
    }

    @Test
    fun loadLote_with_valid_id_loads_successfully() = runTest(testDispatcher) {
        // Arrange
        val mockLote = Lote(
            id = "lote-1",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = Productor.mock(),
            fechaCreacion = System.currentTimeMillis()
        )

        coEvery { loteRepository.getLoteById("lote-1") } returns flowOf(mockLote)

        // Act
        viewModel.loadLote("lote-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.loteState.value).isInstanceOf(UIState.Success::class.java)
        val successState = viewModel.loteState.value as UIState.Success
        assertThat(successState.data.id).isEqualTo("lote-1")
    }

    @Test
    fun loadLote_with_not_found_lote_returns_error() = runTest(testDispatcher) {
        // Arrange
        coEvery { loteRepository.getLoteById("nonexistent") } returns flowOf(null)

        // Act
        viewModel.loadLote("nonexistent")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.loteState.value).isInstanceOf(UIState.Error::class.java)
    }

    @Test
    fun retry_calls_loadLote_again() = runTest(testDispatcher) {
        // Arrange
        val mockLote = Lote(
            id = "lote-1",
            nombre = "Test",
            cultivo = "Maíz",
            area = 1.0,
            estado = LoteEstado.ACTIVO,
            productor = Productor.mock(),
            fechaCreacion = System.currentTimeMillis()
        )

        coEvery { loteRepository.getLoteById("lote-1") } returns flowOf(mockLote)

        // Act - first try (error)
        viewModel.loadLote("")
        advanceUntilIdle()

        // Then retry with valid ID
        viewModel.retry("lote-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.loteState.value).isInstanceOf(UIState.Success::class.java)
    }

    @Test
    fun loadLote_sets_editing_lote_copy() = runTest(testDispatcher) {
        // Arrange
        val mockLote = Lote(
            id = "lote-1",
            nombre = "Test Lote",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = Productor.mock(),
            fechaCreacion = System.currentTimeMillis()
        )

        coEvery { loteRepository.getLoteById("lote-1") } returns flowOf(mockLote)

        // Act
        viewModel.loadLote("lote-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.editingLote.value).isNotNull()
        assertThat(viewModel.editingLote.value?.id).isEqualTo("lote-1")
    }

    @Test
    fun loadLote_handles_repository_exception() = runTest(testDispatcher) {
        // Arrange
        coEvery { loteRepository.getLoteById("lote-1") } throws Exception("Network error")

        // Act
        viewModel.loadLote("lote-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.loteState.value).isInstanceOf(UIState.Error::class.java)
    }
}
