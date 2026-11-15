# Requirements — Patchwork Review

## Introduction
Patchwork reconstructs the reasoning behind each area of a codebase from its git
history and warns a contributor before a change undoes a decision that was made on
purpose. This spec covers the core review feature: from a GitHub pull request to a
grounded, cited set of warnings shown in a web UI.

## Requirement 1 — Reconstruct area knowledge from history
**User story:** As a reviewer, I want the knowledge behind a file reconstructed from its
history, so that I understand why it is the way it is before I judge a change.

Acceptance criteria (EARS):
1. WHEN given a repository and a file path, THE SYSTEM SHALL return the file's commit
   history (author, date, subject, body) from either a local git repo or the GitHub API.
2. WHEN building knowledge, THE SYSTEM SHALL identify the primary contributors and the
   commits that carry explicit reasoning (decisions, fixes, reverts, security/money notes).
3. IF a file has no history, THEN THE SYSTEM SHALL report it as a new file rather than error.
4. THE SYSTEM SHALL use one shared knowledge builder for the local and GitHub sources so
   both behave identically.

## Requirement 2 — Review a proposed change against that knowledge
**User story:** As a contributor, I want a change reviewed against the area's recorded
reasoning, so that I am warned before I break something built on purpose.

Acceptance criteria (EARS):
1. WHEN given a diff and the area's knowledge, THE SYSTEM SHALL produce a verdict plus a list
   of warnings, each with a severity (high/medium/low) and the recorded reason it is based on.
2. THE SYSTEM SHALL ground every warning only in the provided history and SHALL NOT fabricate.
3. IF no model key is configured OR the model call fails, THEN THE SYSTEM SHALL fall back to a
   heuristic review so the pipeline never hard-fails.
4. WHEN the model is temporarily unavailable (429/500/503/timeout), THE SYSTEM SHALL retry with
   backoff before falling back.

## Requirement 3 — Review a GitHub pull request end to end
**User story:** As a maintainer, I want to point Patchwork at a public repo and a PR, so that
I see per-file warnings without cloning anything.

Acceptance criteria (EARS):
1. WHEN given `owner/repo` and a PR number, THE SYSTEM SHALL fetch the PR diff and split it per file.
2. IF no PR number is given, THEN THE SYSTEM SHALL use the most recent merged PR.
3. FOR each changed file, THE SYSTEM SHALL reconstruct its knowledge and review its patch.
4. THE SYSTEM SHALL order files so the highest-severity findings appear first.

## Requirement 4 — Web interface
**User story:** As a user, I want a clear page to run a review and read the results.

Acceptance criteria (EARS):
1. THE SYSTEM SHALL serve a single-page UI with inputs for repo and optional PR number.
2. WHEN a review runs, THE SYSTEM SHALL show a loading state, then per-file cards with the
   knowledge summary, verdict, and severity-coded warnings with their citations.
3. IF the review fails, THEN THE SYSTEM SHALL show a generic error message (no internal detail).
4. THE SYSTEM SHALL be legible on a phone-width screen and in a dark theme.

## Non-functional
- No secret is ever logged, embedded, or sent to the client; configuration presence is boolean.
- The theme is an inventor's workshop (Frankenstein). No ghosts/spirits/death/occult content.
