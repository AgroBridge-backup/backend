package com.agrobridge.presentation.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ripple.rememberRipple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp

/**
 * Extension functions para facilitar styling
 * Replica los modifiers comunes de iOS (cardShadow, cornerRadius, etc.)
 */

/**
 * Aplicar card shadow estándar (replica iOS .cardShadow)
 */
fun Modifier.cardShadow(
    elevation: Dp = Elevation.medium,
    shape: Shape = RoundedCornerShape(CornerRadius.medium)
): Modifier = this.shadow(
    elevation = elevation,
    shape = shape,
    spotColor = Color.Black.copy(alpha = 0.08f),
    ambientColor = Color.Black.copy(alpha = 0.04f)
)

/**
 * Aplicar padding estándar de pantalla
 */
fun Modifier.screenPadding(): Modifier = this.padding(Spacing.spacing16)

/**
 * Aplicar padding de card
 */
fun Modifier.cardPadding(): Modifier = this.padding(Spacing.spacing16)

/**
 * Aplicar corner radius estándar
 */
fun Modifier.standardCornerRadius(): Modifier =
    this.clip(RoundedCornerShape(CornerRadius.medium))

/**
 * Clickable sin ripple effect (como iOS)
 */
fun Modifier.clickableNoRipple(
    enabled: Boolean = true,
    onClick: () -> Unit
): Modifier = this.clickable(
    enabled = enabled,
    indication = null,
    interactionSource = remember { MutableInteractionSource() },
    onClick = onClick
)

/**
 * Clickable con ripple effect (Android style)
 */
@Composable
fun Modifier.clickableWithRipple(
    enabled: Boolean = true,
    onClick: () -> Unit
): Modifier = this.clickable(
    enabled = enabled,
    indication = rememberRipple(),
    interactionSource = remember { MutableInteractionSource() },
    onClick = onClick
)

/**
 * Aplicar background con corner radius
 */
fun Modifier.backgroundCard(
    color: Color = Color.White,
    cornerRadius: Dp = CornerRadius.medium
): Modifier = this
    .clip(RoundedCornerShape(cornerRadius))
    .background(color)

/**
 * Aplicar estilo de chip/badge
 */
fun Modifier.chipStyle(
    backgroundColor: Color,
    cornerRadius: Dp = CornerRadius.large
): Modifier = this
    .clip(RoundedCornerShape(cornerRadius))
    .background(backgroundColor)
    .padding(horizontal = Spacing.spacing12, vertical = Spacing.spacing8)
