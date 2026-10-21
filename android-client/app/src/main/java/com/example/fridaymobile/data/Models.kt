package com.example.fridaymobile.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

enum class ConnectionStatus {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  ERROR
}

enum class FridayState {
  IDLE,
  LISTENING,
  THINKING,
  EXECUTING,
  SPEAKING,
  CONFIRMING
}

@Serializable
data class HeardState(
  val transcript: String = "",
  val isFinal: Boolean = false,
  val timestampMs: Long = 0L
)

@Serializable
data class PlanStep(
  val id: String = "",
  val title: String = "",
  val risk: String = "green", // green, amber, red
  val status: String = "pending" // pending, in_progress, completed, failed
)

@Serializable
data class DoingState(
  val activeStep: String = "",
  val elapsedMs: Long = 0L,
  val totalSteps: Int = 0,
  val currentStepIndex: Int = 0
)

@Serializable
data class ResultState(
  val summary: String = "",
  val isReversible: Boolean = false,
  val actionId: String? = null,
  val timestampMs: Long = 0L
)

@Serializable
data class UtteranceContract(
  val heard: HeardState? = null,
  val plan: List<PlanStep> = emptyList(),
  val doing: DoingState? = null,
  val result: ResultState? = null
)

@Serializable
data class ConfirmationRequest(
  val id: String,
  val tier: String, // amber, red
  val prompt: String,
  val details: String? = null,
  val timeoutSeconds: Int = 8
)

@Serializable
data class DesktopTelemetry(
  val cpuUsage: Float = 0f,
  val memoryUsage: Float = 0f,
  val activeWindow: String = "Desktop",
  val latencyMs: Long = 0L,
  val networkIp: String = "127.0.0.1",
  val state: String = "idle"
)

@Serializable
data class PairingRequest(
  val pin: String,
  val deviceName: String = "FRIDAY Mobile"
)

@Serializable
data class PairingResponse(
  val success: Boolean,
  val token: String? = null,
  val message: String? = null
)

@Serializable
data class GatewayMessage(
  val type: String, // "telemetry", "utterance", "confirmation_req", "state", "screen_peek_ready", "pong", "error"
  val payload: JsonElement? = null
)

@Serializable
data class ClientMessage(
  val type: String, // "ping", "query", "voice_chunk", "confirm", "peek_request", "action"
  val token: String? = null,
  val query: String? = null,
  val confirmationId: String? = null,
  val confirmed: Boolean? = null,
  val action: String? = null,
  val pcmBase64: String? = null
)
