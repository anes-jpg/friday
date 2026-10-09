import pytest
import sys
import os
import json

# Ensure core directory is in path for testing
core_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if core_path not in sys.path:
    sys.path.insert(0, core_path)

import asyncio

# The mcp server initialization logic is in main.py
# We can test the function directly
from main import process_utterance

@pytest.mark.asyncio
async def test_mcp_process_utterance():
    """
    Tests the MCP tool endpoint that Tauri calls over stdio.
    Verifies that the tool passes the text properly into LangGraph.
    """
    test_text = "FRIDAY, maximize the current window."
    
    # Process utterance calls graph_app.invoke() internally
    result = await process_utterance(test_text)
    
    # Assert that the LangGraph completed successfully and returned JSON
    res_json = json.loads(result)
    assert "say" in res_json

if __name__ == "__main__":
    asyncio.run(test_mcp_process_utterance())
    print("MCP Bridge tests passed!")
