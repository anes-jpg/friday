import sys
import os

vendor_langgraph = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/langgraph/libs/langgraph'))
if vendor_langgraph not in sys.path:
    sys.path.insert(0, vendor_langgraph)
from typing import TypedDict, Annotated, Sequence
import operator
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

# Import local wrappers that proxy to the vendor clones
from gateway.litellm_proxy import LiteLLMGateway
from memory.mem0_store import Mem0Store
from memory.graphiti_store import graph_store
from tools.windows_automation import WindowsAutomator
from tools.jev_browser import JevUltrafastBrowser
from agent.crew_orchestrator import run_crew_orchestration

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    status: str
    objective: str
    tool_results: list
    next_node: str

ROUTER_SYSTEM_PROMPT = """
You are the central executive brain of FRIDAY, an intelligent OS operator.
Your job is to analyze the user's objective and route the task to the most appropriate subsystem.

Available Subsystems:
1. 'jev_web': For any web browsing, scraping, or web automation. It uses a hyper-fast atomic DOM parser.
2. 'crew_ai': For complex coding, research, or multi-step analysis requiring sub-agents.
3. 'windows_desktop': For clicking buttons, typing in local apps, or reading the screen via OCR.
4. 'memory_graph': For retrieving deep conversational context or updating facts.

Analyze the objective and output ONLY the exact string name of the subsystem to route to.
"""

def thinking_node(state: AgentState):
    print("FRIDAY is thinking via LLM Router...")
    objective = state.get("objective", "").lower()
    
    # In a real environment, we'd pass ROUTER_SYSTEM_PROMPT to LiteLLM:
    # response = litellm.completion(model="gemini/gemini-2.5-pro", messages=[...])
    # route = response.choices[0].message.content.strip()
    
    # Heuristic fallback for testing
    if "web" in objective or "browser" in objective or "flight" in objective:
        route = "jev_web"
    elif "research" in objective or "code" in objective or "complex" in objective:
        route = "crew_ai"
    else:
        route = "windows_desktop"
        
    print(f"[Router] Decided to route to: {route}")
    return {"status": "routed", "next_node": route}

def jev_web_node(state: AgentState):
    print("[Action] Executing Jev-Ultrafast Browser...")
    browser = JevUltrafastBrowser()
    res = browser.run_task("https://google.com", state.get("objective", ""))
    return {"status": "verifying", "tool_results": [res]}

def crew_ai_node(state: AgentState):
    print("[Action] Delegating to CrewAI Swarm...")
    res = run_crew_orchestration(state.get("objective", ""))
    return {"status": "verifying", "tool_results": [res]}

def windows_desktop_node(state: AgentState):
    print("[Action] Executing PyWinAuto & Native OCR...")
    automator = WindowsAutomator()
    vision_text = automator.capture_and_ocr()
    res = f"Screen Text: {vision_text}\nActive Windows: {automator.list_windows()}"
    return {"status": "verifying", "tool_results": [res]}

def verifying_node(state: AgentState):
    print("FRIDAY is verifying the execution outcome...")
    # Feed the tool results back into the LLM for self-correction or completion
    return {"status": "idle"}

workflow = StateGraph(AgentState)
workflow.add_node("think", thinking_node)
workflow.add_node("jev_web", jev_web_node)
workflow.add_node("crew_ai", crew_ai_node)
workflow.add_node("windows_desktop", windows_desktop_node)
workflow.add_node("verify", verifying_node)

workflow.set_entry_point("think")

# Conditional routing based on the 'next_node' value from 'think'
def route_condition(state: AgentState):
    return state.get("next_node", "windows_desktop")

workflow.add_conditional_edges("think", route_condition)
workflow.add_edge("jev_web", "verify")
workflow.add_edge("crew_ai", "verify")
workflow.add_edge("windows_desktop", "verify")
workflow.add_edge("verify", END)

app = workflow.compile()

if __name__ == "__main__":
    print("FRIDAY LangGraph Router Online.")
    # Test a run
    result = app.invoke({"objective": "Find a flight to Tokyo on the web", "tool_results": []})
    print("Final Result:", result["tool_results"])
