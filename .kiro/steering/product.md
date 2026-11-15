---
inclusion: always
---

# Product — Patchwork

## What it is
Patchwork is a web tool for software teams. You connect it to a GitHub repository.
It reads the repository's **entire git history**, learns the **reasoning and conventions
behind each area of the code** from every engineer who ever worked on it, and when a new
change (a pull request or a diff) comes in, it produces a **review** that warns the author
before they break something: *"this module was built this way for a reason — here's why,
and here's what your change risks."*

The product rescues **institutional knowledge** — the "why" behind code that normally
walks out the door when an engineer leaves the team.

## The problem (real, and the judges live it)
Large codebases are written by many engineers over years. When someone leaves, the reasons
behind their decisions leave with them. New contributors change code they don't understand
and reintroduce old bugs or break hidden assumptions. Patchwork makes that lost context
speak up at exactly the moment it is needed: on a new change.

## Halloween theme (Kiroween) — category: Frankenstein
Patchwork **stitches together** the expertise of many past engineers into **one assistant**
that guards the codebase — a "creature" assembled from many contributors' knowledge, built
in an inventor's workshop. The costume is a **science / mad-scientist lab** aesthetic.

### HARD RULE — theme boundaries (never cross)
- NO ghosts, spirits, souls, séance, summoning, possession, necromancy, the dead, or the
  afterlife — in code, copy, UI, names, or art. This is a firm requirement from the project
  owner and is non-negotiable.
- The theme is strictly **science / invention / a workshop assembling parts** (Frankenstein
  as an inventor's creation, not anything supernatural).
- Persona framing: Patchwork reconstructs the **knowledge behind an area of the code**, not a
  real named person speaking. Attribute insight to code areas / history, never impersonate a
  specific individual. This is cleaner, safer, and stronger for judges.

## Who it's for
Software teams and open-source maintainers; the demo targets a well-known public open-source
repository with a rich history.

## Goal
Compete for **1st place** in Kiroween 2026 by scoring across all five judging criteria:
Impact, Kiro usage depth, Design, Innovation, and Presentation.

## In scope (MVP that can win)
- Connect to a GitHub repo; pull its history and a target change (PR / diff).
- Build per-area "knowledge" from history; generate a review with warnings and context.
- Polished workshop-themed web UI; a clear, repeatable demo path.
- Deep, documented use of Kiro (specs + steering + hooks + MCP).
- Deployed working URL; a sub-3-minute demo video; Devpost submission.

## Out of scope (to ship on time)
- Not fully automatic on every push — a manual "review this change" action is enough (plus
  one real hook for show).
- No audio, no mobile app.
- Single-repo demo, not a multi-tenant SaaS.
