// Patchwork CLI — quick way to see the knowledge engine working.
//   node src/cli.mjs <repo-path>                  -> list the repo's hotspots
//   node src/cli.mjs <repo-path> <file-in-repo>   -> reconstruct that area's knowledge

import { extractKnowledge, getHotspots } from "./history/analyze.mjs";

function short(hash) {
  return (hash || "").slice(0, 8);
}

async function main() {
  const [repoPath, filePath] = process.argv.slice(2);
  if (!repoPath) {
    console.error("usage: node src/cli.mjs <repo-path> [file-in-repo]");
    process.exit(1);
  }

  if (!filePath) {
    const hotspots = await getHotspots(repoPath);
    console.log(`\n🔧 Patchwork — hotspots in ${repoPath}`);
    console.log("   (the files that change most — where lost context hurts most)\n");
    for (const h of hotspots) {
      console.log(`   ${String(h.changes).padStart(4)}  ${h.file}`);
    }
    console.log(`\n   Tip: pick one and run:  node src/cli.mjs "${repoPath}" <file>\n`);
    return;
  }

  const k = await extractKnowledge(repoPath, filePath);
  console.log(`\n🔧 Patchwork — knowledge behind  ${k.file}\n`);
  console.log(`   ${k.summary}\n`);

  if (!k.exists) return;

  console.log(`   First seen:   ${k.firstSeen}`);
  console.log(`   Last changed: ${k.lastChanged}`);
  console.log(`   Changes:      ${k.totalCommits}\n`);

  console.log("   Who shaped this area:");
  for (const c of k.contributors.slice(0, 6)) {
    console.log(`     - ${c.author}  (${c.commits} change${c.commits === 1 ? "" : "s"})`);
  }

  console.log("\n   The 'why' worth heeding (notable commits):");
  if (k.notableCommits.length === 0) {
    console.log("     (no clearly-explained commits found)");
  }
  for (const c of k.notableCommits) {
    console.log(`     • [${short(c.hash)}] ${c.subject}  — ${c.author}`);
    if (c.body) {
      const firstLine = c.body.split("\n").find((l) => l.trim());
      if (firstLine) console.log(`         ↳ ${firstLine.trim().slice(0, 120)}`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("Patchwork error:", err.message);
  process.exit(1);
});
