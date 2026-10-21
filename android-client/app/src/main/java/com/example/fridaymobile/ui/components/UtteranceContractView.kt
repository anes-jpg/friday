package com.example.fridaymobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.data.*
import com.example.fridaymobile.theme.*

/**
 * UtteranceContractView — Synchronized with Desktop FRIDAY's WatermelonBentoCard
 * and InteractivePlanCard styling.
 */
@Composable
fun UtteranceContractView(
  utterance: UtteranceContract,
  onUndoResult: (String) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val hasContent = utterance.heard != null ||
    utterance.plan.isNotEmpty() ||
    utterance.doing != null ||
    utterance.result != null

  if (!hasContent) {
    Box(
      modifier = modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(16.dp))
        .background(ColorPlate)
        .border(1.dp, ColorPlateBorder, RoundedCornerShape(16.dp))
        .padding(20.dp),
      contentAlignment = Alignment.Center
    ) {
      Text(
        text = "Hold PTT or speak to FRIDAY",
        color = TextMuted,
        fontFamily = FontFamily.Monospace,
        fontSize = 12.sp,
        letterSpacing = 0.5.sp
      )
    }
    return
  }

  Column(
    modifier = modifier.fillMaxWidth(),
    verticalArrangement = Arrangement.spacedBy(10.dp)
  ) {
    // 1. HEARD CARD (Desktop Watermelon Bento)
    utterance.heard?.let { heard ->
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Box(
              modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(ColorSignalMuted)
                .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
              Text(
                text = "HEARD",
                color = ColorSignal,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
              )
            }
          }
          Spacer(modifier = Modifier.height(8.dp))
          Text(
            text = heard.transcript.ifBlank { "Listening..." },
            color = TextPrimary,
            fontSize = 13.sp,
            lineHeight = 18.sp
          )
        }
      }
    }

    // 2. PLAN CARD (Desktop InteractivePlanCard)
    if (utterance.plan.isNotEmpty()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Box(
              modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0x1AFFFFFF))
                .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
              Text(
                text = "PLAN",
                color = TextSecondary,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
              )
            }
          }
          Spacer(modifier = Modifier.height(10.dp))
          utterance.plan.forEachIndexed { index, step ->
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
              // Risk color dot (Matching desktop rose, amber, emerald)
              val dotColor = when (step.risk.lowercase()) {
                "red" -> RiskRed
                "amber" -> RiskAmber
                else -> RiskGreen
              }
              Box(
                modifier = Modifier
                  .size(7.dp)
                  .clip(CircleShape)
                  .background(dotColor)
              )
              Text(
                text = "${index + 1}. ${step.title}",
                color = if (step.status == "completed") TextMuted else TextPrimary,
                fontSize = 13.sp,
                fontFamily = FontFamily.SansSerif
              )
            }
          }
        }
      }
    }

    // 3. DOING CARD (Desktop Step Execution)
    utterance.doing?.let { doing ->
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(14.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            CircularProgressIndicator(
              modifier = Modifier.size(14.dp),
              color = ColorSignal,
              strokeWidth = 2.dp
            )
            Text(
              text = doing.activeStep,
              color = TextPrimary,
              fontSize = 13.sp,
              fontWeight = FontWeight.Medium
            )
          }

          Box(
            modifier = Modifier
              .clip(RoundedCornerShape(6.dp))
              .background(ColorVoid)
              .border(1.dp, ColorPlateBorder, RoundedCornerShape(6.dp))
              .padding(horizontal = 7.dp, vertical = 2.dp)
          ) {
            Text(
              text = "${doing.elapsedMs}ms",
              color = ColorSignal,
              fontFamily = FontFamily.Monospace,
              fontSize = 11.sp,
              fontWeight = FontWeight.SemiBold
            )
          }
        }
      }
    }

    // 4. RESULT CARD (Desktop Result Display & Undo)
    utterance.result?.let { result ->
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlateRaised,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            Box(
              modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(RiskGreenMuted)
                .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
              Text(
                text = "RESULT",
                color = RiskGreen,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
              )
            }

            if (result.isReversible && result.actionId != null) {
              Surface(
                onClick = { onUndoResult(result.actionId) },
                shape = RoundedCornerShape(8.dp),
                color = RiskAmberMuted,
                border = CardDefaults.outlinedCardBorder().copy(
                  brush = androidx.compose.ui.graphics.SolidColor(RiskAmber.copy(alpha = 0.35f))
                )
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                  Icon(
                    imageVector = Icons.AutoMirrored.Filled.Undo,
                    contentDescription = "Undo",
                    tint = RiskAmber,
                    modifier = Modifier.size(12.dp)
                  )
                  Text(
                    text = "Undo",
                    color = RiskAmber,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                  )
                }
              }
            }
          }
          Spacer(modifier = Modifier.height(6.dp))
          Text(
            text = result.summary,
            color = TextPrimary,
            fontSize = 13.sp,
            lineHeight = 18.sp
          )
        }
      }
    }
  }
}
