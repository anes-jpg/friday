# ADR 004: Skill SDK, Sandboxed Permission Gating & Filesystem Discovery

## Status
Accepted

## Context
FRIDAY must grow capabilities over time without requiring full application recompilation. However, running third-party scripts or tools with unrestricted machine access violates the security model and creates severe prompt injection vulnerabilities.

## Decision
1. **Filesystem Skill Structure**:
   - Skills reside in `%APPDATA%/FRIDAY/skills/{id}/` and workspace `./skills/{id}/`.
   - Each skill defines a `manifest.json` with name, version, triggers (cron, phrase), declared permissions array, and optional `run.ts` entry.
2. **Upfront Permission Declarations**:
   - Tools check `skill_registry.check_permission(skill_id, tool_permission)`.
   - Permissions cannot escalate at runtime. Undeclared tool calls are blocked immediately and logged to the persistent `audit_log` as violations.
3. **Bundled Starter Skills**:
   - `standup-digest`: Daily Git and Notion task summarizer.
   - `notion-operator`: Bi-directional Notion page and task queries.
   - `desktop-organizer`: Automated screenshot and asset mover with recycle bin safety.

## Consequences
- Clean extensibility without monolithic bloat.
- Strict security boundary preventing unauthorized tool execution.
- Easy community distribution via directory drops.
