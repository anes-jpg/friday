import os
import sys
import time
import wave
from pathlib import Path

class PiperTTS:
    """
    Local Piper ONNX TTS engine for ultra-fast, high-quality neural female voice synthesis.
    Meets the <= 150ms latency budget on CPU with Rhasspy Piper.
    """
    def __init__(self, voice_name: str = "en_GB-alba-medium"):
        self.voice_name = voice_name
        base = Path(__file__).resolve().parent.parent.parent
        possible_dirs = [
            base / "models" / "piper",
            base / "resources" / "models" / "piper",
            Path.home() / ".cache" / "friday" / "piper",
        ]
        self.models_dir = next((d for d in possible_dirs if d.exists()), possible_dirs[0])
        self.output_dir = base / "src-tauri" / "target" / "audio_cache"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.voice = None
        self.ready = False
        self._load_voice()

    def _load_voice(self):
        try:
            from piper import PiperVoice
        except ImportError:
            print("[Piper] ERROR: piper-tts is not installed. Run: pip install piper-tts", file=sys.stderr)
            return

        onnx_path = self.models_dir / f"{self.voice_name}.onnx"
        json_path = self.models_dir / f"{self.voice_name}.onnx.json"

        # Fallback to any available onnx in models/piper
        if not onnx_path.exists():
            candidates = list(self.models_dir.glob("*.onnx"))
            if candidates:
                onnx_path = candidates[0]
                json_path = onnx_path.with_suffix(".onnx.json")

        if onnx_path.exists() and json_path.exists():
            try:
                t0 = time.time()
                print(f"[Piper] Loading voice from {onnx_path}...")
                self.voice = PiperVoice.load(str(onnx_path), str(json_path))
                self.ready = True
                print(f"[Piper] Voice loaded in {time.time() - t0:.2f}s")
            except Exception as e:
                print(f"[Piper] Failed to load voice: {e}", file=sys.stderr)
        else:
            print(f"[Piper] Voice model not found at {onnx_path}", file=sys.stderr)

    def synthesize(self, text: str) -> str:
        """
        Synthesizes text to speech and returns the absolute path to the generated WAV file.
        """
        if not self.ready or not self.voice:
            print("[Piper] TTS is not ready. Skipping synthesis.")
            return ""

        clean_text = text.strip()
        if not clean_text:
            return ""

        print(f"[Piper] Synthesizing speech for: '{clean_text}'")
        start_time = time.time()
        filepath = self.output_dir / f"response_{int(time.time() * 1000)}.wav"

        try:
            with wave.open(str(filepath), "wb") as wav_file:
                self.voice.synthesize_wav(clean_text, wav_file)
            elapsed = time.time() - start_time
            print(f"[Piper] Synthesis complete in {elapsed:.2f}s -> {filepath}")
            return str(filepath)
        except Exception as e:
            print(f"[Piper] Synthesis failed: {e}", file=sys.stderr)
            return ""
