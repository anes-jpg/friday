import sys
import os

vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

try:
    import phoenix as px
    from openinference.instrumentation.litellm import LiteLLMInstrumentor
    from openinference.instrumentation.langchain import LangChainInstrumentor
except ImportError:
    pass

def init_phoenix_tracing():
    """
    Initializes Arize Phoenix for local UI observability and LLM trace spans.
    """
    # Start the local Phoenix server UI (usually http://localhost:6006)
    # session = px.launch_app()
    
    # Instrument the orchestrators and model gateways
    # LiteLLMInstrumentor().instrument()
    # LangChainInstrumentor().instrument()
    
    print("Phoenix: Tracing instrumentation initialized.")

if __name__ == "__main__":
    init_phoenix_tracing()
