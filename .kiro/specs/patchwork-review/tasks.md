# Tasks — Patchwork Review

- [x] 1. Knowledge engine (local git) — `buildKnowledge`, `getFileHistory`, `getHotspots`,
      notable-commit scoring. _(Req 1)_
- [x] 2. Review engine — `reviewChange` with Gemini REST + heuristic fallback + retry/timeout;
      non-fabricating prompt. _(Req 2)_
- [x] 3. GitHub source — `getFileHistoryFromApi`, `getPullRequestDiff`, `splitDiffByFile`,
      `getLatestMergedPr`, `extractKnowledgeFromApi`. _(Req 1, 3)_
- [x] 4. Pipeline — `reviewPullRequest`, severity sort. _(Req 3)_
- [x] 5. Web server (node:http) + themed single-page UI. _(Req 4)_
- [x] 6. `.env` loader; model configuration by env; secrets kept server-side. _(Non-functional)_
- [x] 7. Kiro integration — steering docs, MCP (GitHub + fetch), hooks (dogfood review, syntax guard).
- [x] 8. Unit tests (`node --test`) for buildKnowledge, splitDiffByFile, heuristicReview.
- [ ] 9. Deploy to a public URL; set env there.
- [ ] 10. Empty/edge-case polish: huge diffs, binary files, private repos, rate-limit UX.
- [ ] 11. Sub-3-minute demo video + Devpost submission; confirm `/.kiro` is committed.
