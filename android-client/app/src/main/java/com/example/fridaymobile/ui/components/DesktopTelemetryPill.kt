package com.example.fridaymobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.data.ConnectionStatus
import com.example.fridaymobile.data.DesktopTelemetry
import com.example.fridaymobile.theme.*

/**
 * DesktopTelemetryPill — Matches Desktop FRIDAY's WatermelonStatusBadge.
 * Pill with breathing dot, monospace font, and tabular metrics.
 */
@Composable
fun DesktopTelemetryPill(
  status: ConnectionStatus,
  telemetry: DesktopTelemetry,
  modifier: Modifier = Modifier
) {
  val (statusText, statusColor) = when (status) {
    ConnectionStatus.CONNECTED -> "ONLINE" to ColorSignal
    ConnectionStatus.CONNECTING -> "SYNCING" to RiskAmber
    ConnectionStatus.ERROR -> "FAULT" to RiskRed
    ConnectionStatus.DISCONNECTED -> "STANDALONE" to TextMuted
  }

  Row(
    modifier = modifier
      .clip(RoundedCornerShape(20.dp))
      .background(ColorPlateRaised)
      .border(1.dp, ColorPlateBorder, RoundedCornerShape(20.dp))
      .padding(horizontal = 10.dp, vertical = 5.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(7.dp)
  ) {
    // Breathing Status Dot
    Box(
      modifier = Modifier
        .size(6.dp)
        .clip(CircleShape)
        .background(statusColor)
    )

    Text(
      text = statusText,
      color = statusColor,
      fontFamily = FontFamily.Monospace,
      fontSize = 10.sp,
      fontWeight = FontWeight.Bold,
      letterSpacing = 0.5.sp
    )

    if (status == ConnectionStatus.CONNECTED) {
      Text(
        text = "•",
        color = ColorPlateBorder,
        fontSize = 10.sp
      )

      Text(
        text = telemetry.activeWindow.ifBlank { "Desktop" },
        color = TextSecondary,
        fontFamily = FontFamily.Monospace,
        fontSize = 10.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.widthIn(max = 110.dp)
      )

      if (telemetry.latencyMs > 0) {
        Text(
          text = "${telemetry.latencyMs}ms",
          color = TextMuted,
          fontFamily = FontFamily.Monospace,
          fontSize = 10.sp
        )
      }
    }
  }
}
