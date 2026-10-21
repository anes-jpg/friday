package com.example.fridaymobile.ui.components

import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.data.FridayState
import com.example.fridaymobile.theme.*

/**
 * VoicePttBar — Matches Desktop FRIDAY's floating voice / chat input dock.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun VoicePttBar(
  state: FridayState,
  isRecording: Boolean,
  onStartPtt: () -> Unit,
  onStopPtt: () -> Unit,
  onSubmitText: (String) -> Unit,
  onAbort: () -> Unit,
  modifier: Modifier = Modifier
) {
  val view = LocalView.current
  val keyboardController = LocalSoftwareKeyboardController.current
  var isTextMode by remember { mutableStateOf(false) }
  var textInput by remember { mutableStateOf("") }

  Surface(
    modifier = modifier.fillMaxWidth(),
    color = ColorHull,
    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    border = CardDefaults.outlinedCardBorder().copy(
      brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
    )
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 12.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      if (isTextMode) {
        // Text Prompt Mode
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          IconButton(
            onClick = { isTextMode = false },
            modifier = Modifier.size(38.dp)
          ) {
            Icon(
              imageVector = Icons.Default.Mic,
              contentDescription = "Voice Mode",
              tint = TextSecondary,
              modifier = Modifier.size(20.dp)
            )
          }

          TextField(
            value = textInput,
            onValueChange = { textInput = it },
            placeholder = { Text("Direct instruction to Windows...", color = TextMuted, fontSize = 13.sp) },
            singleLine = true,
            modifier = Modifier
              .weight(1f)
              .clip(RoundedCornerShape(12.dp)),
            colors = TextFieldDefaults.colors(
              focusedContainerColor = ColorVoid,
              unfocusedContainerColor = ColorVoid,
              focusedTextColor = TextPrimary,
              unfocusedTextColor = TextPrimary,
              focusedIndicatorColor = ColorSignal,
              unfocusedIndicatorColor = Color.Transparent
            ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = {
              if (textInput.isNotBlank()) {
                onSubmitText(textInput)
                textInput = ""
                keyboardController?.hide()
              }
            })
          )

          IconButton(
            onClick = {
              if (textInput.isNotBlank()) {
                onSubmitText(textInput)
                textInput = ""
                keyboardController?.hide()
              }
            },
            enabled = textInput.isNotBlank(),
            modifier = Modifier.size(38.dp)
          ) {
            Icon(
              imageVector = Icons.AutoMirrored.Filled.Send,
              contentDescription = "Send",
              tint = if (textInput.isNotBlank()) ColorSignal else TextDisabled,
              modifier = Modifier.size(18.dp)
            )
          }
        }
      } else {
        // Push-To-Talk Mode
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          // Switch to Text
          IconButton(
            onClick = { isTextMode = true },
            modifier = Modifier.size(40.dp)
          ) {
            Icon(
              imageVector = Icons.Default.Keyboard,
              contentDescription = "Type Command",
              tint = TextSecondary,
              modifier = Modifier.size(20.dp)
            )
          }

          // Center PTT Microphone Button
          Box(
            modifier = Modifier
              .size(66.dp)
              .clip(CircleShape)
              .background(if (isRecording) ColorSignal else ColorPlateRaised)
              .border(
                1.5.dp,
                if (isRecording) ColorSignalGlow else ColorPlateBorder,
                CircleShape
              )
              .pointerInteropFilter { event ->
                when (event.action) {
                  MotionEvent.ACTION_DOWN -> {
                    view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    onStartPtt()
                    true
                  }
                  MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    view.performHapticFeedback(HapticFeedbackConstants.GESTURE_END)
                    onStopPtt()
                    true
                  }
                  else -> false
                }
              },
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Default.Mic,
              contentDescription = "Push To Talk",
              tint = if (isRecording) ColorVoid else Color.White,
              modifier = Modifier.size(28.dp)
            )
          }

          // Abort Execution
          IconButton(
            onClick = onAbort,
            enabled = state == FridayState.EXECUTING || state == FridayState.SPEAKING,
            modifier = Modifier.size(40.dp)
          ) {
            Icon(
              imageVector = Icons.Default.StopCircle,
              contentDescription = "Abort Action",
              tint = if (state == FridayState.EXECUTING || state == FridayState.SPEAKING) RiskRed else Color(0x33FFFFFF),
              modifier = Modifier.size(22.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
          text = if (isRecording) "Listening • Release to execute" else "Hold to speak",
          color = if (isRecording) ColorSignal else TextMuted,
          fontFamily = FontFamily.Monospace,
          fontSize = 11.sp,
          fontWeight = FontWeight.Medium,
          letterSpacing = 0.5.sp
        )
      }
    }
  }
}
