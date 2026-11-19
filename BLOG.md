# Building Patchwork with Kiro: making a codebase remember *why*

*Written as part of the Kiroween 2026 hackathon.*

Every file in a large codebase was shaped by many engineers over years. Each change was made
for a reason — a money-safety fix, a security lock, a pricing correction. But that reasoning
lives in commit history almost nobody reads. When an engineer leaves, the *why* leaves with
them, and the next person quietly reintroduces a bug that was fixed on purpose two years ago.

For Kiroween 2026 I built **Patchwork** to fix that. You point it at a GitHub pull request;
for each changed file it reconstructs the knowledge behind that area of the code from its
history, and warns you — before you merge — if your change undoes a decision someone made on
purpose. And it cites the exact commit the warning comes from, so it never just makes things up.

It works on real repositories. Run it on `expressjs/express` and it catches that lowering the
`body-parser` version would reintroduce a documented CVE fix, and it names the commit that
fixed it. Live app: https://patchwork-1-axbd.onrender.com · Code: https://github.com/ayanmohamedali7-blip/patchwork

## The Frankenstein angle

Patchwork fits Kiroween's *Frankenstein* category: it stitches together the expertise of every
engineer who shaped an area of the code into one assistant that guards it — a creation
assembled from many contributors' knowledge, built in an inventor's workshop. Nothing
supernatural; just history, made to speak at the moment it matters.

## How I built it with Kiro

This is the part I actually want to talk about, because building *with* Kiro was different from
how I usually work.

**Spec-first, not vibe-first.** Instead of jumping into code, I wrote the feature as a spec:
requirements (EARS-style acceptance criteria), a design doc, and a task list, all under
`/.kiro/specs`. That sounds like overhead, but it kept the whole build honest — every module
traced back to a requirement, and I made one deliberate design decision early (one shared
"knowledge builder" feeding both the local-git and GitHub-API paths) that saved me from
duplicating logic later.

**Steering docs did the "remembering" for me.** I put the stack, the folder structure, and a
hard rule about the project's theme into `/.kiro/steering`. After that, when I asked Kiro's
agent to add something, it read the steering first and matched my conventions without me
repeating them every time.

**The moment it clicked.** I asked Kiro's agent to add a small feature — a one-line,
history-grounded "next step" on every warning. It explored the project, ran my test suite to
establish a baseline (4/4 passing), implemented the change across the review engine and the UI,
and kept the tests green — all from a single prompt, following the steering docs. It cost about
0.6 credits and took around four and a half minutes. That was the first time an AI tool felt
like it was building *with* me, not autocompleting under me.

**Hooks and MCP.** I wired two agent hooks: a "dogfood" hook that runs Patchwork's own idea on
each source save (the tool guards the tool), and a syntax-guard hook that runs `node --check`
across the source after each turn so a broken edit never lingers. I also configured a GitHub
MCP server so the agent could read repositories while building — fitting, for a tool that is all
about reading git history.

## What I'd tell someone starting with Kiro

Write the spec and the steering docs first, even if it feels slow. That's what turns the agent
from a fast autocomplete into something that builds the thing you actually meant. The specs,
steering, hooks and MCP config are all committed in the repo's `/.kiro` directory if you want to
see exactly how it's set up.

Patchwork — the knowledge behind your code, stitched back together, so a change never breaks
what someone built on purpose. Built with Kiro.
