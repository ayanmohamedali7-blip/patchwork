import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKnowledge } from "./history/analyze.mjs";
import { splitDiffByFile } from "./github/fetch.mjs";
import { heuristicReview } from "./review/engine.mjs";

const commits = [
  { hash: "aaaaaaaa", author: "Dana", date: "2026-01-02T00:00:00Z", subject: "wip", body: "" },
  { hash: "bbbbbbbb", author: "Dana", date: "2026-02-01T00:00:00Z",
    subject: "Lock money table writes to service role for security", body: "Prevents client tampering; do not relax." },
  { hash: "cccccccc", author: "Omar", date: "2026-03-01T00:00:00Z",
    subject: "Fix refund race (exactly-once)", body: "Refund must be guarded by a ref marker." },
];

test("buildKnowledge summarizes contributors and surfaces notable commits", () => {
  const k = buildKnowledge("src/wallet.mjs", commits);
  assert.equal(k.exists, true);
  assert.equal(k.totalCommits, 3);
  assert.ok(k.contributors.length === 2);
  assert.equal(k.contributors[0].author, "Dana"); // most changes first
  // the two explained commits are notable; the "wip" is not
  const subjects = k.notableCommits.map((c) => c.subject);
  assert.ok(subjects.some((s) => /service role/i.test(s)));
  assert.ok(subjects.some((s) => /refund/i.test(s)));
  assert.ok(!subjects.includes("wip"));
});

test("buildKnowledge reports a file with no history as new", () => {
  const k = buildKnowledge("src/new.mjs", []);
  assert.equal(k.exists, false);
  assert.equal(k.totalCommits, 0);
});

test("splitDiffByFile splits a multi-file unified diff", () => {
  const diff = [
    "diff --git a/src/a.js b/src/a.js",
    "index 111..222 100644",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "diff --git a/src/b.js b/src/b.js",
    "--- a/src/b.js",
    "+++ b/src/b.js",
    "@@ -1 +1 @@",
    "-x",
    "+y",
  ].join("\n");
  const parts = splitDiffByFile(diff);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].file, "src/a.js");
  assert.equal(parts[1].file, "src/b.js");
  assert.ok(parts[0].patch.includes("+new"));
});

test("heuristicReview flags sensitive history", () => {
  const k = buildKnowledge("src/wallet.mjs", commits);
  const r = heuristicReview(k, "some diff touching refunds");
  assert.ok(r.warnings.length > 0);
  assert.equal(r.engine, "heuristic");
});
