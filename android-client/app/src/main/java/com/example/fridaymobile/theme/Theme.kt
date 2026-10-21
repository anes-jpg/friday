package com.example.fridaymobile.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val FridayDarkColorScheme =
  darkColorScheme(
    primary = ColorSignal,
    onPrimary = ColorVoid,
    primaryContainer = ColorPlateRaised,
    onPrimaryContainer = TextPrimary,
    surface = ColorPlate,
    onSurface = TextPrimary,
    surfaceVariant = ColorPlateRaised,
    onSurfaceVariant = TextSecondary,
    background = ColorVoid,
    onBackground = TextPrimary,
    outline = ColorPlateBorder,
    outlineVariant = ColorPlateSpecular,
  )

@Composable
fun FRIDAYMobileTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = FridayDarkColorScheme,
    typography = Typography,
    content = content,
  )
}
