import sys
import os

# Dynamically inject the local cloned mem0 vendor repo
vendor_mem0 = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/mem0'))
if vendor_mem0 not in sys.path:
    sys.path.insert(0, vendor_mem0)

vendor_lancedb = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor/lancedb/python'))
if vendor_lancedb not in sys.path:
    sys.path.insert(0, vendor_lancedb)

from mem0 import Memory

class Mem0Store:
    """
    Long-term memory management using Mem0.
    Automatically extracts user preferences, contextual history, and facts.
    """
    def __init__(self, db_path="mem0_friday.db"):
        self.memory = Memory(config={"vector_store": {"provider": "lancedb", "config": {"uri": db_path}}})

    def store_fact(self, text: str, user_id: str = "friday_user"):
        self.memory.add(text, user_id=user_id)

    def retrieve_context(self, query: str, user_id: str = "friday_user") -> list:
        return self.memory.search(query, user_id=user_id)

if __name__ == "__main__":
    store = Mem0Store()
    store.store_fact("The user likes absolute native repository integrations.")
    print(store.retrieve_context("What does the user like?"))
