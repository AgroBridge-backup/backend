package com.agrobridge.presentation.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Light Color Scheme para AgroBridge
 * Replica exactamente los colores de iOS con Material3
 */
private val LightColorScheme = lightColorScheme(
    // Primary colors (verde AgroBridge)
    primary = AgroGreen,
    onPrimary = Color.White,
    primaryContainer = AgroGreenLight,
    onPrimaryContainer = AgroGreenDark,

    // Secondary colors (variantes de verde)
    secondary = AgroGreenDark,
    onSecondary = Color.White,
    secondaryContainer = AgroGreenLight.copy(alpha = 0.5f),
    onSecondaryContainer = AgroGreenDark,

    // Tertiary colors (para acentos adicionales)
    tertiary = Info,
    onTertiary = Color.White,
    tertiaryContainer = Info.copy(alpha = 0.2f),
    onTertiaryContainer = Info,

    // Error colors
    error = Error,
    onError = Color.White,
    errorContainer = Error.copy(alpha = 0.2f),
    onErrorContainer = Error,

    // Background colors
    background = BackgroundPrimary,
    onBackground = TextPrimary,

    // Surface colors (cards, modals, etc.)
    surface = SurfaceElevated,
    onSurface = TextPrimary,
    surfaceVariant = BackgroundSecondary,
    onSurfaceVariant = TextSecondary,

    // Outline colors (bordes, divisores)
    outline = Divider,
    outlineVariant = Divider.copy(alpha = 0.5f),

    // Inverse colors (para botones flotantes, snackbars)
    inverseSurface = TextPrimary,
    inverseOnSurface = Color.White,
    inversePrimary = AgroGreenLight,

    // Scrim (overlay para dialogs)
    scrim = Overlay,

    // Surface tint (para elevación)
    surfaceTint = AgroGreen
)

/**
 * Dark Color Scheme para AgroBridge
 * Optimizado para modo oscuro
 */
private val DarkColorScheme = darkColorScheme(
    // Primary colors (más brillante en dark mode)
    primary = DarkAgroGreen,
    onPrimary = Color.Black,
    primaryContainer = AgroGreenDark,
    onPrimaryContainer = AgroGreenLight,

    // Secondary colors
    secondary = AgroGreenLight,
    onSecondary = Color.Black,
    secondaryContainer = AgroGreenDark,
    onSecondaryContainer = AgroGreenLight,

    // Tertiary colors
    tertiary = Info,
    onTertiary = Color.Black,
    tertiaryContainer = Info.copy(alpha = 0.3f),
    onTertiaryContainer = Info,

    // Error colors (más suave en dark mode)
    error = Error.copy(red = 0.9f),
    onError = Color.Black,
    errorContainer = Error.copy(alpha = 0.3f),
    onErrorContainer = Error,

    // Background colors (dark theme)
    background = DarkBackgroundPrimary,
    onBackground = DarkTextPrimary,

    // Surface colors (dark theme)
    surface = DarkSurfaceElevated,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkBackgroundSecondary,
    onSurfaceVariant = DarkTextSecondary,

    // Outline colors
    outline = Color.White.copy(alpha = 0.12f),
    outlineVariant = Color.White.copy(alpha = 0.08f),

    // Inverse colors
    inverseSurface = Color.White,
    inverseOnSurface = Color.Black,
    inversePrimary = AgroGreen,

    // Scrim
    scrim = Color.Black.copy(alpha = 0.6f),

    // Surface tint
    surfaceTint = DarkAgroGreen
)

/**
 * Shapes para componentes de Material3
 * Define los corner radius para todos los componentes
 */
private val AgroBridgeShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(CornerRadius.extraSmall),
    small = androidx.compose.foundation.shape.RoundedCornerShape(CornerRadius.small),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(CornerRadius.medium),
    large = androidx.compose.foundation.shape.RoundedCornerShape(CornerRadius.large),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(CornerRadius.extraLarge)
)

/**
 * AgroBridgeTheme - Tema principal de la aplicación
 * Replica exactamente el look & feel de iOS pero con Material Design 3
 *
 * @param darkTheme Si usar tema oscuro (por defecto sigue el sistema)
 * @param dynamicColor Si usar Material You dynamic colors (Android 12+)
 * @param content Contenido de la app
 */
@Composable
fun AgroBridgeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        // Dynamic colors (Material You) - Solo si está habilitado Y es Android 12+
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        // Dark theme
        darkTheme -> DarkColorScheme

        // Light theme (default)
        else -> LightColorScheme
    }

    // Configurar status bar y navigation bar colors
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window

            // Status bar color (transparente para edge-to-edge)
            window.statusBarColor = android.graphics.Color.TRANSPARENT

            // Navigation bar color (transparente para edge-to-edge)
            window.navigationBarColor = android.graphics.Color.TRANSPARENT

            // Status bar icons color (dark o light según el theme)
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AgroBridgeTypography,
        shapes = AgroBridgeShapes,
        content = content
    )
}

/**
 * Preview helper para ver el theme en Android Studio
 */
@Composable
fun AgroBridgeThemePreview(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    AgroBridgeTheme(darkTheme = darkTheme, dynamicColor = false, content = content)
}
