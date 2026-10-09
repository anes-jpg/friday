import os
import sys
import subprocess
import tempfile

class CodeSandbox:
    """
    Provides a code execution environment for running LLM-generated code safely.
    Supports E2B microVMs when configured, and falls back to isolated subprocess execution.
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("E2B_API_KEY", "")

    def execute_python(self, code: str) -> str:
        """Executes the Python snippet and returns stdout, stderr, and exit code."""
        # 1. Attempt E2B microVM if key is provided
        if self.api_key:
            try:
                from e2b_code_interpreter import Sandbox
                with Sandbox(api_key=self.api_key) as sandbox:
                    execution = sandbox.run_code(code)
                    if execution.error:
                        return f"Execution Failed (E2B):\n{execution.error.name}: {execution.error.value}\n{execution.error.traceback}"
                    logs = "\n".join(execution.logs.stdout + execution.logs.stderr)
                    return f"Execution Succeeded (E2B MicroVM):\n{logs}"
            except Exception as e:
                # Fall back to local execution
                pass

        # 2. Safe local execution fallback with 15s timeout
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
                f.write(code)
                temp_file = f.name

            proc = subprocess.run(
                [sys.executable, temp_file],
                capture_output=True,
                text=True,
                timeout=15,
                cwd=tempfile.gettempdir()
            )

            try:
                os.remove(temp_file)
            except OSError:
                pass

            out = proc.stdout.strip()
            err = proc.stderr.strip()
            status_str = f"Exit Code: {proc.returncode}"
            
            result_parts = []
            if out:
                result_parts.append(f"STDOUT:\n{out}")
            if err:
                result_parts.append(f"STDERR:\n{err}")
            if not result_parts:
                result_parts.append("Script completed with empty output.")
            result_parts.append(status_str)

            return "\n\n".join(result_parts)
        except subprocess.TimeoutExpired:
            return "Execution Error: Script timed out after 15 seconds."
        except Exception as e:
            return f"Execution Error: {str(e)}"

if __name__ == "__main__":
    sandbox = CodeSandbox()
    res = sandbox.execute_python("print('FRIDAY Sandbox Initialized.')\nprint(f'2 + 2 = {2+2}')")
    print(res)

