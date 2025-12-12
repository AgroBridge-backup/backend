package com.agrobridge.presentation.navigation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.agrobridge.presentation.screens.dashboard.DashboardScreen
import com.agrobridge.presentation.screens.lote.LotesListScreen
import com.agrobridge.presentation.screens.lote.LoteDetailScreen
import com.agrobridge.presentation.map.MapScreen
import timber.log.Timber

/**
 * Navigation Graph principal de AgroBridge (MAD 2025 - Type-Safe)
 *
 * Implementa navegación type-safe usando @Serializable routes, eliminando
 * strings hardcodeados y proporcionando seguridad de tipos en tiempo de compilación.
 *
 * **Características:**
 * - ✅ Type-safe navigation (sin strings)
 * - ✅ Argumentos automáticamente serializados
 * - ✅ Soporte para deep links
 * - ✅ Bottom navigation con estado persistente
 * - ✅ Manejo correcto de back stack
 *
 * **Estructura:**
 * - Dashboard: Pantalla principal
 * - Lotes: Lista y detalle
 * - Map: Mapa general y enfocado
 * - Weather: Clima general y por lote
 * - Scanner: Escaneo de cultivos
 * - Profile/Settings: Configuración
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgroBridgeNavGraph(
    navController: NavHostController = rememberNavController()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    Scaffold(
        bottomBar = {
            // Mostrar bottom navigation solo en pantallas principales
            if (shouldShowBottomBar(navBackStackEntry)) {
                NavigationBar {
                    bottomNavigationItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any {
                            // Comparar por route name (tipo de destino)
                            it.route?.startsWith(item.screen.javaClass.simpleName) == true
                        } == true

                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = item.label
                                )
                            },
                            label = { Text(item.label) },
                            selected = selected,
                            onClick = {
                                navController.navigate(item.screen) {
                                    // Pop up to the start destination of the graph to
                                    // avoid building up a large stack of destinations
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    // Avoid multiple copies of the same destination
                                    launchSingleTop = true
                                    // Restore state when reselecting a previously selected item
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard,
            modifier = Modifier.padding(innerPadding)
        ) {
            // ================================================================
            // DASHBOARD
            // ================================================================
            /**
             * Dashboard - Pantalla principal con resumen y navegación rápida
             */
            composable<Screen.Dashboard> {
                DashboardScreen(
                    onNavigateToLote = { loteId ->
                        navController.navigate(Screen.LoteDetail(loteId = loteId))
                    },
                    onNavigateToMap = {
                        navController.navigate(Screen.Map)
                    },
                    onNavigateToWeather = {
                        navController.navigate(Screen.Weather)
                    }
                )
            }

            // ================================================================
            // LOTES
            // ================================================================
            /**
             * Lotes List - Lista de todos los lotes del productor
             */
            composable<Screen.LotesList> {
                LotesListScreen(
                    onNavigateBack = { navController.navigateUp() },
                    onNavigateToLote = { loteId ->
                        navController.navigate(Screen.LoteDetail(loteId = loteId))
                    }
                )
            }

            /**
             * Lote Detail - Detalle de un lote específico
             *
             * Argumentos extraídos automáticamente por toRoute<Screen.LoteDetail>()
             * Eliminando la necesidad de navArgument() boilerplate
             */
            composable<Screen.LoteDetail> { backStackEntry ->
                val args = backStackEntry.toRoute<Screen.LoteDetail>()
                LoteDetailScreen(
                    loteId = args.loteId,
                    onNavigateBack = { navController.navigateUp() },
                    onNavigateToMap = {
                        navController.navigate(Screen.MapLote(loteId = args.loteId))
                    },
                    onNavigateToWeather = {
                        navController.navigate(Screen.WeatherLote(loteId = args.loteId))
                    },
                    onNavigateToScanner = {
                        navController.navigate(Screen.ScannerLote(loteId = args.loteId))
                    }
                )
            }

            // ================================================================
            // MAPA
            // ================================================================
            /**
             * Map - Mapa general de todos los lotes
             */
            composable<Screen.Map> {
                MapScreen(
                    onLoteClick = { loteId ->
                        navController.navigate(Screen.LoteDetail(loteId = loteId))
                    },
                    onBackClick = { navController.navigateUp() }
                )
            }

            /**
             * Map Lote - Mapa enfocado en un lote específico
             * TODO: Centrar mapa en el loteId específico
             */
            composable<Screen.MapLote> { backStackEntry ->
                val args = backStackEntry.toRoute<Screen.MapLote>()
                MapScreen(
                    onLoteClick = { loteIdClicked ->
                        navController.navigate(Screen.LoteDetail(loteId = loteIdClicked))
                    },
                    onBackClick = { navController.navigateUp() }
                )
                // TODO: Implementar centralización automática en lote específico
                // ViewModel debería recibir loteId y ajustar zoom/center
            }

            // ================================================================
            // WEATHER
            // ================================================================
            /**
             * Weather - Pronóstico del clima general
             */
            composable<Screen.Weather> {
                PlaceholderScreen(
                    title = "Pronóstico del Clima",
                    description = "Aquí se mostrará el pronóstico del clima"
                )
            }

            /**
             * Weather Lote - Pronóstico específico para un lote
             */
            composable<Screen.WeatherLote> { backStackEntry ->
                val args = backStackEntry.toRoute<Screen.WeatherLote>()
                PlaceholderScreen(
                    title = "Clima del Lote",
                    description = "Mostrando clima del lote: ${args.loteId}"
                )
            }

            // ================================================================
            // SCANNER
            // ================================================================
            /**
             * Scanner - Herramienta de escaneo de cultivos con IA
             */
            composable<Screen.Scanner> {
                PlaceholderScreen(
                    title = "Scanner de Cultivos",
                    description = "Aquí se mostrará la cámara para escanear cultivos"
                )
            }

            /**
             * Scanner Lote - Escaneo especializado para un lote
             */
            composable<Screen.ScannerLote> { backStackEntry ->
                val args = backStackEntry.toRoute<Screen.ScannerLote>()
                PlaceholderScreen(
                    title = "Scanner del Lote",
                    description = "Escaneando cultivo del lote: ${args.loteId}"
                )
            }

            /**
             * Scanner Result - Resultado del análisis de escaneo
             */
            composable<Screen.ScannerResult> { backStackEntry ->
                val args = backStackEntry.toRoute<Screen.ScannerResult>()
                PlaceholderScreen(
                    title = "Resultado del Análisis",
                    description = "Mostrando resultado del análisis: ${args.analysisId}"
                )
            }

            // ================================================================
            // PROFILE & SETTINGS
            // ================================================================
            /**
             * Profile - Perfil del usuario/productor
             */
            composable<Screen.Profile> {
                PlaceholderScreen(
                    title = "Perfil",
                    description = "Aquí se mostrará el perfil del usuario"
                )
            }

            /**
             * Settings - Configuración de la aplicación
             */
            composable<Screen.Settings> {
                PlaceholderScreen(
                    title = "Configuración",
                    description = "Aquí se mostrará la configuración de la app"
                )
            }
        }
    }
}

/**
 * Determina si se debe mostrar la bottom navigation en la ruta actual
 *
 * La bottom nav se muestra solo en las pantallas principales (sin argumentos)
 * Se oculta en pantallas de detalle, resultados y configuración
 *
 * @param backStackEntry Entrada actual del back stack
 * @return true si se debe mostrar el bottom bar
 */
private fun shouldShowBottomBar(backStackEntry: androidx.navigation.NavBackStackEntry?): Boolean {
    val route = backStackEntry?.destination?.route ?: return false

    return when {
        // Pantallas principales (sin parámetros)
        route.startsWith("Screen.Dashboard") -> true
        route.startsWith("Screen.LotesList") -> true
        route.startsWith("Screen.Map") && !route.contains("MapLote") -> true
        route.startsWith("Screen.Scanner") && !route.contains("ScannerLote") && !route.contains("ScannerResult") -> true
        route.startsWith("Screen.Profile") -> true
        // Ocultar en pantallas de detalle
        else -> false
    }
}

/**
 * Elemento de navegación inferior
 *
 * @property screen Pantalla de destino (type-safe)
 * @property icon Icono a mostrar
 * @property label Etiqueta para accesibilidad
 */
private data class BottomNavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String
)

/**
 * Items del bottom navigation
 *
 * Define las 5 pantallas principales accesibles desde cualquier lugar
 */
private val bottomNavigationItems = listOf(
    BottomNavItem(Screen.Dashboard, Icons.Default.Home, "Inicio"),
    BottomNavItem(Screen.LotesList, Icons.Default.List, "Lotes"),
    BottomNavItem(Screen.Map, Icons.Default.Place, "Mapa"),
    BottomNavItem(Screen.Scanner, Icons.Default.CameraAlt, "Scanner"),
    BottomNavItem(Screen.Profile, Icons.Default.Person, "Perfil")
)

/**
 * Pantalla placeholder para rutas aún no implementadas
 *
 * Se usa temporalmente mientras las screens reales se desarrollan.
 * Después de implementación, reemplazar con las screens reales.
 *
 * @param title Título a mostrar
 * @param description Descripción o estado de implementación
 */
@Composable
private fun PlaceholderScreen(
    title: String,
    description: String
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(all = com.agrobridge.presentation.theme.Spacing.spacing16),
        contentAlignment = androidx.compose.ui.Alignment.Center
    ) {
        Column(
            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(modifier = Modifier.height(com.agrobridge.presentation.theme.Spacing.spacing16))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
