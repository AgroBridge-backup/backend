package com.agrobridge.presentation.navigation

import kotlinx.serialization.Serializable

/**
 * Type-Safe Navigation Routes for AgroBridge
 *
 * Implements Modern Android Development (MAD) 2025 standards with serializable
 * navigation routes. This eliminates string-based route errors and provides
 * compile-time type safety.
 *
 * **Benefits:**
 * - ✅ Compile-time type safety (no string errors)
 * - ✅ Automatic argument serialization/deserialization
 * - ✅ IDE autocompletion support
 * - ✅ Deep link support via serialization
 * - ✅ Reduced boilerplate in NavHost
 *
 * **Usage in NavHost:**
 * ```kotlin
 * composable<Screen.Dashboard> { ... }
 * composable<Screen.LoteDetail> { backStackEntry ->
 *     val args = backStackEntry.toRoute<Screen.LoteDetail>()
 *     LoteDetailScreen(loteId = args.loteId)
 * }
 * ```
 *
 * **Usage for Navigation:**
 * ```kotlin
 * navController.navigate(Screen.LoteDetail(loteId = "123"))
 * navController.navigate(Screen.Dashboard)
 * ```
 */

/**
 * Sealed interface defining all navigable screens in the application
 * Each screen is marked with @Serializable for automatic serialization
 */
@Serializable
sealed interface Screen {
    /**
     * Dashboard - Pantalla principal de la aplicación
     *
     * Muestra:
     * - Resumen de lotes
     * - Alertas importantes
     * - Acceso rápido a funciones principales
     * - Información meteorológica
     */
    @Serializable
    data object Dashboard : Screen

    /**
     * Lotes List - Lista completa de lotes del productor
     *
     * Características:
     * - Búsqueda y filtrado
     * - Ordenamiento por área, fecha, estado
     * - Navegación a detalle de lote
     */
    @Serializable
    data object LotesList : Screen

    /**
     * Lote Detail - Detalle específico de un lote
     *
     * Parámetros:
     * - loteId: String - ID único del lote
     *
     * Información mostrada:
     * - Datos generales del lote
     * - Historial de cultivos
     * - Coordenadas y mapa
     * - Acciones disponibles (editar, eliminar, scanner, weather)
     */
    @Serializable
    data class LoteDetail(val loteId: String) : Screen

    /**
     * Map - Mapa general de todos los lotes
     *
     * Características:
     * - Visualización de todos los lotes del productor
     * - Marcadores interactivos
     * - Filtros por estado
     * - Navegación a detalle desde el mapa
     */
    @Serializable
    data object Map : Screen

    /**
     * Map Lote - Mapa enfocado en un lote específico
     *
     * Parámetros:
     * - loteId: String - ID del lote a centrar el mapa
     *
     * Características:
     * - Centro automático en coordenadas del lote
     * - Zoom ajustado al área del lote
     * - Herramientas de medición
     */
    @Serializable
    data class MapLote(val loteId: String) : Screen

    /**
     * Weather - Pronóstico del clima general
     *
     * Información:
     * - Pronóstico de 7 días
     * - Temperatura, humedad, viento
     * - Predicción de lluvia
     * - Alertas meteorológicas
     */
    @Serializable
    data object Weather : Screen

    /**
     * Weather Lote - Pronóstico específico para un lote
     *
     * Parámetros:
     * - loteId: String - ID del lote
     *
     * Información especializada:
     * - Clima específico de la ubicación del lote
     * - Recomendaciones agrícolas basadas en clima
     * - Riego óptimo según predicción
     */
    @Serializable
    data class WeatherLote(val loteId: String) : Screen

    /**
     * Scanner - Herramienta de escaneo de cultivos con IA
     *
     * Funcionalidad:
     * - Captura de fotos de plantas
     * - Análisis con ML Kit e IA local
     * - Detección de plagas y enfermedades
     * - Recomendaciones de tratamiento
     */
    @Serializable
    data object Scanner : Screen

    /**
     * Scanner Lote - Escaneo especializado para un lote
     *
     * Parámetros:
     * - loteId: String - ID del lote
     *
     * Características:
     * - Contexto agrícola del lote específico
     * - Historial de análisis previos
     * - Recomendaciones personalizadas
     */
    @Serializable
    data class ScannerLote(val loteId: String) : Screen

    /**
     * Scanner Result - Resultado detallado del análisis de escaneo
     *
     * Parámetros:
     * - analysisId: String - ID del análisis realizado
     *
     * Información presentada:
     * - Diagnóstico detallado
     * - Confianza de predicción
     * - Recomendaciones de tratamiento
     * - Productos recomendados
     */
    @Serializable
    data class ScannerResult(val analysisId: String) : Screen

    /**
     * Profile - Perfil del usuario/productor
     *
     * Información:
     * - Datos personales
     * - Historial de cultivos
     * - Estadísticas de producción
     * - Preferencias de notificaciones
     */
    @Serializable
    data object Profile : Screen

    /**
     * Settings - Configuración de la aplicación
     *
     * Opciones:
     * - Preferencias de idioma
     * - Notificaciones (alertas agrícolas)
     * - Sincronización de datos
     * - Privacidad y seguridad
     * - Información de versión
     */
    @Serializable
    data object Settings : Screen
}
