package com.example.fridaymobile.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.theme.*
import kotlin.math.roundToInt

/**
 * SlideToConfirm — Faithful reproduction of Desktop Watermelon UI's SlideConfirm primitive.
 * Height: 48dp, rounded-full pill, dark zinc-950 track with subtle risk border and circular light thumb.
 */
@Composable
fun SlideToConfirm(
  prompt: String = "Slide to authorize execution",
  confirmedLabel: String = "AUTHORIZED",
  tier: String = "red",
  onConfirmed: () -> Unit,
  modifier: Modifier = Modifier
) {
  val view = LocalView.current
  var containerWidth by remember { mutableIntStateOf(0) }
  val thumbSize = 40.dp
  var offsetX by remember { mutableFloatStateOf(0f) }
  var isTriggered by remember { mutableStateOf(false) }

  val accentColor = if (tier.lowercase() == "red") RiskRed else RiskAmber
  val maxDrag = (containerWidth - thumbSize.value * 2.8f).coerceAtLeast(0f)
  val dragProgress = if (maxDrag > 0f) (offsetX / maxDrag).coerceIn(0f, 1f) else 0f

  Box(
    modifier = modifier
      .fillMaxWidth()
      .height(48.dp)
      .clip(CircleShape)
      .background(ColorVoid)
      .border(1.dp, if (isTriggered) RiskGreen.copy(alpha = 0.6f) else accentColor.copy(alpha = 0.4f), CircleShape)
      .onSizeChanged { containerWidth = it.width },
    contentAlignment = Alignment.CenterStart
  ) {
    // Fill progress overlay
    Box(
      modifier = Modifier
        .fillMaxHeight()
        .width((offsetX + thumbSize.value).dp)
        .background(if (isTriggered) RiskGreen.copy(alpha = 0.25f) else accentColor.copy(alpha = 0.18f * dragProgress))
    )

    // Center Prompt Text (fades out as you slide)
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 48.dp),
      contentAlignment = Alignment.Center
    ) {
      if (isTriggered) {
        Text(
          text = confirmedLabel,
          color = RiskGreen,
          fontSize = 11.sp,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Bold,
          letterSpacing = 1.sp
        )
      } else {
        Text(
          text = prompt,
          color = if (dragProgress > 0.4f) accentColor else TextSecondary,
          fontSize = 11.sp,
          fontFamily = FontFamily.Monospace,
          fontWeight = FontWeight.Medium,
          letterSpacing = 0.5.sp,
          modifier = Modifier.padding(start = 12.dp)
        )
      }
    }

    // Draggable Circular Thumb (Matching Desktop SlideConfirm)
    Box(
      modifier = Modifier
        .offset { IntOffset(offsetX.roundToInt(), 0) }
        .padding(4.dp)
        .size(thumbSize)
        .clip(CircleShape)
        .background(if (isTriggered) RiskGreen else Color(0xFFF4F4F5))
        .draggable(
          orientation = Orientation.Horizontal,
          state = rememberDraggableState { delta ->
            if (!isTriggered) {
              val newOffset = (offsetX + delta).coerceIn(0f, maxDrag)
              offsetX = newOffset
              if (maxDrag > 0 && newOffset >= maxDrag * 0.88f) {
                isTriggered = true
                view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                onConfirmed()
              }
            }
          },
          onDragStopped = {
            if (!isTriggered) {
              offsetX = 0f
            }
          }
        ),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = if (isTriggered) Icons.Default.Check else Icons.AutoMirrored.Filled.ArrowForward,
        contentDescription = "Confirm Action",
        tint = if (isTriggered) ColorVoid else Color(0xFF09090B),
        modifier = Modifier.size(18.dp)
      )
    }
  }
}
