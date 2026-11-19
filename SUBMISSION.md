# Patchwork — Kiroween 2026 submission materials

Working copy of everything we paste into the Devpost "Create project" form, plus the
demo-video script. (This file is for us — it's fine that it's in the repo.)

- **Live app:** https://patchwork-1-axbd.onrender.com
- **GitHub:** https://github.com/ayanmohamedali7-blip/patchwork
- **Category:** Frankenstein
- **Demo video:** _(YouTube link — add after recording)_

---

## Title
Patchwork — the knowledge behind your code, stitched back together

## Tagline (short)
Patchwork reads a repo's git history, reconstructs the reasoning behind each file, and
warns you before a change breaks what someone built on purpose.

## The problem (elevator)
Every file in a large codebase was shaped by many engineers over years. Each change was
made for a reason — a money-safety fix, a security lock, a pricing correction — but that
reasoning lives in commit history almost nobody reads. When an engineer leaves, the *why*
leaves too, and new contributors quietly reintroduce old bugs.

## What it does
Point Patchwork at a GitHub pull request. For each changed file it:
1. Pulls the file's full history from the GitHub API (contributors + the reasons recorded
   in commit messages — fixes, reverts, security/money notes).
2. Reconstructs the "knowledge" behind that area of the code.
3. Reviews the change against that knowledge with an AI engine (Google Gemini), grounded
   strictly in the history — and warns you, citing the exact commit each warning comes from.

It works on real repos: run it on `expressjs/express` and it catches that lowering the
`body-parser` version would reintroduce a documented CVE fix — and names the commit.

## The Frankenstein angle (category)
Patchwork **stitches together** the expertise of every engineer who shaped an area of the
code into **one assistant** that guards it — a creation assembled from many contributors'
knowledge, built in an inventor's workshop. The UI wears that workshop costume. Nothing
supernatural: just history, made to speak at the moment it matters.

## How it works (tech)
```
owner/repo + PR  →  GitHub API (diff + per-file history)
                 →  buildKnowledge()  (contributors + the "why")
                 →  reviewChange()    (Gemini, grounded in that history, never invented)
                 →  severity-ranked, cited warnings in a themed web UI
```
- Grounded, never invented: the model warns only from the provided history and cites the
  commit behind each warning.
- Fail-open availability, fail-closed truth: if the model key is missing or the API is down,
  a heuristic review still runs; but no warning is fabricated.
- Zero runtime dependencies: `node:http`, `fetch`, the GitHub REST API. Easy to run and deploy.

## Built with — list for Devpost
Node.js, TypeScript-style ESM, Google Gemini (gemini-3.5-flash-lite), GitHub REST API,
a hand-built workshop-themed UI (vanilla JS/CSS), deployed on Render. Built with **Kiro**.

---

## How Kiro was used (the judged write-up — paste into Devpost)

Patchwork was developed with Kiro's spec-driven workflow, using its core features. The full
evidence is committed in the repo's `/.kiro` directory.

**Kiro IDE + CLI.** We primarily used the Kiro IDE agent, and launched it from the terminal
with the Kiro CLI (`kiro chat --mode agent`) to run a build task against the open workspace —
a nice example of driving the same agent from two surfaces.

**Spec-driven development (`.kiro/specs/patchwork-review/`).** We wrote the feature as a spec
first: `requirements.md` (EARS-style acceptance criteria), `design.md` (architecture and the
key decisions — one shared knowledge builder for the local and GitHub sources, a
provider-agnostic review engine), and `tasks.md`. Structuring the work this way kept the build
honest and testable, versus unstructured "vibe coding": every module traced back to a
requirement, and the review engine stayed swappable by design.

**Steering docs (`.kiro/steering/`).** `product.md`, `tech.md`, and `structure.md` gave Kiro
standing rules — the stack, the folder layout, and a hard theme boundary (an inventor's
workshop; no occult content). When we asked Kiro's agent to add a feature, it read the steering
first and matched our conventions without being told each time.

**Agent hooks (`.kiro/hooks/`).** Two hooks: a *dogfood review* hook (`PostFileSave`) that runs
Patchwork's own idea on each source edit — the tool guards the tool — and a *syntax guard* hook
(`Stop`) that runs `node --check` across the source after each turn so a broken edit never lingers.

**MCP (`.kiro/settings/mcp.json`).** We configured a GitHub MCP server and a fetch server so the
Kiro agent could read repositories and the web while building — exactly what a tool about reading
git history benefits from.

**What the agent actually built.** We had Kiro's agent implement a real feature end to end: a
one-line, history-grounded "next step" added to every warning (touching the review engine's prompt
schema, the heuristic reviewer, and the UI). It explored the project, ran the test suite to confirm
the baseline (4/4 passing), made the change, and kept the tests green — all from one prompt,
following the steering docs. (~0.6 credits, ~4.5 minutes.)

---

## Demo video script (< 3 minutes) — record screen + voice

> Keep it under 3:00. Show the app actually working. English narration (or English subtitles).

**0:00–0:20 — The hook.** On screen: the Patchwork home page (the live URL).
Say: "Every file in a big codebase was built by many people, for reasons that disappear when
they leave. Patchwork brings those reasons back — and warns you before you break them."

**0:20–0:50 — The problem, made concrete.** Say: "Say you open a pull request that bumps a
dependency. You don't know that version was pinned to fix a security hole two years ago. Your
teammate who knew that is gone. Patchwork remembers for you."

**0:50–1:40 — Live demo.** Type `expressjs/express` (or click the chip) and run a review.
As the results appear, narrate: "Patchwork read this file's real history — 60 changes by 23
people — and pulled out the decisions that matter." Point to the "what this file's history
says" list, then the HIGH warning. Say: "It caught that lowering body-parser would undo a
documented CVE fix — and it cites the exact commit. It never makes things up; every warning
is grounded in the real history." Show the "Next step" line.

**1:40–2:30 — Built with Kiro.** Switch to the Kiro window / the `/.kiro` folder. Say:
"Patchwork was built spec-first with Kiro. Steering docs set the rules, a full spec drove the
feature, agent hooks automate checks, and MCP connects Kiro to GitHub. I even had Kiro's own
agent build a feature end to end — it ran the tests, made the change, and kept them green."

**2:30–2:55 — Close.** Back on the app. Say: "Patchwork — the knowledge behind your code,
stitched back together, so a change never breaks what someone built on purpose. Built with Kiro."

**End. Upload to YouTube as Public. Put the link at the top of this file and in the Devpost form.**
