# ADR 003: SQLite Local Memory, Semantic Fact Extraction & Audit Trail

## Status
Accepted

## Context
A voice-first assistant requires fast, auditable long-term recall of user preferences, project aliases, and communication guidelines without relying on cloud databases. Furthermore, safe action execution on a user's machine requires an immutable record of all tool invocations with reversible file operations.

## Decision
1. **Persistent SQLite Store**:
   - Stored in `%APPDATA%/FRIDAY/friday.db` using `rusqlite` with bundled SQLite.
   - Automatic database file initialization and schema migrations.
2. **Four Memory Tiers**:
   - *Working Memory*: Active thread messages kept in RAM and SQLite.
   - *Episodic Memory*: Conversation threads with timestamps and message counts.
   - *Semantic Memory*: Extracted user facts stored with confidence scores and source message IDs.
   - *Procedural Memory*: Saved workflow skills in the filesystem.
3. **Automated Fact Extraction**:
   - Rules, constraints, and preferences are automatically parsed via `FactExtractor` and persisted.
   - Hybrid keyword retrieval injects relevant facts into system prompts inside `<user-facts>` XML tags.
4. **Append-Only Audit Log**:
   - Every tool call is logged with its argument hash, risk tier (`Green`, `Amber`, `Red`), decision, duration in milliseconds, and timestamp.
   - Reversible filesystem operations register rollback snapshots to the undo journal.

## Consequences
- Complete transparency: users can inspect, edit, and delete any stored fact in the Memory tab.
- Reversible operations: "undo" works deterministically without re-prompting the LLM.
- Zero cloud database costs and zero vendor lock-in.
