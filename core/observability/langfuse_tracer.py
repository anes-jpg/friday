import os
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

class ObservabilityTracer:
    """
    Integrates Langfuse to capture full execution traces, cost metrics, and latency
    for every LangGraph state transition and LiteLLM model call.
    """
    def __init__(self):
        self.langfuse = Langfuse(
            secret_key=os.environ.get("LANGFUSE_SECRET_KEY", ""),
            public_key=os.environ.get("LANGFUSE_PUBLIC_KEY", ""),
            host="https://cloud.langfuse.com"
        )
    
    def start_trace(self, session_id: str, objective: str):
        """Creates a trace for the overarching run."""
        trace = self.langfuse.trace(
            name="FRIDAY_Execution_Run",
            session_id=session_id,
            input=objective,
            metadata={"environment": "production"}
        )
        return trace

    @observe()
    def trace_node(self, node_name: str, state: dict):
        """Automatically captures node execution via decorator."""
        langfuse_context.update_current_trace(
            tags=["langgraph", node_name]
        )
        # We can flush metrics asynchronously
        return state

if __name__ == "__main__":
    print("Langfuse Tracer Module Initialized.")
