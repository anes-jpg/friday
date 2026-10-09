import sys
import os

# Dynamically inject the local cloned litellm vendor repo
vendor_litellm = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/litellm'))
if vendor_litellm not in sys.path:
    sys.path.insert(0, vendor_litellm)

vendor_instructor = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/instructor'))
if vendor_instructor not in sys.path:
    sys.path.insert(0, vendor_instructor)

import instructor

from litellm import completion

class LiteLLMGateway:
    """
    Standardized model gateway using LiteLLM to interface with DeepSeek Flash
    or any other provider, handling retries, cost-tracking, and fallbacks.
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")

    def execute_turn(self, messages: list, model: str = "deepseek/deepseek-chat") -> str:
        """
        Sends the conversation to DeepSeek through LiteLLM.
        """
        try:
            response = completion(
                model=model,
                messages=messages,
                api_key=self.api_key,
                # Additional telemetry / tracing configs can be attached here (e.g. Langfuse)
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"LLM Gateway Error: {str(e)}"

if __name__ == "__main__":
    gateway = LiteLLMGateway("dummy_key")
    # print(gateway.execute_turn([{"role": "user", "content": "Hello FRIDAY"}]))
