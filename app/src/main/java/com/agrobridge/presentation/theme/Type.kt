package com.agrobridge.presentation.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Sistema de tipografía de AgroBridge
 * Replica exactamente la jerarquía de iOS:
 * - Large Title (displayLarge): 34sp, Bold
 * - Title 1 (displayMedium): 28sp, Bold
 * - Title 2 (displaySmall): 22sp, Bold
 * - Title 3 (headlineLarge): 20sp, SemiBold
 * - Headline (headlineMedium): 17sp, SemiBold
 * - Body (bodyLarge): 17sp, Regular
 * - Subheadline (bodyMedium): 15sp, Regular
 * - Caption (bodySmall): 12sp, Regular
 */
val AgroBridgeTypography = Typography(
    // ========================================================================
    // DISPLAY STYLES (títulos grandes)
    // ========================================================================

    /**
     * displayLarge - Large Title (iOS equivalent)
     * Uso: Títulos principales de pantalla
     * Ejemplo: "Bienvenido a AgroBridge"
     */
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 41.sp,
        letterSpacing = 0.25.sp
    ),

    /**
     * displayMedium - Title 1 (iOS equivalent)
     * Uso: Títulos de secciones principales
     * Ejemplo: "Mis Lotes"
     */
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = 0.sp
    ),

    /**
     * displaySmall - Title 2 (iOS equivalent)
     * Uso: Subtítulos importantes
     * Ejemplo: "Productores Activos"
     */
    displaySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp
    ),

    // ========================================================================
    // HEADLINE STYLES (encabezados)
    // ========================================================================

    /**
     * headlineLarge - Title 3 (iOS equivalent)
     * Uso: Encabezados de cards y secciones
     * Ejemplo: "Detalles del Lote"
     */
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.15.sp
    ),

    /**
     * headlineMedium - Headline (iOS equivalent)
     * Uso: Encabezados de listas y grupos
     * Ejemplo: Nombres de items en lista
     */
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.15.sp
    ),

    /**
     * headlineSmall - Subhead (iOS equivalent)
     * Uso: Encabezados pequeños
     */
    headlineSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),

    // ========================================================================
    // BODY STYLES (texto corriente)
    // ========================================================================

    /**
     * bodyLarge - Body (iOS equivalent)
     * Uso: Texto principal de contenido
     * Ejemplo: Descripciones, párrafos
     */
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.5.sp
    ),

    /**
     * bodyMedium - Subheadline (iOS equivalent)
     * Uso: Texto secundario, subtítulos
     * Ejemplo: Fecha, hora, metadata
     */
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp
    ),

    /**
     * bodySmall - Caption (iOS equivalent)
     * Uso: Textos pequeños, etiquetas
     * Ejemplo: "Última actualización", timestamps
     */
    bodySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp
    ),

    // ========================================================================
    // LABEL STYLES (labels y botones)
    // ========================================================================

    /**
     * labelLarge - Button text
     * Uso: Texto de botones principales
     */
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp
    ),

    /**
     * labelMedium - Chip/Tag text
     * Uso: Texto de chips y badges
     */
    labelMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),

    /**
     * labelSmall - Overline text
     * Uso: Labels pequeños, overlines
     */
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    )
)
