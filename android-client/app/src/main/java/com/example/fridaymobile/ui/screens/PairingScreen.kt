package com.example.fridaymobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lan
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.data.PreferencesManager
import com.example.fridaymobile.network.RemoteGatewayClient
import com.example.fridaymobile.theme.*
import kotlinx.coroutines.launch

@Composable
fun PairingScreen(
  gatewayClient: RemoteGatewayClient,
  preferences: PreferencesManager,
  onPaired: () -> Unit,
  onSkip: () -> Unit,
  modifier: Modifier = Modifier
) {
  val scope = rememberCoroutineScope()
  var serverUrl by remember { mutableStateOf(preferences.gatewayUrl) }
  var pin by remember { mutableStateOf(preferences.lastPin) }
  var isPairing by remember { mutableStateOf(false) }
  var errorMessage by remember { mutableStateOf<String?>(null) }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(ColorVoid)
  ) {
    // Top Skip Action
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 16.dp),
      horizontalArrangement = Arrangement.End,
      verticalAlignment = Alignment.CenterVertically
    ) {
      TextButton(
        onClick = onSkip,
        colors = ButtonDefaults.textButtonColors(contentColor = ColorSignal)
      ) {
        Text("Skip to UI", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(modifier = Modifier.width(4.dp))
        Icon(
          imageVector = Icons.AutoMirrored.Filled.ArrowForward,
          contentDescription = "Skip",
          modifier = Modifier.size(14.dp),
          tint = ColorSignal
        )
      }
    }

    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(24.dp),
      verticalArrangement = Arrangement.Center,
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      // Brand Header
      Text(
        text = "FRIDAY",
        color = ColorSignal,
        fontSize = 32.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 2.sp
      )

      Box(
        modifier = Modifier
          .padding(top = 4.dp, bottom = 28.dp)
          .clip(RoundedCornerShape(6.dp))
          .background(ColorPlateRaised)
          .border(1.dp, ColorPlateBorder, RoundedCornerShape(6.dp))
          .padding(horizontal = 8.dp, vertical = 3.dp)
      ) {
        Text(
          text = "OPERATOR GATEWAY",
          color = TextSecondary,
          fontFamily = FontFamily.Monospace,
          fontSize = 10.sp,
          fontWeight = FontWeight.Bold,
          letterSpacing = 1.sp
        )
      }

      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(
          modifier = Modifier.padding(20.dp),
          verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
          Text(
            text = "Pair with Desktop Gateway",
            color = TextPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold
          )

          // Gateway URL Field
          OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it; errorMessage = null },
            label = { Text("Gateway URL", color = TextSecondary, fontSize = 12.sp) },
            placeholder = { Text("http://192.168.1.x:18420", color = TextMuted, fontSize = 13.sp) },
            leadingIcon = {
              Icon(Icons.Default.Lan, contentDescription = "Gateway URL", tint = TextSecondary, modifier = Modifier.size(18.dp))
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = ColorVoid,
              unfocusedContainerColor = ColorVoid,
              focusedBorderColor = ColorSignal,
              unfocusedBorderColor = ColorPlateBorder,
              focusedTextColor = TextPrimary,
              unfocusedTextColor = TextPrimary
            )
          )

          // 6-Digit PIN Field
          OutlinedTextField(
            value = pin,
            onValueChange = {
              if (it.length <= 6) {
                pin = it
                errorMessage = null
              }
            },
            label = { Text("6-Digit Pairing PIN", color = TextSecondary, fontSize = 12.sp) },
            placeholder = { Text("749201", color = TextMuted, fontSize = 13.sp) },
            leadingIcon = {
              Icon(Icons.Default.Key, contentDescription = "PIN", tint = TextSecondary, modifier = Modifier.size(18.dp))
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
              keyboardType = KeyboardType.Number,
              imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(onDone = {
              if (pin.length == 6 && !isPairing) {
                isPairing = true
                scope.launch {
                  val result = gatewayClient.pair(serverUrl, pin)
                  isPairing = false
                  result.onSuccess { onPaired() }
                    .onFailure { errorMessage = it.message ?: "Failed to pair with gateway" }
                }
              }
            }),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
              focusedContainerColor = ColorVoid,
              unfocusedContainerColor = ColorVoid,
              focusedBorderColor = ColorSignal,
              unfocusedBorderColor = ColorPlateBorder,
              focusedTextColor = TextPrimary,
              unfocusedTextColor = TextPrimary
            )
          )

          errorMessage?.let { msg ->
            Text(
              text = msg,
              color = RiskRed,
              fontFamily = FontFamily.Monospace,
              fontSize = 11.sp,
              fontWeight = FontWeight.Medium
            )
          }

          // Pair Button
          Button(
            onClick = {
              if (pin.isNotBlank() && !isPairing) {
                isPairing = true
                errorMessage = null
                scope.launch {
                  val result = gatewayClient.pair(serverUrl, pin)
                  isPairing = false
                  result.onSuccess { onPaired() }
                    .onFailure { errorMessage = it.message ?: "Failed to pair with gateway" }
                }
              }
            },
            enabled = !isPairing && pin.length >= 4,
            modifier = Modifier
              .fillMaxWidth()
              .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
              containerColor = ColorSignal,
              contentColor = ColorVoid,
              disabledContainerColor = ColorPlateRaised,
              disabledContentColor = TextDisabled
            )
          ) {
            if (isPairing) {
              CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = ColorVoid,
                strokeWidth = 2.dp
              )
            } else {
              Text("CONNECT & PAIR", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
          }

          // Skip to UI (Preview Mode) Button
          OutlinedButton(
            onClick = onSkip,
            modifier = Modifier
              .fillMaxWidth()
              .height(44.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(
              contentColor = TextPrimary
            ),
            border = CardDefaults.outlinedCardBorder().copy(
              brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
            )
          ) {
            Icon(
              imageVector = Icons.Default.Visibility,
              contentDescription = "Preview",
              modifier = Modifier.size(15.dp),
              tint = TextSecondary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Preview UI (Standalone Mode)", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium, fontSize = 12.sp)
          }
        }
      }

      // Presets
      Spacer(modifier = Modifier.height(16.dp))
      Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        TextButton(onClick = { serverUrl = "http://10.0.2.2:18420" }) {
          Text("Emulator (10.0.2.2)", color = TextSecondary, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
        TextButton(onClick = { serverUrl = "http://192.168.1.3:18420" }) {
          Text("LAN (192.168.1.3)", color = TextSecondary, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
        }
      }
    }
  }
}
