# Patchwork — a Kiro Power

Patchwork packaged as a reusable **Kiro Power**: a zero-dependency stdio **MCP server**
that gives the Kiro agent (or any MCP client) Patchwork's review as callable tools. Drop it
into any workspace and the agent can ask a file's history for its reasons before changing it.

## Tools
| Tool | What it does |
|---|---|
| `patchwork_review` | Review a GitHub pull request against the history behind each changed file. Returns cited, severity-ranked warnings — each names the commit it is based on and **who** made that decision. Args: `repo` (owner/name or URL), `pr` (optional). |
| `file_knowledge` | Reconstruct one file's knowledge from its git history: contributors and the recorded reasons (the "why"). Args: `repo`, `path`. (auto-approved — read-only.) |

## Add it to a workspace
`.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "patchwork": {
      "command": "node",
      "args": ["power-patchwork/server.mjs"],
      "env": { "GITHUB_TOKEN": "...", "GEMINI_API_KEY": "..." },
      "autoApprove": ["file_knowledge"]
    }
  }
}
```
`GEMINI_API_KEY` is optional: without it the review falls back to the grounded heuristic.
Then, in Kiro chat: *"use patchwork_review on expressjs/express"* or *"what does file_knowledge say about src/server/index.mjs?"*.

## Protocol
Newline-delimited JSON-RPC 2.0 over stdio (`initialize`, `tools/list`, `tools/call`). No SDK,
no runtime dependencies — it reuses Patchwork's own `src/pipeline.mjs` and `src/github/fetch.mjs`.
