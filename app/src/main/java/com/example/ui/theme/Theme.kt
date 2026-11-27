package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val DarkColorScheme = darkColorScheme(
    primary = EmeraldLight,
    onPrimary = Color(0xFF00382D),
    primaryContainer = EmeraldDeep,
    onPrimaryContainer = EmeraldSoftContainer,
    secondary = MarigoldLight,
    onSecondary = Color(0xFF451A03),
    secondaryContainer = Color(0xFF78350F),
    onSecondaryContainer = MarigoldSoftContainer,
    tertiary = TerracottaTertiary,
    background = DarkBackground,
    onBackground = CreamInk,
    surface = DarkSurface,
    onSurface = CreamInk,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = Color(0xFFBBC7C2),
    outline = Color(0xFF3E4D48)
)

private val LightColorScheme = lightColorScheme(
    primary = EmeraldDeep,
    onPrimary = Color.White,
    primaryContainer = EmeraldSoftContainer,
    onPrimaryContainer = EmeraldOnContainer,
    secondary = MarigoldAccent,
    onSecondary = Color.White,
    secondaryContainer = MarigoldSoftContainer,
    onSecondaryContainer = MarigoldOnContainer,
    tertiary = TerracottaTertiary,
    onTertiary = Color.White,
    background = IvoryBackground,
    onBackground = CharcoalInk,
    surface = IvorySurface,
    onSurface = CharcoalInk,
    surfaceVariant = WarmSandSurfaceVariant,
    onSurfaceVariant = MutedSlate,
    outline = WarmOutline
)

private val KajerManushShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

@Composable
fun KajerManushTheme(
    isBengali: Boolean = true,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val typography = remember(isBengali) { buildBilingualTypography(isBengali) }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = typography,
        shapes = KajerManushShapes,
        content = content
    )
}
