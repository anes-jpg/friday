package com.example.fridaymobile

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.fridaymobile.audio.AudioRecorder
import com.example.fridaymobile.data.PreferencesManager
import com.example.fridaymobile.network.RemoteGatewayClient
import com.example.fridaymobile.ui.screens.DashboardScreen
import com.example.fridaymobile.ui.screens.PairingScreen
import com.example.fridaymobile.ui.screens.SettingsScreen

@Composable
fun MainNavigation() {
  val context = LocalContext.current
  val preferences = remember { PreferencesManager(context) }
  val gatewayClient = remember {
    RemoteGatewayClient(preferences).also {
      if (preferences.isConfigured) {
        it.connect()
      }
    }
  }
  val audioRecorder = remember { AudioRecorder(context) }

  val initialKey = if (preferences.isConfigured) DashboardNavKey else PairingNavKey
  val backStack = rememberNavBackStack(initialKey)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider = entryProvider {
      entry<PairingNavKey> {
        PairingScreen(
          gatewayClient = gatewayClient,
          preferences = preferences,
          onPaired = {
            backStack.clear()
            backStack.add(DashboardNavKey)
          },
          onSkip = {
            backStack.clear()
            backStack.add(DashboardNavKey)
          },
          modifier = Modifier.safeDrawingPadding()
        )
      }

      entry<DashboardNavKey> {
        DashboardScreen(
          gatewayClient = gatewayClient,
          audioRecorder = audioRecorder,
          onNavigateSettings = {
            backStack.add(SettingsNavKey)
          },
          modifier = Modifier.safeDrawingPadding()
        )
      }

      entry<SettingsNavKey> {
        SettingsScreen(
          gatewayClient = gatewayClient,
          preferences = preferences,
          onNavigateBack = {
            backStack.removeLastOrNull()
          },
          onUnpair = {
            backStack.clear()
            backStack.add(PairingNavKey)
          },
          modifier = Modifier.safeDrawingPadding()
        )
      }
    }
  )
}
