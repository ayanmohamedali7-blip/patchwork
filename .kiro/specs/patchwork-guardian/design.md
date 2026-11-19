# Design — Patchwork Guardian

## Overview
Four additions turn the on-demand reviewer into something that guards a repo on its own, all
reusing the existing pipeline without touching its core. Nothing here adds a runtime dependency.

## Components
- **.github/workflows/patchwork.yml** — runs on `pull_request: [opened, synchronize, reopened]`
  with `contents: read` + `pull-requests: write`; invokes `node src/action.mjs` with the
  Action `GITHUB_TOKEN` and an optional `GEMINI_API_KEY` secret.
- **src/action.mjs** — the Action entrypoint. Resolves the PR number from the event payload,
  runs `reviewPullRequest`, upserts a single marked comment (`<!-- patchwork-review -->`), and —
  on open/reopen only — posts an inline review.
- **review/engine.mjs → `enrichWarnings(warnings, knowledge)`** — maps each warning's `basedOn`
  text back to the matching notable commit and attaches `askWho` (author) + `commit` (7-char hash).
  Wired into both `heuristicReview` and `geminiReview` so every path carries attribution.
- **src/action.mjs → `anchorLine(patch)`** — parses a unified diff to the first added (else first
  context) line of the first hunk; `-` lines do not advance the new-side counter.
- **power-patchwork/server.mjs** — the Kiro Power: a stdio MCP server (no SDK) that reuses
  `pipeline.mjs` + `github/fetch.mjs` and exposes `patchwork_review` and `file_knowledge`.
- **server/index.mjs → `badgeSvg()`** + `GET /badge/*.svg` — the self-contained workshop badge.

## Key decisions
- **Reuse, don't fork.** The Action, the Power, and the website all call the same
  `reviewPullRequest`. One behaviour, three surfaces — the thing that is tested is the thing that
  guards the PR.
- **Attribution is derived, not stored.** `enrichWarnings` re-derives who from the same notable
  commits the warning already cites, so it can never name someone a warning is not actually based on.
- **Comment once, update in place.** A hidden marker lets the Action find and PATCH its own comment,
  so a PR with ten pushes still shows one tidy review.
- **Inline on open only.** Anchoring on every `synchronize` would stack duplicate threads; the
  summary comment still refreshes on every push, so nothing is lost.
- **Fail soft around the edges.** A parse failure skips one inline comment; an inline-post failure
  is logged and swallowed; a missing model key drops to the heuristic. The summary always survives.

## Data flow (Action)
```
pull_request event
  → resolvePrNumber()            (event payload → number)
  → reviewPullRequest()          (same pipeline as the website)
  → buildComment() + upsertComment()        (one marked summary, updated in place)
  → [open/reopen] getPullRequestDiff() → splitDiffByFile() → anchorLine()
                                          → postInlineReview()   (per-file, on the exact line)
```

## Testing
- `src/features.test.mjs` — `enrichWarnings` adds/omits attribution correctly; `anchorLine`
  resolves added vs context lines; the Kiro Power server lists its two tools over real stdio.
- `src/patchwork.pbt.test.mjs` — property-based: the diff splitter never loses or mis-attributes a
  file (even with diff-header-looking body lines), and `parseRepo` is stable across URL/SSH/.git forms.
- Proven live on this repo: PR #2 reintroduced an error-message information leak and the Action
  flagged it HIGH — summary + inline — citing the commit that fixed it and naming its author.
