package com.example.fridaymobile.data

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {
  private val prefs: SharedPreferences =
    context.getSharedPreferences("friday_prefs", Context.MODE_PRIVATE)

  var gatewayUrl: String
    get() = prefs.getString("gateway_url", "http://10.0.2.2:18420") ?: "http://10.0.2.2:18420"
    set(value) = prefs.edit().putString("gateway_url", value.trimEnd('/')).apply()

  var authToken: String?
    get() = prefs.getString("auth_token", null)
    set(value) = prefs.edit().putString("auth_token", value).apply()

  var lastPin: String
    get() = prefs.getString("last_pin", "") ?: ""
    set(value) = prefs.edit().putString("last_pin", value).apply()

  val isConfigured: Boolean
    get() = !authToken.isNullOrBlank()

  fun clearAuth() {
    prefs.edit().remove("auth_token").remove("last_pin").apply()
  }
}
