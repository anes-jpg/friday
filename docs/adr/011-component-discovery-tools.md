# ADR 011: Component discovery through shadcn and Watermelon MCP

Date: 2026-10-25
Status: Accepted

FRIDAY already contains customized shadcn components. Future map and project workspace changes need access to upstream components without replacing the Atmospheric Halftone OS theme.

Use the official shadcn MCP server (`npx shadcn@latest mcp`) and Watermelon's hosted MCP endpoint (`https://mcp.watermelon.sh/mcp`) for component discovery. Codex server configuration belongs in the user's local Codex configuration, not application runtime configuration. `components.json` points the shadcn tooling at existing aliases, Radix components, and the Tailwind v4 stylesheet.

These are development tools, not application dependencies. No runtime package is added by this decision. Adding a component must first inspect its source and dependency requirements. New application dependencies need their own ADR. Existing customized components, typography, neutral surfaces, and violet activity signal must be preserved.

Sources: https://ui.shadcn.com/docs/mcp, https://mcp.watermelon.sh/, https://developers.openai.com/codex/mcp/.
