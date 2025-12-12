package com.agrobridge.presentation.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Sistema de espaciado de AgroBridge
 * Basado en sistema de 4pt grid (iOS spacing4, spacing8, etc.)
 */
object Spacing {
    /**
     * spacing4 - 4dp
     * Uso: Espacios mínimos entre elementos muy cercanos
     */
    val spacing4: Dp = 4.dp

    /**
     * spacing8 - 8dp
     * Uso: Espacios pequeños dentro de componentes
     */
    val spacing8: Dp = 8.dp

    /**
     * spacing12 - 12dp
     * Uso: Espacios medianos entre elementos relacionados
     */
    val spacing12: Dp = 12.dp

    /**
     * spacing16 - 16dp
     * Uso: Padding estándar de pantallas y cards
     */
    val spacing16: Dp = 16.dp

    /**
     * spacing20 - 20dp
     * Uso: Espacios entre secciones pequeñas
     */
    val spacing20: Dp = 20.dp

    /**
     * spacing24 - 24dp
     * Uso: Espacios entre secciones medianas
     */
    val spacing24: Dp = 24.dp

    /**
     * spacing32 - 32dp
     * Uso: Espacios grandes entre secciones
     */
    val spacing32: Dp = 32.dp

    /**
     * spacing40 - 40dp
     * Uso: Espacios extra grandes, separación de bloques
     */
    val spacing40: Dp = 40.dp

    /**
     * spacing48 - 48dp
     * Uso: Espacios extremadamente grandes
     */
    val spacing48: Dp = 48.dp
}

/**
 * Sistema de corner radius (bordes redondeados)
 * Replica cornerRadius8, cornerRadius12, etc. de iOS
 */
object CornerRadius {
    /**
     * extraSmall - 4dp
     * Uso: Bordes sutiles en chips pequeños
     */
    val extraSmall: Dp = 4.dp

    /**
     * small - 8dp
     * Uso: Bordes de botones pequeños, badges
     */
    val small: Dp = 8.dp

    /**
     * medium - 12dp
     * Uso: Bordes estándar de cards y botones
     */
    val medium: Dp = 12.dp

    /**
     * large - 16dp
     * Uso: Bordes de cards grandes, modals
     */
    val large: Dp = 16.dp

    /**
     * extraLarge - 20dp
     * Uso: Bordes muy redondeados
     */
    val extraLarge: Dp = 20.dp

    /**
     * full - 50% (use CircleShape instead)
     * Uso: Círculos perfectos
     */
    val full: Dp = 999.dp // Indica usar CircleShape
}

/**
 * Sistema de elevación (sombras)
 */
object Elevation {
    /**
     * none - 0dp
     * Uso: Sin sombra
     */
    val none: Dp = 0.dp

    /**
     * small - 1dp
     * Uso: Elevación sutil
     */
    val small: Dp = 1.dp

    /**
     * medium - 2dp
     * Uso: Elevación estándar de cards (iOS cardShadow)
     */
    val medium: Dp = 2.dp

    /**
     * large - 4dp
     * Uso: Elevación de elementos flotantes
     */
    val large: Dp = 4.dp

    /**
     * extraLarge - 8dp
     * Uso: Elevación de modals y dialogs
     */
    val extraLarge: Dp = 8.dp
}

/**
 * Tamaños de iconos
 */
object IconSize {
    /**
     * small - 16dp
     */
    val small: Dp = 16.dp

    /**
     * medium - 24dp (estándar Material)
     */
    val medium: Dp = 24.dp

    /**
     * large - 32dp
     */
    val large: Dp = 32.dp

    /**
     * extraLarge - 48dp
     */
    val extraLarge: Dp = 48.dp
}

/**
 * Alturas de componentes
 */
object ComponentHeight {
    /**
     * button - 48dp (Material minimum touch target)
     */
    val button: Dp = 48.dp

    /**
     * textField - 56dp
     */
    val textField: Dp = 56.dp

    /**
     * toolbar - 56dp
     */
    val toolbar: Dp = 56.dp

    /**
     * bottomNav - 80dp
     */
    val bottomNav: Dp = 80.dp

    /**
     * listItem - 72dp
     */
    val listItem: Dp = 72.dp
}

/**
 * Anchos máximos para contenido
 */
object MaxWidth {
    /**
     * dialog - 560dp
     */
    val dialog: Dp = 560.dp

    /**
     * content - 840dp (para tablets)
     */
    val content: Dp = 840.dp
}
