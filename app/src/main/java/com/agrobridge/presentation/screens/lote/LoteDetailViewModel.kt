package com.agrobridge.presentation.screens.lote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.Lote
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.presentation.model.UIState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel para LoteDetailScreen
 *
 * Responsabilidades:
 * - Cargar detalle de un lote específico
 * - Permitir editar lote
 * - Sincronizar cambios con servidor
 * - Manejar estado de carga
 *
 * ARQUITECTURA: MVVM + Offline-First
 * - Carga datos de BD local
 * - Permite edición inmediata
 * - Sincroniza en background cuando hay conexión
 */
@HiltViewModel
class LoteDetailViewModel @Inject constructor(
    private val loteRepository: LoteRepository
) : ViewModel() {

    // Detalle del lote actual
    private val _loteState = MutableStateFlow<UIState<Lote>>(UIState.Idle)
    val loteState: StateFlow<UIState<Lote>> = _loteState

    // Datos para edición
    private val _editingLote = MutableStateFlow<Lote?>(null)
    val editingLote: StateFlow<Lote?> = _editingLote

    // Estado de guardado
    private val _saveState = MutableStateFlow<UIState<Unit>>(UIState.Idle)
    val saveState: StateFlow<UIState<Unit>> = _saveState

    /**
     * Cargar detalle del lote
     *
     * FIXED: HIGH-8
     * - Valida loteId no es null/empty antes de cargar
     * - Evita crash en navegación sin parámetro
     * - Proporciona error claro al usuario
     */
    fun loadLote(loteId: String) {
        // FIXED: HIGH-8 - Null/empty check before loading
        if (loteId.isNullOrEmpty()) {
            Timber.e("Cannot load lote: loteId is null or empty")
            _loteState.value = UIState.Error("ID de lote inválido")
            return
        }

        _loteState.value = UIState.Loading

        viewModelScope.launch {
            try {
                loteRepository.getLoteById(loteId)
                    .collect { lote ->
                        if (lote != null) {
                            Timber.d("Loaded lote: ${lote.nombre}")
                            _loteState.value = UIState.Success(lote)
                            _editingLote.value = lote.copy()
                        } else {
                            Timber.w("Lote not found: $loteId")
                            _loteState.value = UIState.Error("Lote no encontrado")
                        }
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error loading lote")
                _loteState.value = UIState.Error(e.message ?: "Error")
            }
        }
    }

    /**
     * Actualizar campo de edición
     */
    fun updateLote(lote: Lote) {
        _editingLote.value = lote
    }

    /**
     * Guardar cambios
     */
    fun saveLote() {
        val lote = _editingLote.value ?: return
        _saveState.value = UIState.Loading

        viewModelScope.launch {
            try {
                val result = loteRepository.updateLote(lote.id, lote)
                result.onSuccess {
                    Timber.d("Lote saved successfully")
                    _saveState.value = UIState.Success(Unit)
                    _loteState.value = UIState.Success(lote)
                }.onFailure { e ->
                    Timber.e(e, "Error saving lote")
                    _saveState.value = UIState.Error(e.message ?: "Error")
                }
            } catch (e: Exception) {
                Timber.e(e, "Exception saving lote")
                _saveState.value = UIState.Error(e.message ?: "Error")
            }
        }
    }

    /**
     * Crear nuevo lote
     */
    fun createNewLote(lote: Lote) {
        _saveState.value = UIState.Loading

        viewModelScope.launch {
            try {
                val result = loteRepository.createLote(lote)
                result.onSuccess {
                    Timber.d("Lote created successfully")
                    _saveState.value = UIState.Success(Unit)
                    _loteState.value = UIState.Success(lote)
                }.onFailure { e ->
                    Timber.e(e, "Error creating lote")
                    _saveState.value = UIState.Error(e.message ?: "Error")
                }
            } catch (e: Exception) {
                Timber.e(e, "Exception creating lote")
                _saveState.value = UIState.Error(e.message ?: "Error")
            }
        }
    }

    /**
     * Reintentar
     */
    fun retry(loteId: String) {
        loadLote(loteId)
    }
}
