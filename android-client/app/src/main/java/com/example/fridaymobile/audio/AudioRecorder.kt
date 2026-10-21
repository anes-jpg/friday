package com.example.fridaymobile.audio

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import kotlin.math.sqrt

class AudioRecorder(private val context: Context) {
  private val tag = "AudioRecorder"
  private val sampleRate = 16000
  private val channelConfig = AudioFormat.CHANNEL_IN_MONO
  private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

  private var audioRecord: AudioRecord? = null
  private var recordingJob: Job? = null
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  val hasPermission: Boolean
    get() = ContextCompat.checkSelfPermission(
      context,
      android.Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED

  @SuppressLint("MissingPermission")
  fun startRecording(
    onAmplitude: (Float) -> Unit,
    onChunk: (String) -> Unit
  ): Boolean {
    if (!hasPermission) {
      Log.w(tag, "Audio record permission not granted")
      return false
    }

    try {
      val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
      val bufferSize = (minBufferSize * 2).coerceAtLeast(2048)

      audioRecord = AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        sampleRate,
        channelConfig,
        audioFormat,
        bufferSize
      )

      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
        Log.e(tag, "AudioRecord could not be initialized")
        return false
      }

      audioRecord?.startRecording()

      recordingJob = scope.launch {
        val audioBuffer = ShortArray(1024)
        val byteBuffer = ByteArray(2048)

        while (isActive && audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
          val readCount = audioRecord?.read(audioBuffer, 0, audioBuffer.size) ?: -1
          if (readCount > 0) {
            // Compute RMS amplitude for visualizer
            var sum = 0.0
            for (i in 0 until readCount) {
              val sample = audioBuffer[i]
              sum += sample * sample

              // Convert short to little-endian bytes
              byteBuffer[i * 2] = (sample.toInt() and 0xFF).toByte()
              byteBuffer[i * 2 + 1] = ((sample.toInt() shr 8) and 0xFF).toByte()
            }

            val rms = sqrt(sum / readCount)
            val normalizedAmp = (rms / 32767.0).toFloat().coerceIn(0f, 1f)
            onAmplitude(normalizedAmp)

            // Send base64 chunk
            val validByteCount = readCount * 2
            val chunkBase64 = Base64.encodeToString(
              byteBuffer,
              0,
              validByteCount,
              Base64.NO_WRAP
            )
            onChunk(chunkBase64)
          }
        }
      }
      return true
    } catch (e: Exception) {
      Log.e(tag, "Error starting recording: ${e.message}", e)
      stopRecording()
      return false
    }
  }

  fun stopRecording() {
    recordingJob?.cancel()
    recordingJob = null
    try {
      if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
        audioRecord?.stop()
      }
      audioRecord?.release()
    } catch (e: Exception) {
      Log.w(tag, "Error stopping AudioRecord: ${e.message}")
    } finally {
      audioRecord = null
    }
  }
}
