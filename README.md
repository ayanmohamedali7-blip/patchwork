<h1 align="center">🔧 Patchwork</h1>
<p align="center"><b>The reasons behind your code leave when people do. Patchwork stitches them back together — and warns you before a change breaks what someone built on purpose.</b></p>
<p align="center"><i>Kiroween 2026 · Category: Frankenstein</i></p>
<p align="center"><a href="https://patchwork-1-axbd.onrender.com"><img src="https://patchwork-1-axbd.onrender.com/badge/ayanmohamedali7-blip/patchwork.svg" alt="Guarded by Patchwork" /></a></p>

> **Add the badge to any repo:** `[![Guarded by Patchwork](https://patchwork-1-axbd.onrender.com/badge/OWNER/REPO.svg)](https://patchwork-1-axbd.onrender.com)`

---

## The problem
Every file in a large codebase was shaped by many engineers over years. Each change was made
for a reason — a money-safety fix, a security lock, a pricing correction — but that reasoning
lives in commit history almost nobody reads. When an engineer leaves, the *why* leaves too.
New contributors then change code they don't understand and quietly reintroduce old bugs.

## The idea (the "Frankenstein")
Every engineer who shaped a file left something behind in its history — a fix, a lock, a reason
they wrote down. When they move on, those parts are scattered across years of commits nobody
re-reads. Patchwork **gathers the parts and stitches them into one guardian**: point it at a
pull request and, for each changed file, it reconstructs that knowledge from history and warns
you when your change undoes a decision that was made on purpose — citing the exact commit it
came from.

> A creature assembled from many makers, that remembers **why** long after they're gone. The
> costume is an inventor's workshop — many parts, one creation. Nothing supernatural: just
> history, made to speak at the moment it matters.

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

## Guards your repo automatically (GitHub Action)
Patchwork isn't only a website — drop it into any repo and it reviews **every pull request** for
you. The workflow in [`.github/workflows/patchwork.yml`](.github/workflows/patchwork.yml) runs
[`src/action.mjs`](src/action.mjs) on each PR, reconstructs the history behind the changed files,
and posts a single comment (updated in place on new pushes) that cites the commits at risk.
```yaml
on: { pull_request: { types: [opened, synchronize, reopened] } }
permissions: { contents: read, pull-requests: write }
# add GEMINI_API_KEY as a repo secret for AI reviews; without it, the grounded heuristic runs.
```
That's the real test of the idea: not "would someone try this once", but "would a team let it
stand guard on their code every day."

**Proven on this repo — [PR #2](https://github.com/ayanmohamedali7-blip/patchwork/pull/2).** A
change reintroduced an error-message information leak that an earlier commit had fixed. Patchwork
caught it automatically: a **HIGH** summary *and* an inline comment on the exact changed line,
citing the commit that fixed it and naming the person who made that call.

<details><summary><b>Example comment</b> (real output on a PR that lowers <code>body-parser</code> in <code>expressjs/express</code>)</summary>

> ## 🧵 Patchwork review
>
> Reviewed **1** changed file(s) — **1** point(s) worth a second look (**1 high-risk**).
>
> ### `package.json`
> _"package.json" has 60 recorded changes by 23 contributor(s). Primary: Wes Todd, dependabot[bot], Ulises Gascón. 8 commit(s) carry explicit reasoning worth heeding._
>
> 🔴 **HIGH** — The history shows specific version requirements for body-parser to address vulnerabilities such as CVE-2026-12590 (requiring ^2.3.0) and CVE-2025-13466. Downgrading or using ~1.20.9 may reintroduce security risks.
> > ↳ based on: deps: bump body-parser to ^2.3.0 to fix CVE-2026-12590 (#7390) and deps: body-parser@^2.2.1 (#6922)
> > ↳ next step: Read the commit for CVE-2026-12590 and confirm your version choice satisfies the security requirements.

</details>

## Built with Kiro
Patchwork was built spec-first with Kiro, using its core features:
- **Steering** (`.kiro/steering/`) — product, tech, and structure rules that keep every change on
  track, including the hard theme boundary (an inventor's workshop; no occult content).
- **Specs** — requirements (EARS) → design → tasks, for the core
  ([`patchwork-review`](.kiro/specs/patchwork-review/)) *and* the advanced features
  ([`patchwork-guardian`](.kiro/specs/patchwork-guardian/): the Action, attribution, inline
  review, and the Power). The advanced work was spec-driven too, not bolted on.
- **Agent hooks** (`.kiro/hooks/`) — *dogfood review*: on every source save, Kiro runs Patchwork's
  own idea on the edit and warns if it undoes a recorded decision; plus a *syntax guard* on Stop.
- **MCP** (`.kiro/settings/mcp.json`) — GitHub + fetch servers, so the Kiro agent can read repos
  and the web while building.
- **Property-based testing** ([`src/patchwork.pbt.test.mjs`](src/patchwork.pbt.test.mjs)) — beyond a
  few examples, 400 random diffs and repo URLs per property assert the invariants that matter:
  the diff splitter never loses or mis-attributes a file (even when a patch body contains lines
  that *look* like diff headers), and `parseRepo` reads the same `{owner, repo}` from shorthand,
  URL, `.git` and SSH forms. A tiny seeded harness keeps it dependency-free and reproducible.
- **Kiro Power** ([`power-patchwork/`](power-patchwork/)) — Patchwork is packaged as a reusable
  Power: a zero-dependency stdio **MCP server** exposing `patchwork_review` and `file_knowledge`
  so the Kiro agent in *any* workspace can ask a file's history for its reasons before changing it.

## Run it locally
```bash
cp .env.example .env     # add a free Gemini key from https://aistudio.google.com/apikey
npm test                 # unit + property-based tests (node --test)
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
