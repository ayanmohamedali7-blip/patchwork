// Patchwork — review a GitHub pull request end to end (no clone):
//   node src/github-cli.mjs <owner/repo> [pr-number]
// With no PR number, it picks the most recent merged PR.

import { loadEnv } from "./lib/env.mjs";
import {
  parseRepo,
  getPullRequestDiff,
  splitDiffByFile,
  extractKnowledgeFromApi,
  getLatestMergedPr,
} from "./github/fetch.mjs";
import { reviewChange } from "./review/engine.mjs";

loadEnv();
const token = (process.env.GITHUB_TOKEN || "").trim() || undefined;

async function main() {
  const [repoArg, prArg] = process.argv.slice(2);
  if (!repoArg) {
    console.error("usage: node src/github-cli.mjs <owner/repo> [pr-number]");
    process.exit(1);
  }
  const { owner, repo } = parseRepo(repoArg);

  let number = prArg ? Number(prArg) : null;
  if (!number) {
    const latest = await getLatestMergedPr(owner, repo, { token });
    number = latest.number;
    console.log(`\n(no PR given — using most recent merged PR #${number}: ${latest.title})`);
  }

  console.log(`\n🔧 Patchwork — reviewing ${owner}/${repo} PR #${number}\n`);

  const diff = await getPullRequestDiff(owner, repo, number, { token });
  const files = splitDiffByFile(diff).slice(0, 4); // keep the demo snappy
  console.log(`Changed files in this PR (showing ${files.length}):\n`);

  for (const { file, patch } of files) {
    console.log(`\n────────────────────────────────────────`);
    console.log(`📄 ${file}`);
    const knowledge = await extractKnowledgeFromApi(owner, repo, file, { token });
    if (!knowledge.exists) {
      console.log(`   (new file — no prior history to protect)`);
      continue;
    }
    console.log(`   ${knowledge.summary}`);
    const review = await reviewChange(knowledge, patch);
    console.log(`   engine: ${review.engine}`);
    console.log(`   verdict: ${review.summary}`);
    for (const w of review.warnings) {
      console.log(`     [${(w.severity || "?").toUpperCase()}] ${w.message}`);
      if (w.basedOn) console.log(`            ↳ ${w.basedOn}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error("Patchwork error:", e.message);
  process.exit(1);
});
