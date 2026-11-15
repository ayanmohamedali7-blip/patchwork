// Patchwork — the pull-request review pipeline, shared by the CLI and the web server.

import {
  parseRepo,
  getPullRequestDiff,
  splitDiffByFile,
  extractKnowledgeFromApi,
  getLatestMergedPr,
} from "./github/fetch.mjs";
import { reviewChange } from "./review/engine.mjs";

/**
 * Review a GitHub pull request: for each changed file, reconstruct the area's
 * knowledge from history and run the review engine against the file's patch.
 * Returns a structured, UI-ready object.
 */
export async function reviewPullRequest({ repo, pr, token, maxFiles = 6 } = {}) {
  const { owner, repo: name } = parseRepo(repo);

  let number = pr ? Number(pr) : null;
  let title = "";
  if (!number) {
    const latest = await getLatestMergedPr(owner, name, { token });
    number = latest.number;
    title = latest.title;
  }

  const diff = await getPullRequestDiff(owner, name, number, { token });
  const sections = splitDiffByFile(diff).slice(0, maxFiles);

  const files = [];
  for (const { file, patch } of sections) {
    // Skip binary files (images, fonts, …) — no text reasoning to protect.
    if (/\nBinary files .* differ|\nGIT binary patch/.test(patch)) {
      files.push({ file, isBinary: true, knowledge: null, review: null });
      continue;
    }
    const knowledge = await extractKnowledgeFromApi(owner, name, file, { token });
    let review = null;
    if (knowledge.exists) review = await reviewChange(knowledge, patch);
    files.push({ file, isNew: !knowledge.exists, knowledge, review });
  }

  // Sort: files with the highest-severity warnings first (most useful on screen).
  const rank = { high: 3, medium: 2, low: 1 };
  const worst = (f) =>
    (f.review?.warnings || []).reduce((m, w) => Math.max(m, rank[(w.severity || "").toLowerCase()] || 0), 0);
  files.sort((a, b) => worst(b) - worst(a));

  return {
    owner,
    repo: name,
    number,
    title,
    url: `https://github.com/${owner}/${name}/pull/${number}`,
    fileCount: files.length,
    files,
  };
}
