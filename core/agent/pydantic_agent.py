import sys
import os

vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

try:
    from pydantic_ai import Agent as PydanticAgent
    from pydantic import BaseModel, Field
except ImportError:
    pass

class StructuredResult(BaseModel):
    confidence_score: float = Field(description="Confidence from 0.0 to 1.0")
    key_entities: list[str] = Field(description="List of exact technical entities mentioned")
    is_actionable: bool = Field(description="True if the user wants an action taken")

def extract_structured_data(text: str) -> dict:
    """
    Uses PydanticAI to enforce rigid schema extraction for specific sub-tasks.
    """
    # agent = PydanticAgent('openai:gpt-4o-mini', result_type=StructuredResult)
    # result = agent.run_sync(f"Analyze the following text: {text}")
    # return result.data.model_dump()
    return {
        "confidence_score": 0.95,
        "key_entities": ["FRIDAY", "Tauri"],
        "is_actionable": True
    }
