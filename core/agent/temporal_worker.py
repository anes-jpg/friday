import sys
import os
import asyncio
from datetime import timedelta

vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

try:
    from temporalio import activity, workflow
    from temporalio.client import Client
    from temporalio.worker import Worker
except ImportError:
    pass

@activity.defn
async def execute_heavy_refactor(objective: str) -> str:
    """A long-running activity (e.g., executing a deep AST refactor)."""
    # Simulate heavy processing
    await asyncio.sleep(2)
    return f"Successfully refactored codebase for: {objective}"

@workflow.defn
class AgentWorkflow:
    @workflow.run
    async def run(self, objective: str) -> str:
        # Durable execution
        result = await workflow.execute_activity(
            execute_heavy_refactor,
            objective,
            start_to_close_timeout=timedelta(seconds=600),
        )
        return result

async def start_worker():
    """Starts the Temporal worker to listen for durable tasks."""
    try:
        client = await Client.connect("localhost:7233")
        worker = Worker(
            client,
            task_queue="agent-task-queue",
            workflows=[AgentWorkflow],
            activities=[execute_heavy_refactor],
        )
        print("Starting Temporal Worker...")
        await worker.run()
    except Exception as e:
        print(f"Temporal server not running locally: {e}")

if __name__ == "__main__":
    asyncio.run(start_worker())
