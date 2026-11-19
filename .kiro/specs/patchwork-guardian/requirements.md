# Requirements — Patchwork Guardian

## Introduction
The core review feature (see `../patchwork-review/`) proves the idea on demand through a web
UI. This spec covers making Patchwork *stand guard by itself*: reviewing every pull request
automatically, naming the person behind each cited decision, placing each warning on the exact
line it concerns, and shipping the whole reviewer as a reusable Kiro Power. This is the "would a
team let it guard their code every day" test, not "would someone try it once."

## Requirement 1 — Guard every pull request automatically (GitHub Action)
**User story:** As a maintainer, I want Patchwork to review each PR on its own, so that a change
that undoes a recorded decision is caught without anyone remembering to run a tool.

Acceptance criteria (EARS):
1. WHEN a pull request is opened, synchronized, or reopened, THE SYSTEM SHALL run the review over
   the PR's changed files and post the result as a comment.
2. WHEN it has already commented on a PR, THE SYSTEM SHALL update that same comment in place rather
   than add a new one on each push.
3. IF no `GEMINI_API_KEY` secret is configured, THEN THE SYSTEM SHALL still run the grounded
   heuristic review so the Action never hard-fails.
4. THE SYSTEM SHALL request only `contents: read` and `pull-requests: write` permissions and SHALL
   use the Action-provided `GITHUB_TOKEN`.

## Requirement 2 — Name who made each decision ("ask who")
**User story:** As a contributor warned about a change, I want to know who recorded the decision,
so that I know who to ask before I override it.

Acceptance criteria (EARS):
1. WHEN a warning is based on a specific notable commit, THE SYSTEM SHALL attach that commit's
   author and short hash to the warning.
2. WHEN no cited commit matches a warning, THE SYSTEM SHALL leave the warning unchanged (no guess).
3. THE SYSTEM SHALL surface the attribution in every channel: the web UI, the PR summary comment,
   and the inline review.

## Requirement 3 — Place each warning on the exact changed line (inline review)
**User story:** As a reviewer reading a PR, I want the warning to sit on the line it concerns, so
that I see it in the diff instead of hunting through a summary.

Acceptance criteria (EARS):
1. WHEN a changed file has at least one warning, THE SYSTEM SHALL post a review comment anchored to
   the first added (else context) line of that file's first hunk.
2. THE SYSTEM SHALL post the inline review only when a PR is opened or reopened, not on every push,
   so a resynchronized PR does not accumulate duplicate inline threads.
3. IF the diff for a file cannot be parsed to a line, THEN THE SYSTEM SHALL skip the inline comment
   for that file but still include it in the summary.
4. IF posting the inline review fails, THEN THE SYSTEM SHALL log and continue; the summary comment
   SHALL NOT be lost.

## Requirement 4 — Ship as a reusable Kiro Power (MCP server)
**User story:** As a developer in another workspace, I want Patchwork's review available as a tool
my Kiro agent can call, so that it can ask a file's history for its reasons before changing it.

Acceptance criteria (EARS):
1. THE SYSTEM SHALL expose a zero-dependency stdio MCP server speaking newline-delimited JSON-RPC
   2.0 (`initialize`, `tools/list`, `tools/call`).
2. THE SYSTEM SHALL offer `patchwork_review` (review a repo/PR) and `file_knowledge` (reconstruct one
   file's recorded reasons), reusing the same `pipeline.mjs` and `github/fetch.mjs` as the app.
3. THE SYSTEM SHALL mark the read-only `file_knowledge` tool auto-approvable and SHALL read its
   credentials from the environment, never from arguments.

## Requirement 5 — A guarded repo advertises it (badge)
**User story:** As a repo owner, I want a badge that shows Patchwork guards this repo.

Acceptance criteria (EARS):
1. THE SYSTEM SHALL serve a self-contained SVG badge at `/badge/<owner>/<repo>.svg` with no external
   resources, themed as the inventor's workshop.
2. THE SYSTEM SHALL set a cache header so the badge is cheap to embed in a README.

## Non-functional
- No secret is ever logged, embedded in output, or returned to a client; presence is boolean only.
- Every added line of history attribution is grounded in a real commit — never fabricated.
- The theme stays the inventor's workshop (Frankenstein); no occult content.
