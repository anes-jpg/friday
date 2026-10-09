import needle
import sounddevice as sd
import numpy as np
import time

def record_and_transcribe():
    print("Loading Whistle...")
    w = needle.Whistle()
    
    fs = 16000
    duration = 5  # seconds
    
    print(f"Recording for {duration} seconds...")
    myrecording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='float32')
    sd.wait()  # Wait until recording is finished
    print("Recording finished. Transcribing...")
    
    start_time = time.time()
    # Flatten the array and convert to list as required? 
    # The docs say: "16 kHz mono float samples in [-1, 1]"
    # sounddevice returns numpy array of shape (frames, 1). Let's flatten it.
    audio_data = myrecording.flatten().tolist()
    
    result = w.transcribe(audio_data)
    print(f"Transcription took {time.time() - start_time:.3f}s")
    print("Result:", result)

if __name__ == "__main__":
    record_and_transcribe()
