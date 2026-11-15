---
inclusion: always
---

# Structure — Patchwork

Planned layout (created as the build progresses):

```
kiroween/
├─ .kiro/
│  ├─ steering/      # standing project rules (product.md, tech.md, structure.md)
│  ├─ specs/         # feature specs: requirements.md, design.md, tasks.md
│  ├─ hooks/         # agent hooks (auto-run review on change, etc.)
│  └─ settings/      # mcp.json (GitHub MCP + any custom servers)
├─ src/
│  ├─ server/        # Hono app: API routes
│  ├─ github/        # repo + PR + diff fetching (Octokit)
│  ├─ history/       # git history + per-area knowledge extraction
│  ├─ review/        # the review engine (Claude) behind one interface
│  └─ web/           # React + Vite frontend (workshop theme)
├─ public/
├─ .env.example
├─ package.json
├─ PROJECT-NOTES.md  # Arabic master record (owner-facing)
└─ README.md         # public, judge-facing
```

## Rules
- `/.kiro` lives at the repo root and is **committed** (never in `.gitignore`) — required by
  Kiroween.
- Server-only secrets never reach the client bundle.
- One responsibility per folder; keep `review/` provider-agnostic.
