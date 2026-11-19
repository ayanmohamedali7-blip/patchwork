# Tasks — Patchwork Guardian

- [x] 1. GitHub Action entrypoint — `src/action.mjs`: resolve PR from the event, run the pipeline,
      upsert a single marked summary comment. _(Req 1)_
- [x] 2. Workflow — `.github/workflows/patchwork.yml` on opened/synchronize/reopened, least-privilege
      permissions, Action `GITHUB_TOKEN` + optional `GEMINI_API_KEY` secret. _(Req 1)_
- [x] 3. "Ask who" attribution — `enrichWarnings` derives author + short hash from the cited notable
      commit; wired into heuristic and Gemini paths; surfaced in UI, summary, and inline. _(Req 2)_
- [x] 4. Inline line-level review — `anchorLine` + `postInlineReview`; posted on open/reopen only;
      per-file skip + logged-and-continue on failure. _(Req 3)_
- [x] 5. Kiro Power — `power-patchwork/server.mjs`: zero-dep stdio MCP server exposing
      `patchwork_review` and `file_knowledge`; registered in `.kiro/settings/mcp.json`. _(Req 4)_
- [x] 6. Badge — `badgeSvg()` + `GET /badge/<owner>/<repo>.svg`, self-contained, cached. _(Req 5)_
- [x] 7. Tests — `src/features.test.mjs` for enrichWarnings, anchorLine, and the MCP server over
      stdio; all green with the existing unit + property-based suites.
- [x] 8. Proven live — deployed to Render; PR #2 on this repo flagged a real information-leak
      regression (summary + inline, HIGH, cited commit + author). _(Req 1–3)_
