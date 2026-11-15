---
inclusion: always
---

# Tech — Patchwork

## Stack
- **Language:** TypeScript (Node.js 20+).
- **Backend:** Hono (lightweight, modern, deploys to Node or edge).
- **GitHub integration:** `@octokit/rest` for the GitHub API (repos, pull requests, diffs).
- **Git history:** parse `git log` / `git blame` output (via child_process) or `isomorphic-git`
  — read history per file/area: commits, messages, and which lines changed when.
- **AI brain (the review engine):** Anthropic Claude via `@anthropic-ai/sdk`.
  - OPEN ITEM: the runtime app needs its own model access (an Anthropic API key, or AWS Bedrock
    since this is an AWS/Kiro hackathon). Kiro's own credits power Kiro's agent, not our app's
    runtime calls. Resolve before Phase 2. Keep the model behind one small interface so we can
    swap providers.
- **Frontend:** React + Vite + Tailwind CSS. Workshop / inventor's-lab visual theme.
- **Deploy:** a public working URL (Vercel or Cloudflare — decide in Phase 4).

## Conventions
- Never hard-code or commit secrets (API keys, tokens). Use environment variables only; report
  configuration presence as booleans. Add a `.env.example`.
- Keep the AI provider behind a single `reviewEngine` interface (easy to swap / to simulate in
  tests without spending tokens).
- Keep the GitHub read path resilient: handle private/empty/huge repos gracefully; cap history
  depth so a demo repo loads fast.
- User-facing errors are generic; operator detail goes to server logs only.
- Small, testable modules. Prefer clear code over cleverness.

## Commands (to be finalized as code lands)
- Install: `npm install`
- Dev: `npm run dev`
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
