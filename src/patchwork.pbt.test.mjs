// Patchwork — property-based tests.
//
// Instead of a few hand-picked examples, these generate hundreds of random
// (but valid) inputs and assert invariants that must hold for ALL of them.
// A tiny zero-dependency harness keeps the project dependency-free; it uses a
// seeded PRNG so any failure is reproducible from the printed seed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { splitDiffByFile, parseRepo } from "./github/fetch.mjs";

// ---- tiny seeded PRNG (mulberry32) ----
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float: next,
    int: (n) => Math.floor(next() * n), // 0..n-1
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// forAll: run `prop` over `runs` generated cases; rethrow with the seed on failure.
function forAll(gen, prop, { runs = 400, seed = 0xc0ffee } = {}) {
  for (let i = 0; i < runs; i++) {
    const rng = makeRng((seed + i * 2654435761) >>> 0);
    const value = gen(rng);
    try {
      prop(value, rng);
    } catch (err) {
      err.message = `property failed on run ${i} (seed ${seed}) with input:\n` +
        JSON.stringify(value, null, 2).slice(0, 1200) + "\n\n" + err.message;
      throw err;
    }
  }
}

const LC = "abcdefghijklmnopqrstuvwxyz0123456789";
const token = (rng, min = 1, max = 8) => {
  const n = min + rng.int(max - min + 1);
  let s = "";
  for (let i = 0; i < n; i++) s += LC[rng.int(LC.length)];
  return s;
};

// ---------------------------------------------------------------------------
// Property 1: splitDiffByFile never loses or mis-attributes a file, even when a
// patch BODY contains lines that look like diff headers.
// ---------------------------------------------------------------------------
function genDiffCase(rng) {
  const k = 1 + rng.int(5); // 1..5 files
  const files = [];
  const lines = [];
  for (let i = 0; i < k; i++) {
    const segs = 1 + rng.int(3);
    let parts = [];
    for (let s = 0; s < segs; s++) parts.push(token(rng, 1, 6));
    const name = parts.join("/") + `_${i}.${rng.pick(["js", "ts", "md", "json"])}`;
    const header = `diff --git a/${name} b/${name}`;
    const body = [
      `index ${token(rng, 6, 7)}..${token(rng, 6, 7)} 100644`,
      `--- a/${name}`,
      `+++ b/${name}`,
      `@@ -1,3 +1,3 @@`,
    ];
    const m = 1 + rng.int(4);
    for (let j = 0; j < m; j++) {
      const prefix = rng.pick([" ", "+", "-"]);
      // 1-in-5 lines is an ADVERSARIAL line that looks like a header but is part
      // of the patch body (prefixed with +/-/space). It must stay in THIS file.
      const content = rng.int(5) === 0
        ? `diff --git a/trap${i}${j} b/trap${i}${j}`
        : `line ${rng.int(1000)} ${token(rng, 1, 5)}`;
      body.push(prefix + content);
    }
    lines.push(header, ...body);
    files.push({ name, header, body });
  }
  return { diffText: lines.join("\n"), files };
}

test("PBT: splitDiffByFile preserves every file and its lines (400 random diffs)", () => {
  forAll(genDiffCase, ({ diffText, files }) => {
    const parts = splitDiffByFile(diffText);
    assert.equal(parts.length, files.length, "wrong number of files");
    for (let i = 0; i < files.length; i++) {
      assert.equal(parts[i].file, files[i].name, "file name/order changed");
      assert.ok(parts[i].patch.startsWith("diff --git a/"), "section must start at a header");
      assert.ok(parts[i].patch.startsWith(files[i].header), "section started at the wrong header");
      // Every body line (including the adversarial header-like ones) stays put.
      for (const line of files[i].body) {
        assert.ok(parts[i].patch.includes(line), `lost or misplaced line: ${line}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: parseRepo reads the same {owner, repo} from every accepted form.
// ---------------------------------------------------------------------------
function genRepoCase(rng) {
  const owner = token(rng, 1, 12);
  // repo: a token, sometimes with an internal dot (e.g. socket.io); never ".git".
  let repo = token(rng, 1, 12);
  if (rng.int(3) === 0) repo += "." + token(rng, 1, 6);
  return { owner, repo };
}

test("PBT: parseRepo agrees across shorthand, URL, .git and SSH forms (400 cases)", () => {
  forAll(genRepoCase, ({ owner, repo }) => {
    const forms = [
      `${owner}/${repo}`,
      `https://github.com/${owner}/${repo}`,
      `http://github.com/${owner}/${repo}`,
      `https://github.com/${owner}/${repo}.git`,
      `git@github.com:${owner}/${repo}.git`,
    ];
    for (const form of forms) {
      const got = parseRepo(form);
      assert.deepEqual(got, { owner, repo }, `parsed "${form}" wrong`);
    }
  });
});
