<h1 align="center">🔧 Patchwork</h1>
<p align="center"><b>The reasons behind your code leave when people do. Patchwork stitches them back together — and warns you before a change breaks what someone built on purpose.</b></p>
<p align="center"><i>Kiroween 2026 · Category: Frankenstein</i></p>

---

## The problem
Every file in a large codebase was shaped by many engineers over years. Each change was made
for a reason — a money-safety fix, a security lock, a pricing correction — but that reasoning
lives in commit history almost nobody reads. When an engineer leaves, the *why* leaves too.
New contributors then change code they don't understand and quietly reintroduce old bugs.

## The idea (the "Frankenstein")
Patchwork **stitches together** the expertise of every engineer who shaped an area of the code
into **one assistant** that guards it. Point it at a GitHub pull request; for each changed file
it reconstructs the area's knowledge from history and warns you when your change undoes a
decision that was made on purpose — citing the exact commit it came from.

> The costume is an inventor's workshop: many parts, assembled into one creation. Nothing
> supernatural — just history, made to speak at the moment it matters.

## It works on real repositories
Run it on `expressjs/express` and it catches that lowering the `body-parser` version would
reintroduce a documented CVE fix — and it names the commit that fixed it. No clone required.

## How it works
```
owner/repo + PR  →  GitHub API (diff + per-file history)
                 →  buildKnowledge()  (contributors + the "why" in commit messages)
                 →  reviewChange()    (Gemini, grounded strictly in that history)
                 →  severity-ranked, cited warnings in a themed web UI
```
- **Grounded, never invented.** The model is told to warn only from the provided history and to
  cite the commit each warning is based on.
- **Fail-open availability, fail-closed truth.** If the model key is missing or the API is down,
  a heuristic review still runs; but no warning is ever fabricated.
- **Zero runtime dependencies.** `node:http`, `fetch`, and the GitHub REST API only.

## Built with Kiro
Patchwork was built spec-first with Kiro, using its core features:
- **Steering** (`.kiro/steering/`) — product, tech, and structure rules that keep every change on
  track, including the hard theme boundary (an inventor's workshop; no occult content).
- **Specs** (`.kiro/specs/patchwork-review/`) — requirements (EARS) → design → tasks.
- **Agent hooks** (`.kiro/hooks/`) — *dogfood review*: on every source save, Kiro runs Patchwork's
  own idea on the edit and warns if it undoes a recorded decision; plus a *syntax guard* on Stop.
- **MCP** (`.kiro/settings/mcp.json`) — GitHub + fetch servers, so the Kiro agent can read repos
  and the web while building.

## Run it locally
```bash
cp .env.example .env     # add a free Gemini key from https://aistudio.google.com/apikey
npm test                 # unit tests
node src/server/index.mjs # http://localhost:4175
```
CLI, no server:
```bash
node src/github-cli.mjs expressjs/express       # review the latest merged PR
node src/cli.mjs <path-to-local-repo> <file>    # inspect one file's knowledge
```

## Tech
TypeScript-style ESM on Node 18+, Google Gemini (`gemini-3.5-flash-lite`, swappable), GitHub REST,
a hand-built workshop-themed UI. No frameworks.
