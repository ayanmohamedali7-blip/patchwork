// Syntax guard — runs `node --check` on every .mjs under src/. Used by the
// Kiro "Syntax guard" hook (trigger: Stop) so a broken edit never lingers.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".mjs")) out.push(full);
  }
  return out;
}

let failed = 0;
for (const file of walk("src")) {
  try {
    execFileSync("node", ["--check", file], { stdio: "pipe" });
  } catch (e) {
    failed++;
    console.error(`✗ syntax error in ${file}`);
    console.error(String(e.stderr || e.message).trim());
  }
}
if (failed) {
  console.error(`\nSyntax guard: ${failed} file(s) failed.`);
  process.exit(1);
}
console.log("Syntax guard: all source files OK.");
