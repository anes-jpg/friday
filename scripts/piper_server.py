#!/usr/bin/env python3
"""
FRIDAY Piper Neural TTS Server
Provides local, ultra-fast neural speech synthesis via Rhasspy Piper ONNX.
Compatible with OpenAI-compatible /v1/audio/speech endpoint for seamless integration.
"""

import sys
import os
import io
import json
import wave
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path

# Locate Piper models directory
BASE_DIR = Path(__file__).resolve().parent.parent
possible_dirs = [
    BASE_DIR / "models" / "piper",
    BASE_DIR / "resources" / "models" / "piper",
    Path(sys.executable).parent.parent / "models" / "piper",
    Path.home() / ".cache" / "friday" / "piper",
]
MODELS_DIR = next((d for d in possible_dirs if d.exists()), possible_dirs[0])

# Voice Registry
VOICES = {}
DEFAULT_VOICE = "en_GB-alba-medium"

def load_voices():
    global VOICES
    try:
        from piper import PiperVoice
    except ImportError:
        print("[Piper Server] ERROR: piper-tts is not installed. Run: pip install piper-tts", file=sys.stderr)
        return

    candidates = {
        "en_GB-alba-medium": MODELS_DIR / "en_GB-alba-medium.onnx",
        "en_US-amy-medium": MODELS_DIR / "en_US-amy-medium.onnx",
    }

    for name, onnx_path in candidates.items():
        json_path = onnx_path.with_suffix(".onnx.json")
        if onnx_path.exists() and json_path.exists():
            try:
                t0 = time.time()
                print(f"[Piper Server] Loading voice '{name}' from {onnx_path}...")
                voice = PiperVoice.load(str(onnx_path), str(json_path))
                VOICES[name] = voice
                # Register aliases
                if "alba" in name:
                    VOICES["alba"] = voice
                    VOICES["bf_emma"] = voice
                    VOICES["friday-irish"] = voice
                    VOICES["friday-british"] = voice
                elif "amy" in name:
                    VOICES["amy"] = voice
                    VOICES["af_heart"] = voice
                    VOICES["af_bella"] = voice
                    VOICES["af_nicole"] = voice
                    VOICES["af_sky"] = voice
                    VOICES["friday-warm"] = voice
                print(f"[Piper Server] Loaded '{name}' in {time.time() - t0:.2f}s")
            except Exception as e:
                print(f"[Piper Server] Failed to load voice '{name}': {e}", file=sys.stderr)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class PiperRequestHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path in ("/health", "/v1/health", "/"):
            body = json.dumps({
                "status": "ok",
                "engine": "piper-tts",
                "voices": list(VOICES.keys()),
                "default_voice": DEFAULT_VOICE,
                "timestamp": int(time.time()),
            }).encode("utf-8")
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ("/v1/audio/speech", "/audio/speech"):
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_response(400)
                self.end_headers()
                return

            req_body = self.rfile.read(content_length)
            try:
                data = json.loads(req_body.decode("utf-8"))
            except Exception:
                self.send_response(400)
                self.end_headers()
                return

            text = data.get("input") or data.get("text", "")
            req_voice = data.get("voice", DEFAULT_VOICE)

            if not text.strip():
                self.send_response(400)
                self.end_headers()
                return

            # Resolve voice model
            voice = VOICES.get(req_voice) or VOICES.get(DEFAULT_VOICE)
            if not voice and VOICES:
                voice = next(iter(VOICES.values()))

            if not voice:
                self.send_response(503)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                err_msg = json.dumps({"error": "No Piper voice models loaded"}).encode("utf-8")
                self.send_header("Content-Length", str(len(err_msg)))
                self.end_headers()
                self.wfile.write(err_msg)
                return

            try:
                t0 = time.time()
                with io.BytesIO() as wav_io:
                    with wave.open(wav_io, "wb") as wav_file:
                        voice.synthesize_wav(text, wav_file)
                    wav_bytes = wav_io.getvalue()
                elapsed_ms = (time.time() - t0) * 1000.0

                self.send_response(200)
                self._send_cors()
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(wav_bytes)))
                self.send_header("X-Synthesis-Time-Ms", f"{elapsed_ms:.1f}")
                self.end_headers()
                self.wfile.write(wav_bytes)
            except Exception as e:
                print(f"[Piper Server] Synthesis error: {e}", file=sys.stderr)
                self.send_response(500)
                self._send_cors()
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Concise logging
        if "POST /v1/audio/speech" in str(args):
            print(f"[Piper Server] {args[0]} -> {args[1]}")
        elif "GET /v1/health" not in str(args):
            super().log_message(format, *args)

def main():
    port = 8880
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    print("[Piper Server] Initializing Piper Neural Voice Engine...")
    load_voices()

    server = ThreadedHTTPServer(("127.0.0.1", port), PiperRequestHandler)
    print(f"[Piper Server] Live on http://127.0.0.1:{port}/ (PID: {os.getpid()})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[Piper Server] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    main()
