import asyncio
import sys
import os

# Ensure standard output uses UTF-8 encoding on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from mcp.server.mcpserver import MCPServer
from agent.graph import app as graph_app

# Initialize the Model Context Protocol Server
mcp = MCPServer("friday-agent-core")

import json
from tools.piper_tts import PiperTTS

# Initialize Piper TTS
tts_engine = PiperTTS()

@mcp.tool()
async def process_utterance(text: str) -> str:
    """
    Called by the Rust Voice Runtime when the user speaks.
    Passes the utterance into the LangGraph state machine.
    """
    print(f"Received utterance from Tauri over MCP: {text}", file=sys.stderr)
    
    # Run the graph
    result = graph_app.invoke({
        "messages": [],
        "status": "idle",
        "objective": text,
        "tool_results": []
    })
    
    final_text = f"I've completed the task. Result: {result.get('tool_results')}"
    
    # Generate the highly emotional female response
    audio_path = tts_engine.synthesize(final_text)
    
    # We return a JSON string so Rust can deserialize it into the TurnResult
    return json.dumps({
        "say": final_text,
        "show": str(result.get('tool_results')),
        "audio_path": audio_path
    })

@mcp.tool()
async def synthesize_tts(text: str) -> str:
    """
    Synthesizes the text to speech and returns the WAV path.
    """
    print(f"Received TTS request for: {text}", file=sys.stderr)
    return tts_engine.synthesize(text)

@mcp.tool()
async def web_browse(task: str, url: str = "") -> str:
    """
    Executes autonomous multi-step web browsing or web searching using browser-use and Stagehand.
    Navigates to destinations, queries search engines, and extracts results.
    """
    try:
        from tools.browser_agent import BrowserTool
        tool = BrowserTool()
        result = await tool.search_and_extract_async(task, url if url else None)
        return json.dumps({"status": "success", "task": task, "result": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "task": task}, ensure_ascii=False)

@mcp.tool()
async def web_extract(url: str, instruction: str = "") -> str:
    """
    Extracts structured DOM content, tables, headers, and readability text from a specified URL.
    """
    try:
        from tools.stagehand_scraper import extract_web_data
        result = await extract_web_data(url, instruction)
        return json.dumps({"status": "success", "url": url, "extracted": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "url": url}, ensure_ascii=False)

@mcp.tool()
async def agent_delegate(objective: str) -> str:
    """
    Delegates complex technical analysis, architecture, or code design to a multi-agent crew.
    Runs hierarchical research and engineering nodes.
    """
    try:
        from agent.crew_orchestrator import run_crew_orchestration
        res = run_crew_orchestration(objective)
        return json.dumps({"status": "success", "objective": objective, "result": res})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "objective": objective})

@mcp.tool()
async def code_sandbox(code: str) -> str:
    """
    Executes a Python code snippet in a protected sandbox environment.
    Returns stdout, stderr, and execution status.
    """
    try:
        from tools.sandbox_e2b import CodeSandbox
        sandbox = CodeSandbox()
        output = sandbox.execute_python(code)
        return json.dumps({"status": "success", "output": output})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@mcp.tool()
async def memory_graph(query: str, entity: str = "") -> str:
    """
    Queries deep episodic and semantic knowledge graphs for entity relationships and context.
    """
    try:
        from memory.graphiti_store import graph_store
        rel = await graph_store.query_relations(entity if entity else query)
        return json.dumps({"status": "success", "query": query, "relations": str(rel)})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "query": query})

@mcp.tool()
async def desktop_uia(action: str, target: str = "", text: str = "") -> str:
    """
    Interacts with native Windows desktop UI components using pywinauto and WinRT.
    Supported actions: 'list_windows', 'focus_and_type', 'ocr_screen'.
    """
    try:
        from tools.windows_automation import WindowsAutomator
        automator = WindowsAutomator()
        action_lower = action.lower()
        if action_lower == "list_windows":
            wins = automator.list_windows()
            return json.dumps({"status": "success", "windows": wins})
        elif action_lower == "focus_and_type":
            res = automator.focus_and_type(target, text)
            return json.dumps({"status": "success", "result": res})
        elif action_lower == "ocr_screen":
            text_seen = automator.capture_and_ocr()
            return json.dumps({"status": "success", "ocr_text": text_seen})
        else:
            return json.dumps({"status": "unknown_action", "action": action})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "action": action})

async def main():
    print("Starting FRIDAY MCP Server on stdio...", file=sys.stderr)
    await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())

