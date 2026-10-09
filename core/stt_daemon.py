import needle
import sounddevice as sd
import numpy as np
import time
import json
import sys

def main():
    w = needle.Whistle()
    
    fs = 16000
    chunk_duration = 0.5  # half second chunks
    chunk_samples = int(fs * chunk_duration)
    
    threshold = 0.005  # RMS threshold
    silence_limit = 1.5  # seconds of silence to stop recording
    
    print(json.dumps({"status": "ready"}), flush=True)
    
    audio_buffer = []
    silence_time = 0.0
    recording = False
    
    def callback(indata, frames, time_info, status):
        nonlocal audio_buffer, silence_time, recording
        
        rms = np.sqrt(np.mean(indata**2))
        
        if rms > threshold:
            recording = True
            silence_time = 0.0
            audio_buffer.extend(indata.flatten().tolist())
        elif recording:
            silence_time += chunk_duration
            audio_buffer.extend(indata.flatten().tolist())
            
            # Enforce max duration of 20 seconds
            if silence_time >= silence_limit or len(audio_buffer) >= (fs * 20):
                # Transcribe
                # Make sure we don't exceed 30s just in case
                if len(audio_buffer) > (fs * 30):
                    audio_buffer = audio_buffer[-(fs * 29):]

                transcription = w.transcribe(audio_buffer)
                if transcription['text'].strip() != "":
                    print(json.dumps({"text": transcription['text'], "ttft_ms": transcription.get('ttft_ms', 0)}), flush=True)
                
                audio_buffer = []
                silence_time = 0.0
                recording = False

    with sd.InputStream(samplerate=fs, channels=1, dtype='float32', blocksize=chunk_samples, callback=callback):
        while True:
            time.sleep(0.1)

if __name__ == "__main__":
    main()
