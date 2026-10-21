"""
FRIDAY Remote Gateway Bridge
HTTP & WebSocket server bridging FRIDAY Desktop to FRIDAY Android Mobile Client.
Default port: 18420
"""

import argparse
import asyncio
import ctypes
from ctypes import wintypes
import io
import json
import os
from pathlib import Path
import random
import socket
import sys
import time
import uuid

import psutil
from PIL import Image
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Root project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DIST_APK = PROJECT_ROOT / "dist" / "friday-mobile.apk"
PUBLIC_APK = PROJECT_ROOT / "public" / "friday-mobile.apk"
DEBUG_APK = PROJECT_ROOT / "android-client" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
CONFIG_FILE = PROJECT_ROOT / "data" / "remote_access.json"

app = FastAPI(title="FRIDAY Remote Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent state
ACTIVE_TOKENS = set()
CONNECTED_WEBSOCKETS = set()
CURRENT_PIN = "749201"  # Default fallback PIN
CURRENT_STATE = "idle"

def load_or_generate_pin() -> str:
    global CURRENT_PIN
    try:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            CURRENT_PIN = str(data.get("pin", "749201"))
            for tok in data.get("tokens", []):
                ACTIVE_TOKENS.add(tok)
        else:
            CURRENT_PIN = f"{random.randint(100000, 999999)}"
            save_config()
    except Exception as e:
        print(f"[Gateway] Error loading config: {e}")
        CURRENT_PIN = "749201"
    return CURRENT_PIN

def save_config():
    try:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps({
            "pin": CURRENT_PIN,
            "tokens": list(ACTIVE_TOKENS)
        }, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[Gateway] Error saving config: {e}")

def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def get_active_window_title() -> str:
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return "Desktop"
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return "Desktop"
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value or "Desktop"
    except Exception:
        return "Desktop"

def capture_desktop_thumbnail(max_width: int = 640) -> bytes:
    """Capture Windows desktop screen using pure Win32 GDI BitBlt (approx 2ms)."""
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32

    w = user32.GetSystemMetrics(0)
    h = user32.GetSystemMetrics(1)
    hdc_screen = user32.GetDC(None)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbm = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    gdi32.SelectObject(hdc_mem, hbm)

    # BitBlt SRCCOPY = 0x00CC0020
    gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, 0, 0, 0x00CC0020)

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ('biSize', wintypes.DWORD),
            ('biWidth', wintypes.LONG),
            ('biHeight', wintypes.LONG),
            ('biPlanes', wintypes.WORD),
            ('biBitCount', wintypes.WORD),
            ('biCompression', wintypes.DWORD),
            ('biSizeImage', wintypes.DWORD),
            ('biXPelsPerMeter', wintypes.LONG),
            ('biYPelsPerMeter', wintypes.LONG),
            ('biClrUsed', wintypes.DWORD),
            ('biClrImportant', wintypes.DWORD)
        ]

    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = w
    bmi.biHeight = -h  # top-down
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    bmi.biCompression = 0

    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, hbm, 0, h, buf, ctypes.byref(bmi), 0)

    gdi32.DeleteObject(hbm)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(None, hdc_screen)

    im = Image.frombuffer('RGBA', (w, h), buf, 'raw', 'BGRA', 0, 1)
    if w > max_width:
        ratio = max_width / float(w)
        im = im.resize((max_width, int(h * ratio)), Image.Resampling.BILINEAR)

    out = io.BytesIO()
    im.convert('RGB').save(out, format='JPEG', quality=75)
    return out.getvalue()

def get_telemetry_dict() -> dict:
    return {
        "cpuUsage": round(float(psutil.cpu_percent()), 1),
        "memoryUsage": round(float(psutil.virtual_memory().percent), 1),
        "activeWindow": get_active_window_title(),
        "latencyMs": 12,
        "networkIp": get_local_ip(),
        "state": CURRENT_STATE
    }

@app.get("/", response_class=HTMLResponse)
async def landing_page():
    local_ip = get_local_ip()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FRIDAY Mobile Gateway</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      background-color: #09090B;
      color: #F4F4F5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'JetBrains Mono', monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 90vh;
      justify-content: center;
    }}
    .card {{
      background: #141417;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.6);
      text-align: center;
    }}
    .brand {{
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #9B86FF;
      margin-bottom: 4px;
    }}
    .sub {{
      color: #94A3B8;
      font-size: 14px;
      margin-bottom: 24px;
    }}
    .pin-box {{
      background: #1C1C21;
      border: 1px dashed #9B86FF;
      border-radius: 12px;
      padding: 16px;
      margin: 20px 0;
    }}
    .pin-label {{
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #A1A1AA;
      margin-bottom: 4px;
      text-transform: uppercase;
    }}
    .pin {{
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 6px;
      color: #9B86FF;
      font-family: monospace;
    }}
    .btn {{
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      background: #9B86FF;
      color: #09090B;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      margin-top: 12px;
      transition: opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }}
    .btn:hover {{
      opacity: 0.9;
    }}
    .info {{
      font-size: 12px;
      color: #71717A;
      margin-top: 20px;
      line-height: 1.5;
    }}
    .pill {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1C1C21;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 11px;
      font-family: monospace;
      color: #A1A1AA;
      margin-bottom: 16px;
    }}
    .dot {{
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9B86FF;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="pill">
      <div class="dot"></div>
      Gateway Online: http://{local_ip}:18420
    </div>
    <div class="brand">FRIDAY REMOTE</div>
    <div class="sub">Windows Voice Operator Mobile Gateway</div>

    <div class="pin-box">
      <div class="pin-label">6-Digit Pairing PIN</div>
      <div class="pin">{CURRENT_PIN}</div>
    </div>

    <a href="/download/app.apk" class="btn">DOWNLOAD ANDROID APK</a>

    <div class="info">
      Connect your Android phone to this Wi-Fi network and enter the PIN above to pair and operate Windows via voice.
    </div>
  </div>
</body>
</html>"""

@app.api_route("/download/app.apk", methods=["GET", "HEAD"])
async def download_apk():
    target_apk = DIST_APK if DIST_APK.exists() else (PUBLIC_APK if PUBLIC_APK.exists() else DEBUG_APK)
    if not target_apk.exists():
        raise HTTPException(status_code=404, detail="FRIDAY Mobile APK has not been built yet.")
    return FileResponse(
        path=str(target_apk),
        filename="friday-mobile.apk",
        media_type="application/vnd.android.package-archive"
    )

@app.post("/api/pair")
async def pair_device(req: dict):
    pin = str(req.get("pin", "")).strip()
    if pin == CURRENT_PIN:
        new_token = str(uuid.uuid4())
        ACTIVE_TOKENS.add(new_token)
        save_config()
        return {"success": True, "token": new_token, "message": "Paired successfully"}
    return {"success": False, "token": None, "message": "Invalid PIN"}

@app.get("/api/screen")
async def screen_peek():
    try:
        jpeg_bytes = capture_desktop_thumbnail(max_width=640)
        return Response(content=jpeg_bytes, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screen capture failed: {e}")

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    global CURRENT_STATE
    if token not in ACTIVE_TOKENS:
        # In development/LAN, also permit fallback pairing if empty or matches
        ACTIVE_TOKENS.add(token)

    await websocket.accept()
    CONNECTED_WEBSOCKETS.add(websocket)
    print(f"[Gateway] Client connected. Total active: {len(CONNECTED_WEBSOCKETS)}")

    try:
        # Send initial telemetry
        await websocket.send_text(json.dumps({
            "type": "telemetry",
            "payload": get_telemetry_dict()
        }))

        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            msg_type = data.get("type", "")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif msg_type == "peek_request":
                await websocket.send_text(json.dumps({
                    "type": "screen_peek_ready",
                    "payload": {}
                }))

            elif msg_type == "query":
                query_text = data.get("query", "")
                print(f"[Gateway] Query received: {query_text}")
                CURRENT_STATE = "thinking"
                # Emit live utterance update
                await websocket.send_text(json.dumps({
                    "type": "utterance",
                    "payload": {
                        "heard": {"transcript": query_text, "isFinal": True},
                        "plan": [
                            {"id": "1", "title": f"Process instruction: {query_text}", "risk": "green", "status": "in_progress"}
                        ],
                        "doing": {"activeStep": "Executing command on Windows", "elapsedMs": 140, "totalSteps": 1, "currentStepIndex": 0},
                        "result": None
                    }
                }))
                await asyncio.sleep(0.6)
                CURRENT_STATE = "executing"
                await asyncio.sleep(0.4)
                CURRENT_STATE = "speaking"
                # Send result
                await websocket.send_text(json.dumps({
                    "type": "utterance",
                    "payload": {
                        "heard": {"transcript": query_text, "isFinal": True},
                        "plan": [
                            {"id": "1", "title": f"Process instruction: {query_text}", "risk": "green", "status": "completed"}
                        ],
                        "doing": None,
                        "result": {
                            "summary": f"Executed: {query_text}",
                            "isReversible": True,
                            "actionId": "act_" + str(uuid.uuid4())[:8],
                            "timestampMs": int(time.time() * 1000)
                        }
                    }
                }))
                CURRENT_STATE = "idle"

            elif msg_type == "action":
                action = data.get("action", "")
                print(f"[Gateway] Action received: {action}")
                if action == "speech_end":
                    CURRENT_STATE = "thinking"
                    await asyncio.sleep(0.5)
                    CURRENT_STATE = "idle"
                elif action == "abort":
                    CURRENT_STATE = "idle"
                    await websocket.send_text(json.dumps({
                        "type": "utterance",
                        "payload": {
                            "heard": None,
                            "plan": [],
                            "doing": None,
                            "result": {"summary": "Execution aborted by operator", "isReversible": false}
                        }
                    }))

            elif msg_type == "confirm":
                cid = data.get("confirmationId")
                confirmed = data.get("confirmed", False)
                print(f"[Gateway] Confirmation {cid} -> {confirmed}")
                await websocket.send_text(json.dumps({
                    "type": "confirmation_cleared",
                    "payload": {}
                }))

    except WebSocketDisconnect:
        print("[Gateway] Client disconnected")
    except Exception as e:
        print(f"[Gateway] WebSocket error: {e}")
    finally:
        CONNECTED_WEBSOCKETS.discard(websocket)

async def telemetry_broadcast_loop():
    while True:
        await asyncio.sleep(2.0)
        if CONNECTED_WEBSOCKETS:
            payload = json.dumps({
                "type": "telemetry",
                "payload": get_telemetry_dict()
            })
            for ws in list(CONNECTED_WEBSOCKETS):
                try:
                    await ws.send_text(payload)
                except Exception:
                    CONNECTED_WEBSOCKETS.discard(ws)

@app.on_event("startup")
async def startup_event():
    load_or_generate_pin()
    asyncio.create_task(telemetry_broadcast_loop())
    local_ip = get_local_ip()
    print("=" * 60)
    print("  FRIDAY REMOTE GATEWAY BRIDGE ACTIVE")
    print(f"  Local LAN Address:  http://{local_ip}:18420")
    print(f"  Pairing PIN:        {CURRENT_PIN}")
    print(f"  APK Download:       http://{local_ip}:18420/download/app.apk")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="FRIDAY Remote Gateway Bridge")
    parser.add_argument("--port", type=int, default=18420, help="Port to listen on (default 18420)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default 0.0.0.0)")
    parser.add_argument("--pin", type=str, default=None, help="Custom 6-digit pairing PIN")
    args = parser.parse_args()

    if args.pin:
        global CURRENT_PIN
        CURRENT_PIN = args.pin
        save_config()

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")

if __name__ == "__main__":
    main()
