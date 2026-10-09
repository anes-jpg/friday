import sys
import os
import json
import asyncio

core_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if core_dir not in sys.path:
    sys.path.insert(0, core_dir)

class BrowserTool:
    """
    Exposes Browser-use capabilities as a tool for FRIDAY's agent loop.
    Navigates sites, executes multi-step web tasks, or scrapes structured content.
    """
    def __init__(self, api_key: str = None):
        if api_key:
            os.environ["BROWSER_USE_API_KEY"] = api_key

    async def search_and_extract_async(self, objective: str, url: str = None) -> str:
        # Check if browser-use can be instantiated with LLM
        has_key = bool(
            os.environ.get("BROWSER_USE_API_KEY") or
            os.environ.get("OPENAI_API_KEY") or
            os.environ.get("DEEPSEEK_API_KEY") or
            os.environ.get("ANTHROPIC_API_KEY")
        )

        if has_key:
            try:
                from browser_use import Agent
                agent = Agent(task=objective)
                history = await agent.run()
                return str(history.final_result()) if history else "Task completed with no final return value."
            except Exception as e:
                # Fall back to structured web extraction if LLM driver fails
                pass

        # Fallback: direct web search and extraction
        from tools.stagehand_scraper import extract_web_data
        target_url = url or "https://html.duckduckgo.com/html/?q=" + "+".join(objective.split())
        extracted = await extract_web_data(target_url, objective)

        try:
            data = json.loads(extracted)
            results = data.get("results", [])
            summary = data.get("summary", "")
            content = data.get("content", "")

            if results:
                lines = [f"### Web Findings: {objective}\n"]
                for r in results:
                    title = r.get("title", "").strip()
                    snip = r.get("snippet", "").strip()
                    link = r.get("url", "").strip()
                    if link:
                        lines.append(f"- **{title}** (`{link}`)\n  {snip}")
                    else:
                        lines.append(f"- **{title}**\n  {snip}")
                return "\n\n".join(lines)
            elif summary:
                return f"### Web Findings: {objective}\n\n{summary}"
            elif content:
                return f"### Web Findings: {objective}\n\n{content}"
            else:
                return f"No detailed results found for '{objective}'."
        except Exception:
            return extracted

    def search_and_extract(self, objective: str, url: str = None) -> str:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In async context, create task or new loop
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.search_and_extract_async(objective, url))
                    return future.result()
            else:
                return loop.run_until_complete(self.search_and_extract_async(objective, url))
        except Exception:
            return asyncio.run(self.search_and_extract_async(objective, url))

if __name__ == "__main__":
    b = BrowserTool()
    res = b.search_and_extract("What is the latest release of Rust programming language?")
    print(res)

