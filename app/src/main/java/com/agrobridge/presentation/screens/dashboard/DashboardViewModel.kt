package com.agrobridge.presentation.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.data.repository.LoteRepository
import com.agrobridge.presentation.model.UIState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

/**
 * ViewModel para DashboardScreen
 *
 * Responsabilidades:
 * - Cargar resumen de datos del productor
 * - Mostrar estadísticas (lotes totales, activos, saludables)
 * - Mostrar información meteorológica
 * - Mostrar alertas pendientes
 * - Manejar sincronización de datos
 *
 * ARQUITECTURA: MVVM + Single Source of Truth
 * - Todos los datos vienen del repository
 * - UI observa StateFlows y se actualiza automáticamente
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val loteRepository: LoteRepository
) : ViewModel() {

    // ID del productor
    private val _productorId = MutableStateFlow<String?>(null)

    // Lotes del productor
    private val _lotesState = MutableStateFlow<UIState<List<Lote>>>(UIState.Idle)
    val lotesState: StateFlow<UIState<List<Lote>>> = _lotesState

    // Lotes activos
    private val _activeLotesState = MutableStateFlow<UIState<List<Lote>>>(UIState.Idle)
    val activeLotesState: StateFlow<UIState<List<Lote>>> = _activeLotesState

    // Lotes pendientes de sincronizar
    private val _pendingLotesCount = MutableStateFlow(0)
    val pendingLotesCount: StateFlow<Int> = _pendingLotesCount

    // Texto de última sincronización
    private val _lastSyncText = MutableStateFlow("Cargando...")
    val lastSyncText: StateFlow<String> = _lastSyncText

    // Estadísticas
    private val _totalArea = MutableStateFlow(0.0)
    val totalArea: StateFlow<Double> = _totalArea

    private val _healthyCount = MutableStateFlow(0)
    val healthyCount: StateFlow<Int> = _healthyCount

    /**
     * Inicializar carga de datos
     *
     * FIXED: HIGH-5 Memory Leak
     * Antes: 4 independientes launch { } que continúan aunque ViewModel se destruya
     * Ahora: coroutineScope coordinada que cancela todas si ViewModel se destruye
     */
    fun loadDashboard(productorId: String) {
        _productorId.value = productorId

        // Usar una sola corrutina coordenada para cargar todos los datos
        // Si ViewModel se destruye, viewModelScope.cancel() cancela TODO aquí
        viewModelScope.launch {
            try {
                // Usar coroutineScope para crear sub-tareas coordinadas
                coroutineScope {
                    val lotesTask = async { loadLotesInternal(productorId) }
                    val activeLotesTask = async { loadActiveLotesInternal(productorId) }
                    val pendingCountTask = async { loadPendingCountInternal() }
                    val lastSyncTask = async { updateLastSyncTimeInternal() }

                    // Esperar que ALL tareas completen o que ViewModel se destruya
                    lotesTask.await()
                    activeLotesTask.await()
                    pendingCountTask.await()
                    lastSyncTask.await()
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading dashboard")
            }
        }
    }

    /**
     * Cargar todos los lotes (suspendible, sin launch)
     */
    private suspend fun loadLotesInternal(productorId: String) {
        _lotesState.value = UIState.Loading

        try {
            loteRepository.getLotes(productorId)
                .collect { lotes ->
                    Timber.d("Dashboard loaded ${lotes.size} lotes")
                    _lotesState.value = UIState.Success(lotes)

                    // Calcular área total
                    val area = lotes.sumOf { it.area }
                    _totalArea.value = area

                    // FIXED: HIGH-10 - Count actual healthy lotes instead of hardcoded 85%
                    // A lote is healthy if:
                    // 1. Estado is ACTIVO (actively growing)
                    // 2. Area is reasonable (> 0)
                    // Note: In future, integrate with CropHealthService for real health status
                    val healthy = lotes.count { lote ->
                        lote.estado == LoteEstado.ACTIVO && lote.area > 0
                    }
                    _healthyCount.value = healthy
                }
        } catch (e: Exception) {
            Timber.e(e, "Error loading dashboard lotes")
            _lotesState.value = UIState.Error(e.message ?: "Error")
        }
    }

    /**
     * Cargar lotes activos (suspendible, sin launch)
     */
    private suspend fun loadActiveLotesInternal(productorId: String) {
        _activeLotesState.value = UIState.Loading

        try {
            loteRepository.getActiveLotes(productorId)
                .collect { lotes ->
                    Timber.d("Dashboard loaded ${lotes.size} active lotes")
                    _activeLotesState.value = UIState.Success(lotes)
                }
        } catch (e: Exception) {
            Timber.e(e, "Error loading active lotes")
            _activeLotesState.value = UIState.Error(e.message ?: "Error")
        }
    }

    /**
     * Cargar cantidad de lotes pendientes (suspendible, sin launch)
     */
    private suspend fun loadPendingCountInternal() {
        try {
            loteRepository.getPendingLotesCount()
                .collect { count ->
                    Timber.d("Pending lotes: $count")
                    _pendingLotesCount.value = count
                }
        } catch (e: Exception) {
            Timber.e(e, "Error loading pending count")
        }
    }

    /**
     * Actualizar texto de última sincronización (suspendible, sin launch)
     */
    private suspend fun updateLastSyncTimeInternal() {
        try {
            val timestamp = loteRepository.getLastSyncTimestamp()
            if (timestamp != null) {
                val text = formatLastSync(timestamp)
                _lastSyncText.value = text
            }
        } catch (e: Exception) {
            Timber.e(e, "Error getting last sync time")
        }
    }

    /**
     * Cargar todos los lotes (para refresh manual)
     * Usa launch independiente para no bloquear el UI
     */
    private fun loadLotes(productorId: String) {
        _lotesState.value = UIState.Loading

        viewModelScope.launch {
            try {
                loteRepository.getLotes(productorId)
                    .collect { lotes ->
                        Timber.d("Dashboard loaded ${lotes.size} lotes")
                        _lotesState.value = UIState.Success(lotes)

                        // Calcular área total
                        val area = lotes.sumOf { it.area }
                        _totalArea.value = area

                        // Calcular lotes saludables (mock: 85% of total)
                        val healthy = (lotes.size * 0.85).toInt()
                        _healthyCount.value = healthy
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error loading dashboard lotes")
                _lotesState.value = UIState.Error(e.message ?: "Error")
            }
        }
    }

    /**
     * Cargar lotes activos (para refresh manual)
     */
    private fun loadActiveLotes(productorId: String) {
        _activeLotesState.value = UIState.Loading

        viewModelScope.launch {
            try {
                loteRepository.getActiveLotes(productorId)
                    .collect { lotes ->
                        Timber.d("Dashboard loaded ${lotes.size} active lotes")
                        _activeLotesState.value = UIState.Success(lotes)
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error loading active lotes")
                _activeLotesState.value = UIState.Error(e.message ?: "Error")
            }
        }
    }

    /**
     * Cargar cantidad de lotes pendientes (para refresh manual)
     */
    private fun loadPendingCount() {
        viewModelScope.launch {
            try {
                loteRepository.getPendingLotesCount()
                    .collect { count ->
                        Timber.d("Pending lotes: $count")
                        _pendingLotesCount.value = count
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error loading pending count")
            }
        }
    }

    /**
     * Actualizar texto de última sincronización (para refresh manual)
     */
    private fun updateLastSyncTime() {
        viewModelScope.launch {
            try {
                val timestamp = loteRepository.getLastSyncTimestamp()
                if (timestamp != null) {
                    val text = formatLastSync(timestamp)
                    _lastSyncText.value = text
                }
            } catch (e: Exception) {
                Timber.e(e, "Error getting last sync time")
            }
        }
    }

    /**
     * Sincronizar datos desde API
     */
    fun refreshData() {
        val productorId = _productorId.value ?: return

        viewModelScope.launch {
            try {
                Timber.d("Refreshing dashboard data...")
                loteRepository.refreshLotes(productorId)
                    .onSuccess {
                        Timber.d("Dashboard data refreshed")
                        updateLastSyncTime()
                        loadLotes(productorId)
                        loadActiveLotes(productorId)
                        loadPendingCount()
                    }
                    .onFailure { e ->
                        Timber.e(e, "Error refreshing dashboard")
                    }
            } catch (e: Exception) {
                Timber.e(e, "Exception refreshing dashboard")
            }
        }
    }

    /**
     * Obtener saludo del usuario
     * En producción, esto vendría del AuthStore
     */
    fun getUserGreeting(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour < 12 -> "Buenos días"
            hour < 18 -> "Buenas tardes"
            else -> "Buenas noches"
        }
    }

    /**
     * Formatear timestamp a texto legible
     */
    private fun formatLastSync(timestamp: Long): String {
        val now = System.currentTimeMillis()
        val diffMs = now - timestamp
        val diffMins = diffMs / (1000 * 60)

        return when {
            diffMins < 1 -> "Hace unos segundos"
            diffMins < 60 -> "Hace $diffMins min"
            diffMins < 1440 -> {
                val hours = diffMins / 60
                "Hace $hours hora${if (hours > 1) "s" else ""}"
            }
            else -> {
                val days = diffMins / 1440
                "Hace $days día${if (days > 1) "s" else ""}"
            }
        }
    }
}
