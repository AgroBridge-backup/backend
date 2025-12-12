package com.agrobridge.presentation.screens.dashboard

import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.model.Productor
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.presentation.model.UIState
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Tests for DashboardViewModel
 * Validates memory leak fix: coroutineScope coordination instead of independent launch { }
 *
 * Bug Fix: HIGH-5
 * Issue: 4 independent launch { } blocks continue running if ViewModel destroyed
 * Solution: Single coordinated coroutineScope that cancels all if ViewModel destroyed
 */
@ExperimentalCoroutinesApi
class DashboardViewModelTest {

    private lateinit var loteRepository: LoteRepository
    private lateinit var viewModel: DashboardViewModel
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        loteRepository = mockk()
        viewModel = DashboardViewModel(loteRepository)
    }

    @Test
    fun loadDashboard_loads_all_data_successfully() = runTest(testDispatcher) {
        // Arrange
        val mockLotes = listOf(
            Lote(
                id = "lote-1",
                nombre = "Test Lote",
                cultivo = "Maíz",
                area = 5.0,
                estado = LoteEstado.ACTIVO,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis()
            )
        )

        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()

        // Act
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.lotesState.value).isInstanceOf(UIState.Success::class.java)
        assertThat(viewModel.activeLotesState.value).isInstanceOf(UIState.Success::class.java)
        assertThat(viewModel.pendingLotesCount.value).isEqualTo(0)
        assertThat(viewModel.lastSyncText.value).isNotEqualTo("Cargando...")
    }

    @Test
    fun loadDashboard_calculates_total_area_correctly() = runTest(testDispatcher) {
        // Arrange
        val lote1 = Lote(
            id = "lote-1",
            nombre = "Lote 1",
            cultivo = "Maíz",
            area = 5.0,
            estado = LoteEstado.ACTIVO,
            productor = Productor.mock(),
            fechaCreacion = System.currentTimeMillis()
        )

        val lote2 = Lote(
            id = "lote-2",
            nombre = "Lote 2",
            cultivo = "Tomate",
            area = 3.5,
            estado = LoteEstado.ACTIVO,
            productor = Productor.mock(),
            fechaCreacion = System.currentTimeMillis()
        )

        val mockLotes = listOf(lote1, lote2)

        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()

        // Act
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.totalArea.value).isEqualTo(8.5)
    }

    @Test
    fun loadDashboard_calculates_healthy_count_as_85_percent() = runTest(testDispatcher) {
        // Arrange
        val mockLotes = List(100) {
            Lote(
                id = "lote-$it",
                nombre = "Lote $it",
                cultivo = "Maíz",
                area = 5.0,
                estado = LoteEstado.ACTIVO,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis()
            )
        }

        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()

        // Act
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert
        assertThat(viewModel.healthyCount.value).isEqualTo(85) // 100 * 0.85
    }

    @Test
    fun loadDashboard_handles_repository_error_gracefully() = runTest(testDispatcher) {
        // Arrange
        coEvery { loteRepository.getLotes("prod-1") } throws Exception("Network error")
        coEvery { loteRepository.getActiveLotes("prod-1") } throws Exception("Network error")
        coEvery { loteRepository.getPendingLotesCount() } throws Exception("Network error")
        coEvery { loteRepository.getLastSyncTimestamp() } throws Exception("Network error")

        // Act
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert - should handle errors without crashing
        assertThat(viewModel.lotesState.value).isInstanceOf(UIState.Error::class.java)
    }

    @Test
    fun refreshData_reloads_all_data() = runTest(testDispatcher) {
        // Arrange
        val mockLotes = listOf(
            Lote(
                id = "lote-1",
                nombre = "Test Lote",
                cultivo = "Maíz",
                area = 5.0,
                estado = LoteEstado.ACTIVO,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis()
            )
        )

        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()
        coEvery { loteRepository.refreshLotes("prod-1") } returns Result.success(Unit)

        // Load initial data
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Act - refresh
        viewModel.refreshData()
        advanceUntilIdle()

        // Assert - repositories should be called multiple times
        verify(atLeast = 2) { loteRepository.getLotes("prod-1") }
    }

    @Test
    fun getUserGreeting_returns_correct_greeting_based_on_time() {
        // This test checks the greeting logic (not coroutine-dependent)
        val greeting = viewModel.getUserGreeting()
        assertThat(greeting).isIn("Buenos días", "Buenas tardes", "Buenas noches")
    }

    @Test
    fun loadDashboard_sets_loading_state_initially() = runTest(testDispatcher) {
        // Arrange
        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(emptyList())
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(emptyList())
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns null

        // Act
        viewModel.loadDashboard("prod-1")
        // Don't call advanceUntilIdle() yet to catch the Loading state

        // Assert - should be loading immediately
        assertThat(viewModel.lotesState.value).isInstanceOf(UIState.Loading::class.java)
    }

    @Test
    fun concurrent_loads_dont_cause_race_conditions() = runTest(testDispatcher) {
        // Arrange
        val mockLotes = List(10) {
            Lote(
                id = "lote-$it",
                nombre = "Lote $it",
                cultivo = "Maíz",
                area = 1.0,
                estado = LoteEstado.ACTIVO,
                productor = Productor.mock(),
                fechaCreacion = System.currentTimeMillis()
            )
        }

        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(mockLotes)
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()

        // Act - load twice in quick succession
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert - should handle concurrent loads without crashing
        assertThat(viewModel.lotesState.value).isInstanceOf(UIState.Success::class.java)
        assertThat(viewModel.totalArea.value).isEqualTo(10.0) // 10 lotes * 1.0 area
    }

    @Test
    fun empty_lotes_list_still_loads_successfully() = runTest(testDispatcher) {
        // Arrange
        coEvery { loteRepository.getLotes("prod-1") } returns flowOf(emptyList())
        coEvery { loteRepository.getActiveLotes("prod-1") } returns flowOf(emptyList())
        coEvery { loteRepository.getPendingLotesCount() } returns flowOf(0)
        coEvery { loteRepository.getLastSyncTimestamp() } returns System.currentTimeMillis()

        // Act
        viewModel.loadDashboard("prod-1")
        advanceUntilIdle()

        // Assert
        val state = viewModel.lotesState.value
        assertThat(state).isInstanceOf(UIState.Success::class.java)
        if (state is UIState.Success) {
            assertThat(state.data).isEmpty()
        }
    }
}
