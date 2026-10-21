package com.example.fridaymobile.ui.screens

import android.Manifest
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.audio.AudioRecorder
import com.example.fridaymobile.data.*
import com.example.fridaymobile.network.RemoteGatewayClient
import com.example.fridaymobile.theme.*
import com.example.fridaymobile.ui.components.*

/**
 * DashboardScreen — Synchronized with Desktop FRIDAY Console & Watermelon UI.
 */
@Composable
fun DashboardScreen(
  gatewayClient: RemoteGatewayClient,
  audioRecorder: AudioRecorder,
  onNavigateSettings: () -> Unit,
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val connectionStatus by gatewayClient.connectionStatus.collectAsState()
  val fridayState by gatewayClient.fridayState.collectAsState()
  val telemetry by gatewayClient.telemetry.collectAsState()
  val utterance by gatewayClient.utterance.collectAsState()
  val pendingConfirmation by gatewayClient.pendingConfirmation.collectAsState()
  val screenPeekUrl by gatewayClient.screenPeekUrl.collectAsState()
  val visualizerLevel by gatewayClient.audioVisualizerLevel.collectAsState()

  var isRecording by remember { mutableStateOf(false) }

  // High-fidelity desktop preview state when standalone
  var demoUtterance by remember {
    mutableStateOf(
      UtteranceContract(
        heard = HeardState("Open Spotify and play synthwave chill", isFinal = true),
        plan = listOf(
          PlanStep("1", "Focus Spotify app on Windows", "green", "completed"),
          PlanStep("2", "Start synthwave chill radio", "green", "completed"),
          PlanStep("3", "Adjust system volume to 65%", "amber", "completed")
        ),
        doing = DoingState("Execution completed in 142ms", 142L),
        result = ResultState(
          summary = "Spotify is now playing Synthwave Radio on Windows",
          isReversible = true,
          actionId = "sample_act_1"
        )
      )
    )
  }

  var demoPendingConfirmation by remember {
    mutableStateOf<ConfirmationRequest?>(null)
  }

  val isOnline = connectionStatus == ConnectionStatus.CONNECTED
  val effectiveUtterance = if (isOnline || utterance.heard != null) utterance else demoUtterance
  val effectiveConfirmation = pendingConfirmation ?: demoPendingConfirmation
  val effectiveTelemetry = if (isOnline) telemetry else DesktopTelemetry(
    cpuUsage = 18.4f,
    memoryUsage = 42.1f,
    activeWindow = "Visual Studio Code",
    latencyMs = 14L
  )

  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { isGranted ->
    if (!isGranted) {
      Toast.makeText(context, "Microphone permission required for voice PTT", Toast.LENGTH_SHORT).show()
    }
  }

  Scaffold(
    containerColor = ColorVoid,
    bottomBar = {
      VoicePttBar(
        state = fridayState,
        isRecording = isRecording,
        onStartPtt = {
          if (!audioRecorder.hasPermission) {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
          } else {
            val started = audioRecorder.startRecording(
              onAmplitude = { amp -> gatewayClient.setVisualizerLevel(amp) },
              onChunk = { pcmChunk -> gatewayClient.sendVoiceChunk(pcmChunk) }
            )
            if (started) {
              isRecording = true
            }
          }
        },
        onStopPtt = {
          if (isRecording) {
            audioRecorder.stopRecording()
            isRecording = false
            gatewayClient.setVisualizerLevel(0f)
            gatewayClient.sendAction("speech_end")
            if (!isOnline) {
              demoUtterance = UtteranceContract(
                heard = HeardState("Voice turn captured via microphone", isFinal = true),
                plan = listOf(PlanStep("1", "Process instruction through desktop engine", "green", "completed")),
                result = ResultState("Voice turn processed (Preview Mode)", isReversible = true, actionId = "act_voice")
              )
            }
          }
        },
        onSubmitText = { text ->
          if (isOnline) {
            gatewayClient.sendQuery(text)
          } else {
            demoUtterance = UtteranceContract(
              heard = HeardState(text, isFinal = true),
              plan = listOf(PlanStep("1", "Execute '$text' on Windows", "green", "completed")),
              result = ResultState("Executed: $text (Preview Mode)", isReversible = true, actionId = "act_text")
            )
          }
        },
        onAbort = {
          gatewayClient.sendAction("abort")
          if (!isOnline) {
            demoPendingConfirmation = null
            demoUtterance = UtteranceContract(
              result = ResultState("Execution aborted by operator", isReversible = false)
            )
          }
        }
      )
    }
  ) { innerPadding ->
    Column(
      modifier = modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(horizontal = 16.dp)
        .verticalScroll(rememberScrollState()),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      // 1. Desktop Shell Header (Brand + Telemetry Badge + Settings)
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Text(
            text = "FRIDAY",
            color = ColorSignal,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp
          )
        }

        DesktopTelemetryPill(
          status = connectionStatus,
          telemetry = effectiveTelemetry
        )

        IconButton(
          onClick = onNavigateSettings,
          modifier = Modifier.size(36.dp)
        ) {
          Icon(
            imageVector = Icons.Default.Settings,
            contentDescription = "Settings",
            tint = TextSecondary,
            modifier = Modifier.size(18.dp)
          )
        }
      }

      // Preview Mode Top Pill Banner
      if (!isOnline) {
        Surface(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onNavigateSettings() },
          color = ColorPlateRaised,
          border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
          )
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              Icon(
                imageVector = Icons.Default.Info,
                contentDescription = "Preview",
                tint = ColorSignal,
                modifier = Modifier.size(15.dp)
              )
              Text(
                text = "STANDALONE PREVIEW",
                color = TextSecondary,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
              )
            }
            Text(
              text = "PAIR GATEWAY →",
              color = ColorSignal,
              fontFamily = FontFamily.Monospace,
              fontSize = 10.sp,
              fontWeight = FontWeight.Bold,
              letterSpacing = 0.5.sp
            )
          }
        }
      }

      // 2. Central Reactive Voice Orb (Atmospheric Signal Violet)
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
      ) {
        MobileVoiceOrb(
          state = fridayState,
          amplitude = visualizerLevel
        )
      }

      // Interactive test buttons when in standalone preview
      if (!isOnline && effectiveConfirmation == null) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          OutlinedButton(
            onClick = {
              demoPendingConfirmation = ConfirmationRequest(
                id = "demo_amber",
                tier = "amber",
                prompt = "Change audio output device to USB Headphones?",
                details = "Redirects primary Windows audio sink."
              )
            },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = RiskAmber),
            border = CardDefaults.outlinedCardBorder().copy(
              brush = androidx.compose.ui.graphics.SolidColor(RiskAmber.copy(alpha = 0.35f))
            )
          ) {
            Text("Test Amber Card", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold)
          }

          OutlinedButton(
            onClick = {
              demoPendingConfirmation = ConfirmationRequest(
                id = "demo_red",
                tier = "red",
                prompt = "Force terminate background node process?",
                details = "Active development server will stop immediately."
              )
            },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = RiskRed),
            border = CardDefaults.outlinedCardBorder().copy(
              brush = androidx.compose.ui.graphics.SolidColor(RiskRed.copy(alpha = 0.35f))
            )
          ) {
            Text("Test SlideConfirm", fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Bold)
          }
        }
      }

      // 3. Confirmation Dialog / Card (Desktop InteractivePlanCard replica)
      effectiveConfirmation?.let { conf ->
        val isRedTier = conf.tier.lowercase() == "red"
        val tierColor = if (isRedTier) RiskRed else RiskAmber

        Surface(
          modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
          shape = RoundedCornerShape(16.dp),
          color = ColorPlate,
          border = CardDefaults.outlinedCardBorder().copy(
            brush = androidx.compose.ui.graphics.SolidColor(tierColor.copy(alpha = 0.45f))
          )
        ) {
          Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              Box(
                modifier = Modifier
                  .size(8.dp)
                  .clip(CircleShape)
                  .background(tierColor)
              )
              Text(
                text = if (isRedTier) "CRITICAL CONFIRMATION REQUIRED" else "PLAN AWAITING CONFIRMATION",
                color = tierColor,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                letterSpacing = 1.sp
              )
            }

            Text(
              text = conf.prompt,
              color = TextPrimary,
              fontSize = 13.sp,
              fontWeight = FontWeight.Medium,
              lineHeight = 18.sp
            )

            conf.details?.let { details ->
              Surface(
                modifier = Modifier.fillMaxWidth(),
                color = ColorVoid,
                shape = RoundedCornerShape(8.dp),
                border = CardDefaults.outlinedCardBorder().copy(
                  brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
                )
              ) {
                Text(
                  text = details,
                  color = TextSecondary,
                  fontFamily = FontFamily.Monospace,
                  fontSize = 11.sp,
                  modifier = Modifier.padding(10.dp)
                )
              }
            }

            if (isRedTier) {
              // Desktop SlideConfirm Replica
              SlideToConfirm(
                prompt = "Slide to authorize execution",
                confirmedLabel = "AUTHORIZED",
                tier = "red",
                onConfirmed = {
                  if (isOnline) {
                    gatewayClient.sendConfirmation(conf.id, true)
                  } else {
                    demoPendingConfirmation = null
                    demoUtterance = demoUtterance.copy(
                      result = ResultState("Critical action authorized via SlideConfirm", isReversible = false)
                    )
                  }
                }
              )
            } else {
              // Amber: 1-tap Go Ahead
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
              ) {
                OutlinedButton(
                  onClick = {
                    if (isOnline) {
                      gatewayClient.sendConfirmation(conf.id, false)
                    } else {
                      demoPendingConfirmation = null
                    }
                  },
                  modifier = Modifier.weight(1f).height(42.dp),
                  shape = RoundedCornerShape(10.dp),
                  colors = ButtonDefaults.outlinedButtonColors(contentColor = TextSecondary),
                  border = CardDefaults.outlinedCardBorder().copy(
                    brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
                  )
                ) {
                  Text("Cancel", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
                Button(
                  onClick = {
                    if (isOnline) {
                      gatewayClient.sendConfirmation(conf.id, true)
                    } else {
                      demoPendingConfirmation = null
                      demoUtterance = demoUtterance.copy(
                        result = ResultState("Plan confirmed and executed", isReversible = true, actionId = "act_amber")
                      )
                    }
                  },
                  modifier = Modifier.weight(1f).height(42.dp),
                  shape = RoundedCornerShape(10.dp),
                  colors = ButtonDefaults.buttonColors(containerColor = RiskAmber, contentColor = ColorVoid)
                ) {
                  Text("Go Ahead", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
              }
            }
          }
        }
      }

      // 4. Desktop Screen Peek Card
      DesktopScreenPeek(
        screenPeekUrl = screenPeekUrl,
        onRefresh = {
          if (isOnline) {
            gatewayClient.requestScreenPeek()
          } else {
            Toast.makeText(context, "Pair gateway to view live Windows screen", Toast.LENGTH_SHORT).show()
          }
        },
        modifier = Modifier.padding(bottom = 10.dp)
      )

      // 5. Utterance Contract View (Heard, Plan, Doing, Result)
      UtteranceContractView(
        utterance = effectiveUtterance,
        onUndoResult = { actionId ->
          if (isOnline) {
            gatewayClient.sendAction("undo:$actionId")
          } else {
            demoUtterance = UtteranceContract(
              result = ResultState("Action $actionId reversed successfully")
            )
          }
        },
        modifier = Modifier.padding(bottom = 16.dp)
      )
    }
  }
}
