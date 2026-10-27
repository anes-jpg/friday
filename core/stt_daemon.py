"""Local Whistle adapter: bounded capture/recognition queues and JSON events."""
import argparse
from collections import deque
import contextlib
import json
import queue
import sys
import threading
import time

SAMPLE_RATE = 16000
FRAME_SAMPLES = 320  # 20 ms
ENDPOINT_SECONDS = 0.22
MAX_SECONDS = 20


def emit(**event):
    print(json.dumps(event, ensure_ascii=False), flush=True)


class Endpoint:
    """Bounded VAD state, independent of microphone and recognizer."""
    def __init__(self, threshold=0.005):
        self.threshold = threshold
        self.frames = []
        self.pre_roll = deque(maxlen=5)
        self.started = None
        self.speech_stopped = None

    def feed(self, samples, rms, captured_at):
        if rms > self.threshold:
            if self.started is None:
                self.started = captured_at
                self.frames = list(self.pre_roll)
            self.speech_stopped = captured_at + len(samples) / SAMPLE_RATE
        if self.started is None:
            self.pre_roll.append(samples)
            return None
        self.frames.append(samples)
        decided = captured_at + len(samples) / SAMPLE_RATE
        if decided - self.speech_stopped < ENDPOINT_SECONDS and decided - self.started < MAX_SECONDS:
            return None
        result = (self.frames, self.started, self.speech_stopped, decided)
        self.frames, self.started, self.speech_stopped = [], None, None
        self.pre_roll.clear()
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device")
    parser.add_argument("--fixture", help="16 kHz mono PCM16 WAV; fixture evidence is separate from microphone accuracy")
    args = parser.parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        import needle
        import numpy as np
        import sounddevice as sd
        whistle = needle.Whistle()
    if args.fixture:
        import wave
        with wave.open(args.fixture, "rb") as wav:
            if wav.getframerate() != SAMPLE_RATE or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                raise ValueError("Fixture must be 16 kHz mono PCM16 WAV")
            audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32) / 32768
        started = time.perf_counter()
        with contextlib.redirect_stdout(sys.stderr):
            result = whistle.transcribe(audio.tolist())
        emit(type="fixture", text=result.get("text", "").strip(), recognition_ms=(time.perf_counter()-started)*1000,
             evidence="synthesized_fixture", samples=len(audio))
        return
    captured = queue.Queue(maxsize=100)
    recognition = queue.Queue(maxsize=2)
    stop = threading.Event()
    overflow = threading.Event()
    finish = threading.Event()
    endpoint = Endpoint()
    def control():
        for line in sys.stdin:
            if line.strip()=="finish":
                finish.set()
                return
    threading.Thread(target=control,name="whistle-control",daemon=True).start()

    def callback(indata, frames, time_info, status):
        # Only copy a small frame and attempt a nonblocking enqueue.
        try:
            captured.put_nowait((indata[:, 0].copy(), time.perf_counter(), str(status) if status else None))
        except queue.Full:
            overflow.set()

    def recognize():
        while not stop.is_set():
            try:
                frames, started, speech_stopped, decided = recognition.get(timeout=0.1)
            except queue.Empty:
                continue
            try:
                recognition_started = time.perf_counter()
                audio = np.concatenate(frames).tolist()
                with contextlib.redirect_stdout(sys.stderr):
                    result = whistle.transcribe(audio, language="en")
                finished = time.perf_counter()
                emit(type="metrics", endpoint_ms=(decided-speech_stopped)*1000,
                     recognition_tail_ms=(finished-speech_stopped)*1000,
                     recognition_ms=(finished-recognition_started)*1000,
                     queue_ms=(recognition_started-decided)*1000,
                     capture_to_final_ms=(finished-started)*1000)
                text = result.get("text", "").strip()
                if text and not stop.is_set():
                    emit(type="final", text=text)
            except Exception as error:
                emit(type="error", error=f"Whistle recognition failed: {error}. Check the installed speech runtime.")
            finally:
                recognition.task_done()

    threading.Thread(target=recognize, name="whistle-recognition", daemon=True).start()
    try:
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", blocksize=FRAME_SAMPLES,
                            device=args.device, callback=callback):
            # Capture has successfully entered before announcing readiness.
            emit(type="status", status="ready", sample_rate=SAMPLE_RATE, frame_ms=20, partial_available=False)
            last_level = 0.0
            while not stop.is_set() and not finish.is_set():
                if overflow.is_set():
                    raise RuntimeError("Microphone queue overflow. Close busy applications and restart capture.")
                try:
                    samples, captured_at, status = captured.get(timeout=0.1)
                except queue.Empty:
                    continue
                if status:
                    emit(type="warning", error=f"Microphone capture: {status}")
                rms = float(np.sqrt(np.mean(samples * samples)))
                if captured_at - last_level >= 0.1:
                    emit(type="level", rms=rms)
                    last_level = captured_at
                segment = endpoint.feed(samples, rms, captured_at)
                if segment:
                    try:
                        recognition.put_nowait(segment)
                    except queue.Full:
                        emit(type="error", error="Recognition queue is full. Wait for the current turn before speaking again.")
        if finish.is_set():
            if endpoint.started is not None:
                recognition.put((endpoint.frames,endpoint.started,endpoint.speech_stopped,time.perf_counter()),timeout=1)
            # Capture is closed; preserve the final recognition on PTT release.
            recognition.join()
            emit(type="status",status="finished")
    finally:
        stop.set()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit(type="error", error=f"Speech capture failed: {error}. Configure FRIDAY_PYTHON with Python containing needle, sounddevice and numpy, and check the microphone.")
        sys.exit(1)
