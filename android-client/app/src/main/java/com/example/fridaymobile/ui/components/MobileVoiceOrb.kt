package com.example.fridaymobile.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.example.fridaymobile.data.FridayState
import com.example.fridaymobile.theme.*
import kotlin.math.*

/**
 * 3D Point on unit sphere
 */
private data class Point3D(val x: Float, val y: Float, val z: Float)

/**
 * MobileVoiceOrb — 3D Animated Thinking Orb (Synchronized with Desktop FridayOrb).
 *
 * Sourced from thinkingorbs.com:
 * - 3D Fibonacci sphere distribution with true 3D Euler rotations (Yaw, Pitch, Roll).
 * - 3D stereoscopic depth projection: front dots are larger, brighter with specular cores;
 *   back dots are dimmer and smaller.
 * - Reactive Agent States:
 *   - IDLE (base): Calm, hypnotic 3D particle sphere revolving in space.
 *   - LISTENING (waiting): Acoustic expansion modulated by real-time mic amplitude with ripple waves.
 *   - THINKING (reasoning): High-speed dual orbital rotation with traveling energetic spark trails.
 *   - SPEAKING (working-gyro): 3D gyroscopic wobble with harmonic audio breathing.
 */
@Composable
fun MobileVoiceOrb(
  state: FridayState,
  amplitude: Float = 0f,
  modifier: Modifier = Modifier
) {
  // Precompute 72 Fibonacci sphere 3D points
  val basePoints = remember {
    val count = 72
    val golden = PI * (3.0 - sqrt(5.0))
    List(count) { i ->
      val y = (1.0 - (2.0 * (i + 0.5)) / count).toFloat()
      val r = sqrt(max(0.0, 1.0 - y * y)).toFloat()
      val th = (i * golden).toFloat()
      Point3D(
        x = r * cos(th),
        y = y,
        z = r * sin(th)
      )
    }
  }

  // Smooth continuous animation transitions
  val infiniteTransition = rememberInfiniteTransition(label = "Orb3DAnimation")

  // Yaw Rotation: continuous 3D spin around Y axis
  val yawDuration = when (state) {
    FridayState.THINKING -> 2800
    FridayState.SPEAKING -> 4000
    FridayState.LISTENING -> 5500
    FridayState.IDLE -> 7500
    else -> 7500
  }

  val yawAngle by infiniteTransition.animateFloat(
    initialValue = 0f,
    targetValue = (2 * PI).toFloat(),
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = yawDuration, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "yawAngle"
  )

  // Gyroscopic Harmonic Wobble
  val gyroAngle by infiniteTransition.animateFloat(
    initialValue = 0f,
    targetValue = (2 * PI).toFloat(),
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 3600, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "gyroAngle"
  )

  // Subtle breathing pulse
  val breathingPulse by infiniteTransition.animateFloat(
    initialValue = 1.0f,
    targetValue = 1.12f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
      repeatMode = RepeatMode.Reverse
    ),
    label = "breathingPulse"
  )

  // Traveling spark progress for THINKING state
  val sparkProgress by infiniteTransition.animateFloat(
    initialValue = 0f,
    targetValue = basePoints.size.toFloat(),
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 2000, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "sparkProgress"
  )

  Box(
    modifier = modifier.size(150.dp),
    contentAlignment = Alignment.Center
  ) {
    Canvas(modifier = Modifier.size(130.dp)) {
      val center = Offset(size.width / 2f, size.height / 2f)
      val baseSphereRadius = 42.dp.toPx()

      // Calculate state-driven dynamic radius and rotations
      val ampMod = amplitude.coerceIn(0f, 1f)
      val dynamicRadius = when (state) {
        FridayState.LISTENING -> baseSphereRadius * (1.0f + ampMod * 0.45f)
        FridayState.SPEAKING -> baseSphereRadius * (0.95f + (sin(gyroAngle * 2) * 0.08f) + (ampMod * 0.2f))
        FridayState.THINKING -> baseSphereRadius * 1.04f
        else -> baseSphereRadius * breathingPulse
      }

      // Pitch (X-tilt) and Roll (Z-wobble)
      val basePitch = Math.toRadians(22.0).toFloat()
      val (pitch, roll) = when (state) {
        FridayState.SPEAKING -> {
          val p = basePitch + (sin(gyroAngle) * 0.22f)
          val r = (cos(gyroAngle) * 0.26f)
          p to r
        }
        FridayState.THINKING -> {
          val p = basePitch + (sin(gyroAngle * 1.5f) * 0.15f)
          val r = (cos(gyroAngle * 1.5f) * 0.18f)
          p to r
        }
        FridayState.LISTENING -> {
          (basePitch + ampMod * 0.1f) to 0f
        }
        else -> {
          basePitch to 0f
        }
      }

      // Precalculate trig values
      val cosY = cos(yawAngle)
      val sinY = sin(yawAngle)
      val cosP = cos(pitch)
      val sinP = sin(pitch)
      val cosR = cos(roll)
      val sinR = sin(roll)

      // 1. Atmospheric Ambient Glow
      drawCircle(
        color = Color(0x1F9B86FF),
        radius = dynamicRadius + 22.dp.toPx()
      )
      drawCircle(
        color = Color(0x339B86FF),
        radius = dynamicRadius + 10.dp.toPx()
      )

      // 2. Listening: Acoustic ripple wave rings
      if (state == FridayState.LISTENING) {
        val rippleRadius = dynamicRadius + 8.dp.toPx() + (ampMod * 16.dp.toPx())
        drawCircle(
          color = Color(0x4D9B86FF),
          radius = rippleRadius,
          style = Stroke(width = 1.5.dp.toPx())
        )
      }

      // 3. Central Luminous Core (soft ethereal inner glow)
      drawCircle(
        brush = Brush.radialGradient(
          colors = listOf(
            Color(0x599B86FF),
            Color(0x267C3AED),
            Color.Transparent
          ),
          center = center,
          radius = dynamicRadius * 0.9f
        ),
        radius = dynamicRadius * 0.9f
      )

      // 4. Project and rotate all 3D points
      class ProjectedDot(
        val screenX: Float,
        val screenY: Float,
        val z: Float,
        val originalIndex: Int
      )

      val projectedDots = basePoints.mapIndexed { idx, p ->
        // Yaw (around Y axis)
        val x1 = p.x * cosY + p.z * sinY
        val y1 = p.y
        val z1 = -p.x * sinY + p.z * cosY

        // Pitch (around X axis)
        val x2 = x1
        val y2 = y1 * cosP - z1 * sinP
        val z2 = y1 * sinP + z1 * cosP

        // Roll (around Z axis)
        val x3 = x2 * cosR - y2 * sinR
        val y3 = x2 * sinR + y2 * cosR
        val z3 = z2

        ProjectedDot(
          screenX = center.x + x3 * dynamicRadius,
          screenY = center.y + y3 * dynamicRadius,
          z = z3,
          originalIndex = idx
        )
      }

      // Separate back dots from front dots for true 3D depth rendering
      val backDots = projectedDots.filter { it.z < 0f }
      val frontDots = projectedDots.filter { it.z >= 0f }

      val currentSparkIndex = sparkProgress.toInt() % basePoints.size
      val sparkIndex2 = (currentSparkIndex + basePoints.size / 2) % basePoints.size

      // Draw BACK DOTS (dimmer, smaller, creates 3D stereoscopic depth)
      backDots.forEach { dot ->
        val depthRatio = ((dot.z + 1.0f) / 1.0f).coerceIn(0.15f, 1.0f)
        val dotRadius = 1.4.dp.toPx() * (0.6f + depthRatio * 0.4f)
        val alpha = 0.25f + depthRatio * 0.35f

        drawCircle(
          color = Color(0xFF6B5A9E).copy(alpha = alpha),
          radius = dotRadius,
          center = Offset(dot.screenX, dot.screenY)
        )
      }

      // Draw FRONT DOTS (crisp, luminous, stark white core with violet specular glow)
      frontDots.forEach { dot ->
        val depthRatio = (dot.z).coerceIn(0f, 1f)
        val isSpark = state == FridayState.THINKING &&
          (dot.originalIndex == currentSparkIndex || dot.originalIndex == sparkIndex2)

        val baseRadiusDp = if (isSpark) 4.2.dp.toPx() else 2.4.dp.toPx()
        val dotRadius = baseRadiusDp * (0.85f + depthRatio * 0.45f)
        val alpha = (0.6f + depthRatio * 0.4f).coerceIn(0.6f, 1f)

        // Specular Violet Halo for front dots
        drawCircle(
          color = Color(0x669B86FF).copy(alpha = alpha * 0.5f),
          radius = dotRadius * 1.7f,
          center = Offset(dot.screenX, dot.screenY)
        )

        // Core Dot
        val dotColor = if (isSpark) Color(0xFFFFFFFF) else ColorSignal
        drawCircle(
          color = dotColor.copy(alpha = alpha),
          radius = dotRadius,
          center = Offset(dot.screenX, dot.screenY)
        )

        // Ultra-sharp white specular center glint on forward-facing dots
        if (depthRatio > 0.45f || isSpark) {
          drawCircle(
            color = Color.White.copy(alpha = if (isSpark) 1f else depthRatio),
            radius = dotRadius * 0.4f,
            center = Offset(dot.screenX - dotRadius * 0.15f, dot.screenY - dotRadius * 0.15f)
          )
        }
      }
    }
  }
}
