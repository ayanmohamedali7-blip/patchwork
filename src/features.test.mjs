import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { enrichWarnings } from "./review/engine.mjs";
import { anchorLine } from "./action.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test('enrichWarnings adds "who to ask" from the cited commit', () => {
  const knowledge = {
    notableCommits: [
      { hash: "8ba0c07a", author: "Mayvis", subject: "deps: bump body-parser to ^2.3.0 to fix CVE-2026-12590" },
      { hash: "11112222", author: "Dana", subject: "chore: tidy" },
    ],
  };
  const [w] = enrichWarnings(
    [{ severity: "high", message: "x", basedOn: "deps: bump body-parser to ^2.3.0 to fix CVE-2026-12590 (#7390)" }],
    knowledge
  );
  assert.equal(w.askWho, "Mayvis");
  assert.equal(w.commit, "8ba0c07");
});

test("enrichWarnings leaves a warning alone when nothing matches", () => {
  const [w] = enrichWarnings([{ severity: "low", message: "y", basedOn: "contributor spread" }], { notableCommits: [] });
  assert.equal(w.askWho, undefined);
});

test("anchorLine points at the first added line of the first hunk", () => {
  const patch = [
    "diff --git a/src/server.mjs b/src/server.mjs",
    "@@ -10,4 +10,4 @@ context",
    " const a = 1;",      // new line 10
    " const b = 2;",      // new line 11
    "-old();",            // removed — does not advance new side
    "+newCall();",        // added — new line 12
  ].join("\n");
  assert.equal(anchorLine(patch), 12);
});

test("anchorLine falls back to a context line when there is no addition", () => {
  const patch = ["diff --git a/x b/x", "@@ -5,2 +5,1 @@", " keep();", "-drop();"].join("\n");
  assert.equal(anchorLine(patch), 5);
});

test("Kiro Power MCP server lists its tools over stdio", async () => {
  const p = spawn("node", [join(here, "..", "power-patchwork", "server.mjs")], { stdio: ["pipe", "pipe", "ignore"] });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  await new Promise((r) => setTimeout(r, 1500));
  p.kill();
  const msgs = out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const init = msgs.find((m) => m.id === 1);
  const list = msgs.find((m) => m.id === 2);
  assert.equal(init.result.serverInfo.name, "patchwork");
  const names = list.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["file_knowledge", "patchwork_review"]);
});
