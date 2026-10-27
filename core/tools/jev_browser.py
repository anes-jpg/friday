import sys
import os
import subprocess

class JevUltrafastBrowser:
    """
    Leverages the jev-ultrafast hyper-optimized browser harness for
    <7s headless task completion without visual screenshots.
    """
    def __init__(self):
        self.jev_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../resources/jev-ultrafast/jev-ultrafast-main'))
    
    def run_task(self, url: str, goal: str) -> str:
        """
        Executes a web automation task using the Jev Ultrafast engine.
        Returns the output summary of the executed actions.
        """
        # A successful result must only be returned after the real Jev harness
        # executes. The Python dependency (`uv`) and upstream assets are not part
        # of this repository, so report an explicit unavailable state instead of
        # a canned completion.
        if not os.path.isdir(self.jev_path):
            return "[Jev-Ultrafast] Unavailable: the Jev harness assets are not installed; no browser task was executed."
        try:
            completed = subprocess.run(
                ["uv", "run", "python", "examples/run.py", "--url", url, "--goal", goal],
                cwd=self.jev_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            return f"[Jev-Ultrafast] Unavailable: {exc}; no browser task was executed."
        if completed.returncode != 0:
            return f"[Jev-Ultrafast] Failed: {completed.stderr.strip() or completed.stdout.strip()}"
        return completed.stdout.strip() or "[Jev-Ultrafast] Completed with no output."

if __name__ == "__main__":
    browser = JevUltrafastBrowser()
    print(browser.run_task("https://flights.google.com", "Find a flight to London"))
