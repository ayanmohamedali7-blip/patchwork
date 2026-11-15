# Design — Patchwork Review

## Overview
A small Node service with no runtime dependencies. Two history sources feed one shared
knowledge builder; a provider-agnostic review engine turns knowledge + a diff into grounded
warnings; a zero-dependency HTTP server exposes it to a themed single-page UI.

## Components
- **history/analyze.mjs** — local git source. `getFileHistory` (via `git log --follow`),
  `getHotspots`, and the pure `buildKnowledge(file, commits)` used by both sources.
- **github/fetch.mjs** — GitHub API source. `getFileHistoryFromApi`, `getPullRequestDiff`,
  `splitDiffByFile`, `getLatestMergedPr`, `extractKnowledgeFromApi` (→ buildKnowledge).
- **review/engine.mjs** — `reviewChange(knowledge, diff)`. Gemini via REST (no SDK) with
  retry + timeout; `heuristicReview` fallback. One `buildPrompt` that forbids fabrication.
- **pipeline.mjs** — `reviewPullRequest({repo, pr})`: diff → per-file knowledge → review,
  sorted by worst severity.
- **server/index.mjs** — node:http. Serves `public/` and `POST /api/review`.
- **public/index.html** — the workshop-themed UI (vanilla JS, inline CSS).
- **lib/env.mjs** — tiny `.env` loader (no dependency).

## Data flow
`repo + pr → GitHub API (diff + per-file commits) → buildKnowledge → reviewChange(Gemini|heuristic) → JSON → UI cards`

## Key decisions
- **One knowledge builder, two sources.** Keeps local and GitHub paths identical and testable.
- **Provider behind an interface.** Gemini today (free tier, model `gemini-3.5-flash-lite`),
  swappable to Claude/Bedrock without touching the pipeline.
- **Fail open on availability, fail closed on truth.** Missing key / model outage → heuristic
  still runs; but the prompt forbids inventing reasons not present in history.
- **Zero dependencies.** `node:http`, `fetch`, and `git`/GitHub REST only — trivial to deploy.

## Error handling
- GitHub 404 / rate-limit → clear message; 403 rate-limit suggests setting `GITHUB_TOKEN`.
- Model transient errors → retry with backoff, then heuristic fallback.
- Server returns generic errors to the client; detail goes to `console.error` only.

## Testing
- `node --test` unit tests for `buildKnowledge`, `splitDiffByFile`, and the heuristic reviewer.
- `scripts/guard.mjs` syntax-checks all sources (wired to the Stop hook).
