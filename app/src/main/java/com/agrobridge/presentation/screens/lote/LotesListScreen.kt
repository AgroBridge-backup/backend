package com.agrobridge.presentation.screens.lote

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import com.agrobridge.data.model.Lote
import com.agrobridge.data.model.LoteEstado
import com.agrobridge.presentation.components.*
import com.agrobridge.presentation.model.UIState
import com.agrobridge.presentation.screens.lote.LotesViewModel
import com.agrobridge.presentation.theme.*

/**
 * LotesListScreen - Lista completa de lotes
 * Con filtros y búsqueda
 *
 * Integrado con LotesViewModel para:
 * - Cargar datos reales desde repository
 * - Aplicar búsqueda y filtros reactivamente
 * - Persistir estado en config changes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LotesListScreen(
    productorId: String = "",
    onNavigateBack: () -> Unit = {},
    onNavigateToLote: (String) -> Unit = {},
    viewModel: LotesViewModel = hiltViewModel()
) {
    // Observar estado del ViewModel
    val lotesState by viewModel.lotesState.collectAsState()
    val filteredLotes by viewModel.filteredLotes.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val showActiveOnly by viewModel.showActiveOnly.collectAsState()

    // Cargar datos cuando la pantalla se monta
    LaunchedEffect(productorId) {
        if (productorId.isNotEmpty()) {
            viewModel.loadLotes(productorId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Mis Lotes",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Volver"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.toggleActiveOnly() }) {
                        Icon(
                            imageVector = Icons.Default.FilterList,
                            contentDescription = "Filtrar solo activos"
                        )
                    }
                    IconButton(onClick = { /* TODO: Más opciones */ }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Más opciones"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AgroGreen,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            AgroBridgeFAB(
                icon = Icons.Default.Add,
                contentDescription = "Agregar lote",
                onClick = { /* TODO: Agregar lote */ },
                extended = true,
                text = "Nuevo Lote"
            )
        }
    ) { paddingValues ->
        when (lotesState) {
            is UIState.Loading -> {
                LoadingState(message = "Cargando lotes...")
            }
            is UIState.Error -> {
                ErrorState(
                    message = (lotesState as UIState.Error).message,
                    onRetry = { viewModel.retry() }
                )
            }
            is UIState.Success -> {
                val lotes = (lotesState as UIState.Success<List<Lote>>).data
                if (lotes.isEmpty()) {
                    EmptyState(
                        message = "No tienes lotes registrados",
                        actionLabel = "Crear primer lote",
                        onAction = { /* TODO: Crear lote */ },
                        icon = Icons.Default.Agriculture
                    )
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues)
                    ) {
                        // Filtros
                        FilterSection(
                            searchQuery = searchQuery,
                            onSearchChanged = { viewModel.updateSearchQuery(it) },
                            showActiveOnly = showActiveOnly,
                            onToggleActive = { viewModel.toggleActiveOnly() },
                            lotesCount = filteredLotes.size
                        )

                        // Lista de lotes filtrados
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(
                                horizontal = Spacing.spacing16,
                                vertical = Spacing.spacing12
                            ),
                            verticalArrangement = Arrangement.spacedBy(Spacing.spacing12)
                        ) {
                            items(
                                items = filteredLotes,
                                key = { it.id }
                            ) { lote ->
                                AnimatedVisibility(
                                    visible = true,
                                    enter = fadeIn() + slideInVertically(),
                                    exit = fadeOut() + slideOutVertically()
                                ) {
                                    LoteCard(
                                        lote = lote,
                                        onClick = { onNavigateToLote(lote.id) },
                                        showDetails = false,
                                        modifier = Modifier.animateItemPlacement()
                                    )
                                }
                            }

                            // Espaciado final para el FAB
                            item {
                                Spacer(modifier = Modifier.height(80.dp))
                            }
                        }
                    }
                }
            }
            else -> {} // Idle state
        }
    }
}

/**
 * Sección de filtros y búsqueda
 */
@Composable
private fun FilterSection(
    searchQuery: String,
    onSearchChanged: (String) -> Unit,
    showActiveOnly: Boolean,
    onToggleActive: () -> Unit,
    lotesCount: Int
) {
    Column(
        modifier = Modifier.padding(Spacing.spacing16)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Filtros",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "$lotesCount resultados",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(Spacing.spacing12))

        // Búsqueda
        androidx.compose.material3.TextField(
            value = searchQuery,
            onValueChange = onSearchChanged,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = Spacing.spacing12),
            placeholder = { Text("Buscar por nombre, cultivo...") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Buscar"
                )
            },
            singleLine = true,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(Spacing.spacing8)
        )

        // Chip para filtro activo
        androidx.compose.foundation.layout.FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.spacing8)
        ) {
            androidx.compose.material3.FilterChip(
                selected = showActiveOnly,
                onClick = onToggleActive,
                label = { Text("Solo Activos") },
                leadingIcon = if (showActiveOnly) {
                    { Icon(Icons.Default.CheckCircle, contentDescription = null) }
                } else null
            )
        }
    }
}
