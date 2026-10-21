package com.example.fridaymobile.network

import android.util.Log
import com.example.fridaymobile.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class RemoteGatewayClient(private val preferences: PreferencesManager) {
  private val tag = "RemoteGatewayClient"

  private val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
  }

  private val client = OkHttpClient.Builder()
    .readTimeout(10, TimeUnit.SECONDS)
    .writeTimeout(10, TimeUnit.SECONDS)
    .pingInterval(15, TimeUnit.SECONDS)
    .retryOnConnectionFailure(true)
    .build()

  private var webSocket: WebSocket? = null
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var reconnectJob: Job? = null

  private val _connectionStatus = MutableStateFlow(ConnectionStatus.DISCONNECTED)
  val connectionStatus: StateFlow<ConnectionStatus> = _connectionStatus.asStateFlow()

  private val _fridayState = MutableStateFlow(FridayState.IDLE)
  val fridayState: StateFlow<FridayState> = _fridayState.asStateFlow()

  private val _telemetry = MutableStateFlow(DesktopTelemetry())
  val telemetry: StateFlow<DesktopTelemetry> = _telemetry.asStateFlow()

  private val _utterance = MutableStateFlow(UtteranceContract())
  val utterance: StateFlow<UtteranceContract> = _utterance.asStateFlow()

  private val _pendingConfirmation = MutableStateFlow<ConfirmationRequest?>(null)
  val pendingConfirmation: StateFlow<ConfirmationRequest?> = _pendingConfirmation.asStateFlow()

  private val _screenPeekUrl = MutableStateFlow<String?>(null)
  val screenPeekUrl: StateFlow<String?> = _screenPeekUrl.asStateFlow()

  private val _audioVisualizerLevel = MutableStateFlow(0f)
  val audioVisualizerLevel: StateFlow<Float> = _audioVisualizerLevel.asStateFlow()

  suspend fun pair(url: String, pin: String): Result<String> = withContext(Dispatchers.IO) {
    val cleanUrl = url.trimEnd('/')
    val pairUrl = "$cleanUrl/api/pair"
    val reqBody = json.encodeToString(PairingRequest(pin = pin, deviceName = "FRIDAY Mobile"))
      .toRequestBody("application/json".toMediaType())

    val request = Request.Builder()
      .url(pairUrl)
      .post(reqBody)
      .build()

    try {
      client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) {
          return@withContext Result.failure(IOException("Server returned HTTP ${response.code}"))
        }
        val responseBody = response.body?.string() ?: ""
        val pairResp = json.decodeFromString<PairingResponse>(responseBody)
        if (pairResp.success && !pairResp.token.isNullOrBlank()) {
          preferences.gatewayUrl = cleanUrl
          preferences.authToken = pairResp.token
          preferences.lastPin = pin
          connect()
          Result.success(pairResp.token)
        } else {
          Result.failure(IOException(pairResp.message ?: "Invalid PIN"))
        }
      }
    } catch (e: Exception) {
      Log.e(tag, "Pairing error: ${e.message}", e)
      Result.failure(e)
    }
  }

  fun connect() {
    val token = preferences.authToken ?: return
    val baseUrl = preferences.gatewayUrl

    val wsUrl = if (baseUrl.startsWith("https://")) {
      baseUrl.replace("https://", "wss://") + "/api/ws?token=$token"
    } else {
      baseUrl.replace("http://", "ws://") + "/api/ws?token=$token"
    }

    _connectionStatus.value = ConnectionStatus.CONNECTING
    webSocket?.cancel()

    val request = Request.Builder().url(wsUrl).build()
    webSocket = client.newWebSocket(request, object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        Log.i(tag, "WebSocket connected successfully to $wsUrl")
        _connectionStatus.value = ConnectionStatus.CONNECTED
        reconnectJob?.cancel()
        // Immediately fetch initial screen peek
        requestScreenPeek()
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        handleInboundMessage(text)
      }

      override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(1000, null)
        _connectionStatus.value = ConnectionStatus.DISCONNECTED
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        Log.w(tag, "WebSocket failure: ${t.message}")
        _connectionStatus.value = ConnectionStatus.ERROR
        scheduleReconnect()
      }
    })
  }

  fun disconnect() {
    reconnectJob?.cancel()
    webSocket?.close(1000, "Client disconnected")
    webSocket = null
    _connectionStatus.value = ConnectionStatus.DISCONNECTED
    _fridayState.value = FridayState.IDLE
  }

  private fun scheduleReconnect() {
    reconnectJob?.cancel()
    reconnectJob = scope.launch {
      delay(3000)
      if (preferences.isConfigured && _connectionStatus.value != ConnectionStatus.CONNECTED) {
        Log.i(tag, "Attempting WebSocket reconnect...")
        connect()
      }
    }
  }

  private fun handleInboundMessage(text: String) {
    try {
      val msg = json.decodeFromString<GatewayMessage>(text)
      val payload = msg.payload ?: return

      when (msg.type) {
        "telemetry" -> {
          val telem = json.decodeFromJsonElement<DesktopTelemetry>(payload)
          _telemetry.value = telem
          mapDesktopState(telem.state)
        }
        "utterance" -> {
          val utt = json.decodeFromJsonElement<UtteranceContract>(payload)
          _utterance.value = utt
        }
        "confirmation_req" -> {
          val req = json.decodeFromJsonElement<ConfirmationRequest>(payload)
          _pendingConfirmation.value = req
          _fridayState.value = FridayState.CONFIRMING
        }
        "confirmation_cleared" -> {
          _pendingConfirmation.value = null
          if (_fridayState.value == FridayState.CONFIRMING) {
            _fridayState.value = FridayState.IDLE
          }
        }
        "state" -> {
          val stateStr = payload.toString().replace("\"", "").trim()
          mapDesktopState(stateStr)
        }
        "screen_peek_ready" -> {
          val peekUrl = "${preferences.gatewayUrl}/api/screen?t=${System.currentTimeMillis()}"
          _screenPeekUrl.value = peekUrl
        }
      }
    } catch (e: Exception) {
      Log.e(tag, "Error parsing message: $text", e)
    }
  }

  private fun mapDesktopState(stateStr: String) {
    _fridayState.value = when (stateStr.lowercase()) {
      "listening" -> FridayState.LISTENING
      "thinking" -> FridayState.THINKING
      "executing", "running" -> FridayState.EXECUTING
      "speaking", "narrating" -> FridayState.SPEAKING
      "confirming" -> FridayState.CONFIRMING
      else -> FridayState.IDLE
    }
  }

  fun sendQuery(text: String) {
    if (text.isBlank()) return
    sendClientMessage(ClientMessage(type = "query", query = text))
  }

  fun sendConfirmation(id: String, confirmed: Boolean) {
    sendClientMessage(ClientMessage(type = "confirm", confirmationId = id, confirmed = confirmed))
    _pendingConfirmation.value = null
    _fridayState.value = FridayState.IDLE
  }

  fun sendAction(action: String) {
    sendClientMessage(ClientMessage(type = "action", action = action))
  }

  fun sendVoiceChunk(pcmBase64: String) {
    sendClientMessage(ClientMessage(type = "voice_chunk", pcmBase64 = pcmBase64))
  }

  fun requestScreenPeek() {
    sendClientMessage(ClientMessage(type = "peek_request"))
    // Optimistically update peek url
    _screenPeekUrl.value = "${preferences.gatewayUrl}/api/screen?t=${System.currentTimeMillis()}"
  }

  fun setVisualizerLevel(level: Float) {
    _audioVisualizerLevel.value = level
  }

  private fun sendClientMessage(msg: ClientMessage) {
    val messageWithToken = msg.copy(token = preferences.authToken)
    val text = json.encodeToString(messageWithToken)
    webSocket?.send(text)
  }
}
