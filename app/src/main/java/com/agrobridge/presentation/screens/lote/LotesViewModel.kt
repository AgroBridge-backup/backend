package com.agrobridge.presentation.screens.lote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.presentation.model.UIState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel para LotesListScreen
 *
 * Responsabilidades:
 * - Cargar lista de lotes del productor
 * - Filtrar lotes (activos, todos)
 * - Buscar lotes por nombre
 * - Manejar estado de carga (Idle, Loading, Success, Error)
 * - Persistir estado en config changes (rotación, etc)
 *
 * ARQUITECTURA: MVVM + Clean Architecture
 * - Recibe datos del repository
 * - Expone StateFlow para UI
 * - UI observa y se actualiza automáticamente
 */
@HiltViewModel
class LotesViewModel @Inject constructor(
    private val loteRepository: LoteRepository
) : ViewModel() {

    // ID del productor (se obtiene de argument o auth)
    private val _productorId = MutableStateFlow<String?>(null)

    // Estado de carga
    private val _lotesState = MutableStateFlow<UIState<List<Lote>>>(UIState.Idle)
    val lotesState: StateFlow<UIState<List<Lote>>> = _lotesState

    // Lista filtrada
    private val _filteredLotes = MutableStateFlow<List<Lote>>(emptyList())
    val filteredLotes: StateFlow<List<Lote>> = _filteredLotes

    // Búsqueda
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery

    // Filtro: mostrar solo activos
    private val _showActiveOnly = MutableStateFlow(false)
    val showActiveOnly: StateFlow<Boolean> = _showActiveOnly

    /**
     * Cargar lotes inicialmente
     * Se llama desde LaunchedEffect(Unit) en la pantalla
     */
    fun loadLotes(productorId: String) {
        _productorId.value = productorId
        _lotesState.value = UIState.Loading

        viewModelScope.launch {
            try {
                // Cargar desde repository (que carga de BD local)
                loteRepository.getLotes(productorId)
                    .collect { lotes ->
                        Timber.d("Loaded ${lotes.size} lotes")
                        _lotesState.value = UIState.Success(lotes)
                        applyFilters(lotes)
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error loading lotes")
                _lotesState.value = UIState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Sincronizar lotes desde la API
     */
    fun refreshLotes() {
        viewModelScope.launch {
            try {
                val productorId = _productorId.value ?: return@launch
                loteRepository.refreshLotes(productorId)
                    .onFailure { e ->
                        Timber.e(e, "Error refreshing lotes")
                        _lotesState.value = UIState.Error(e.message ?: "Sync error")
                    }
                    .onSuccess {
                        Timber.d("Lotes synced successfully")
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error in refreshLotes")
                _lotesState.value = UIState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Actualizar búsqueda
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        val currentLotes = (_lotesState.value as? UIState.Success)?.data ?: emptyList()
        applyFilters(currentLotes)
    }

    /**
     * Togglear filtro de lotes activos
     */
    fun toggleActiveOnly() {
        _showActiveOnly.value = !_showActiveOnly.value
        val currentLotes = (_lotesState.value as? UIState.Success)?.data ?: emptyList()
        applyFilters(currentLotes)
    }

    /**
     * Aplicar filtros y búsqueda
     *
     * FIXED: MEDIUM-1 - Use type-safe enum comparison instead of string comparison
     */
    private fun applyFilters(lotes: List<Lote>) {
        var filtered = lotes

        // Filtro por estado activo - usar enum type-safe en lugar de string
        if (_showActiveOnly.value) {
            filtered = filtered.filter { it.estado == LoteEstado.ACTIVO }
        }

        // Filtro por búsqueda
        val query = _searchQuery.value
        if (query.isNotBlank()) {
            filtered = filtered.filter { lote ->
                lote.nombre.contains(query, ignoreCase = true) ||
                        lote.cultivo.contains(query, ignoreCase = true) ||
                        lote.ubicacion?.contains(query, ignoreCase = true) == true
            }
        }

        _filteredLotes.value = filtered
    }

    /**
     * Reintentar carga
     */
    fun retry() {
        val productorId = _productorId.value ?: return
        loadLotes(productorId)
    }
}
