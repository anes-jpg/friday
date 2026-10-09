import sys
import os
import time

# Dynamically inject the local cloned pywinauto vendor repo
vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/pywinauto'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

from pywinauto import Desktop, Application
from pywinauto.keyboard import send_keys

class WindowsAutomator:
    """
    Exposes pywinauto capabilities as a tool for the LangGraph agent to scrape
    the accessibility tree and drive Windows desktop apps.
    """
    def __init__(self):
        self.desktop = Desktop(backend="uia")

    def list_windows(self) -> list:
        """Returns a list of all visible top-level windows."""
        return [w.window_text() for w in self.desktop.windows() if w.window_text()]

    def focus_and_type(self, window_title: str, text: str):
        """Finds a window by title, focuses it, and types the text."""
        try:
            win = self.desktop.window(title_re=f".*{window_title}.*")
            win.set_focus()
            time.sleep(0.1)
            send_keys(text, with_spaces=True)
            return f"Successfully focused {window_title} and typed text."
        except Exception as e:
            return f"Error interacting with {window_title}: {str(e)}"

    def capture_and_ocr(self) -> str:
        """
        Takes a screenshot and uses the native Windows WinRT OCR script to 
        instantly extract text, granting the agent offline zero-latency vision.
        """
        import subprocess
        import tempfile
        try:
            from PIL import ImageGrab
            screenshot_path = os.path.join(tempfile.gettempdir(), "friday_screen.png")
            ImageGrab.grab().save(screenshot_path)
            
            script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../scripts/ocr_service.ps1'))
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", script_path, "-ImagePath", screenshot_path]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return f"Vision extracted text:\n{result.stdout.strip()}"
            else:
                return f"OCR Failed: {result.stderr.strip()}"
        except Exception as e:
            return f"Vision Error: {str(e)}"

if __name__ == "__main__":
    automator = WindowsAutomator()
    print("Available Windows:", automator.list_windows())
    # print(automator.capture_and_ocr())
