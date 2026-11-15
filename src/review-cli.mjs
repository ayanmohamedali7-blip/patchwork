// Patchwork review test:
//   node src/review-cli.mjs <repo-path> <file-in-repo> [diff-file]
// If no diff file is given, a synthetic "risky" change is used so we can see the
// review engine produce grounded warnings.

import { loadEnv } from "./lib/env.mjs";
import { readFileSync } from "node:fs";
import { extractKnowledge } from "./history/analyze.mjs";
import { reviewChange } from "./review/engine.mjs";

loadEnv();

const SAMPLE_DIFF = `--- a/FILE
+++ b/FILE
@@
-  // refund the wallet if the render fails (exactly-once, guarded by a ref marker)
-  await refundCharge(userId, amount, { ref: renderRef });
+  // (removed refund — assume renders never fail)
@@
-  if (!isServiceRole(ctx)) throw new Error("writes to money tables are service-role only");
+  // allow client writes for speed
`;

async function main() {
  const [repoPath, filePath, diffFile] = process.argv.slice(2);
  if (!repoPath || !filePath) {
    console.error("usage: node src/review-cli.mjs <repo-path> <file-in-repo> [diff-file]");
    process.exit(1);
  }

  const knowledge = await extractKnowledge(repoPath, filePath);
  const diff = diffFile ? readFileSync(diffFile, "utf8") : SAMPLE_DIFF.replaceAll("FILE", filePath);

  console.log(`\n🔧 Patchwork review of a change to  ${filePath}\n`);
  const result = await reviewChange(knowledge, diff);

  console.log(`engine:  ${result.engine}`);
  if (result.error) console.log(`note:    ${result.error}`);
  console.log(`\nsummary: ${result.summary}\n`);
  for (const w of result.warnings) {
    const sev = (w.severity || "?").toUpperCase().padEnd(6);
    console.log(`  [${sev}] ${w.message}`);
    if (w.basedOn) console.log(`           ↳ based on: ${w.basedOn}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("Patchwork error:", e.message);
  process.exit(1);
});
