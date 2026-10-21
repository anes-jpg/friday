package com.example.fridaymobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.fridaymobile.data.ConnectionStatus
import com.example.fridaymobile.data.PreferencesManager
import com.example.fridaymobile.network.RemoteGatewayClient
import com.example.fridaymobile.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
  gatewayClient: RemoteGatewayClient,
  preferences: PreferencesManager,
  onNavigateBack: () -> Unit,
  onUnpair: () -> Unit,
  modifier: Modifier = Modifier
) {
  val connectionStatus by gatewayClient.connectionStatus.collectAsState()

  Scaffold(
    topBar = {
      TopAppBar(
        title = {
          Text(
            "GATEWAY SETTINGS",
            color = TextPrimary,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            letterSpacing = 1.sp
          )
        },
        navigationIcon = {
          IconButton(onClick = onNavigateBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = ColorVoid)
      )
    },
    containerColor = ColorVoid
  ) { innerPadding ->
    Column(
      modifier = modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(
            "CONNECTION TELEMETRY",
            color = TextSecondary,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text("Gateway URL", color = TextMuted, fontSize = 13.sp)
            Text(
              preferences.gatewayUrl,
              color = TextPrimary,
              fontFamily = FontFamily.Monospace,
              fontSize = 12.sp,
              fontWeight = FontWeight.Medium
            )
          }

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text("State", color = TextMuted, fontSize = 13.sp)
            Text(
              connectionStatus.name,
              color = if (connectionStatus == ConnectionStatus.CONNECTED) ColorSignal else RiskAmber,
              fontFamily = FontFamily.Monospace,
              fontSize = 12.sp,
              fontWeight = FontWeight.Bold
            )
          }

          Spacer(modifier = Modifier.height(4.dp))

          Button(
            onClick = { gatewayClient.connect() },
            modifier = Modifier.fillMaxWidth().height(42.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ColorPlateRaised, contentColor = TextPrimary)
          ) {
            Icon(Icons.Default.Refresh, contentDescription = "Reconnect", modifier = Modifier.size(15.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Force Reconnect", fontFamily = FontFamily.Monospace, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
          }
        }
      }

      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = ColorPlate,
        border = CardDefaults.outlinedCardBorder().copy(
          brush = androidx.compose.ui.graphics.SolidColor(ColorPlateBorder)
        )
      ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(
            "SECURITY & CREDENTIALS",
            color = TextSecondary,
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
          )
          Text(
            "Clears stored mutual pairing token and resets client into setup mode.",
            color = TextMuted,
            fontSize = 12.sp,
            lineHeight = 16.sp
          )

          OutlinedButton(
            onClick = {
              gatewayClient.disconnect()
              preferences.clearAuth()
              onUnpair()
            },
            modifier = Modifier.fillMaxWidth().height(42.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = RiskRed),
            border = CardDefaults.outlinedCardBorder().copy(
              brush = androidx.compose.ui.graphics.SolidColor(RiskRed.copy(alpha = 0.35f))
            )
          ) {
            Icon(Icons.Default.Delete, contentDescription = "Unpair", modifier = Modifier.size(15.dp), tint = RiskRed)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Unpair Device", fontFamily = FontFamily.Monospace, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
          }
        }
      }
    }
  }
}
