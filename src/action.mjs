// Patchwork — GitHub Action entrypoint.
//
// Runs on a pull_request event: reviews the PR's changed files against their
// history and posts (or updates) a single Patchwork comment on the PR, so the
// tool guards a real repo automatically instead of only on the website.

import { readFileSync } from "node:fs";
import { reviewPullRequest } from "./pipeline.mjs";
import { getPullRequestDiff, splitDiffByFile } from "./github/fetch.mjs";

const MARKER = "<!-- patchwork-review -->";
const GH = "https://api.github.com";
const APP = "https://patchwork-1-axbd.onrender.com";

const env = (name) => (process.env[name] || "").trim();

function ghHeaders(token) {
  return {
    "User-Agent": "patchwork-code-review",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Prefer the event payload GitHub writes to disk; fall back to a PR_NUMBER env.
function resolvePrNumber() {
  const path = env("GITHUB_EVENT_PATH");
  if (path) {
    try {
      const ev = JSON.parse(readFileSync(path, "utf8"));
      if (ev.pull_request && ev.pull_request.number) return ev.pull_request.number;
      if (ev.number) return ev.number;
    } catch { /* fall through */ }
  }
  const n = Number(env("PR_NUMBER"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// The event action ("opened" / "synchronize" / "reopened").
function eventAction() {
  const path = env("GITHUB_EVENT_PATH");
  if (!path) return "";
  try { return JSON.parse(readFileSync(path, "utf8")).action || ""; } catch { return ""; }
}

// The new-side line to anchor an inline comment on: the first added (else context) line of the first hunk.
export function anchorLine(patch) {
  const lines = String(patch || "").split("\n");
  let cur = null, firstContext = null;
  for (const l of lines) {
    const m = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) { cur = parseInt(m[1], 10); continue; }
    if (cur == null) continue;
    if (l.startsWith("+") && !l.startsWith("+++")) return cur;        // an added line — anchor here
    if (l.startsWith(" ")) { if (firstContext == null) firstContext = cur; cur++; }  // context advances new side
    // "-" removed lines do not advance the new-side counter
  }
  return firstContext;
}

// Post a PR review with comments anchored to the exact changed lines.
async function postInlineReview(owner, repo, number, token, comments) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ event: "COMMENT", comments }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
}

const sevOf = (w) => (w.severity || "low").toLowerCase();
const EMOJI = { high: "🔴", medium: "🟠", low: "🟡" };

export function buildComment(result) {
  const out = [MARKER, "## 🧵 Patchwork review", ""];
  const flagged = result.files.filter((f) => f.review && f.review.warnings && f.review.warnings.length);
  const total = flagged.reduce((n, f) => n + f.review.warnings.length, 0);

  if (!total) {
    out.push(`Reviewed **${result.fileCount}** changed file(s). ✅ Nothing in the history looks at risk from this change.`);
  } else {
    const highs = flagged.reduce(
      (n, f) => n + f.review.warnings.filter((w) => sevOf(w) === "high").length, 0);
    out.push(
      `Reviewed **${result.fileCount}** changed file(s) — **${total}** point(s) worth a second look` +
        (highs ? ` (**${highs} high-risk**)` : "") + ".",
      "");
    for (const f of flagged) {
      out.push(`### \`${f.file}\``);
      if (f.knowledge && f.knowledge.summary) out.push(`_${f.knowledge.summary}_`, "");
      for (const w of f.review.warnings) {
        out.push(`${EMOJI[sevOf(w)] || "🟡"} **${sevOf(w).toUpperCase()}** — ${w.message}`);
        if (w.basedOn) out.push(`> ↳ based on: ${w.basedOn}`);
        if (w.action) out.push(`> ↳ next step: ${w.action}`);
        if (w.askWho) out.push(`> 👤 Ask **${w.askWho}**${w.commit ? ` — who made this call in \`${w.commit}\`` : ""}`);
        out.push("");
      }
    }
  }
  out.push(
    "",
    `<sub>Built with Kiro · [Patchwork](${APP}) reconstructs the reasons behind your code from its git history and warns before a change undoes them.</sub>`);
  return out.join("\n");
}

async function findExistingComment(owner, repo, number, token) {
  const url = `${GH}/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) return null;
  const arr = await res.json();
  const found = Array.isArray(arr)
    ? arr.find((c) => typeof c.body === "string" && c.body.includes(MARKER))
    : null;
  return found ? found.id : null;
}

async function upsertComment(owner, repo, number, token, body) {
  const existing = await findExistingComment(owner, repo, number, token);
  const url = existing
    ? `${GH}/repos/${owner}/${repo}/issues/comments/${existing}`
    : `${GH}/repos/${owner}/${repo}/issues/${number}/comments`;
  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Could not post the review comment (HTTP ${res.status}). ${t.slice(0, 160)}`);
  }
  return (await res.json()).html_url;
}

async function main() {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPOSITORY"); // "owner/name" — provided by GitHub Actions
  if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  const [owner, name] = repo.split("/");
  const number = resolvePrNumber();
  if (!number) {
    console.log("Patchwork: no pull request in this event — nothing to review.");
    return;
  }
  console.log(`Patchwork: reviewing ${repo} PR #${number} …`);
  const result = await reviewPullRequest({ repo, pr: number, token });
  const link = await upsertComment(owner, name, number, token, buildComment(result));
  console.log(`Patchwork: review posted → ${link}`);

  // Inline review on the exact changed lines — posted once, when the PR opens/reopens
  // (not on every push, to avoid duplicate threads).
  const act = eventAction();
  if (act === "opened" || act === "reopened" || !act) {
    try {
      const diff = await getPullRequestDiff(owner, name, number, { token });
      const patchByFile = Object.fromEntries(splitDiffByFile(diff).map((s) => [s.file, s.patch]));
      const comments = [];
      for (const f of result.files) {
        const w = f.review && f.review.warnings && f.review.warnings[0];
        if (!w) continue;
        const line = anchorLine(patchByFile[f.file]);
        if (!line) continue;
        let body = `🧵 **Patchwork** — ${sevOf(w).toUpperCase()}: ${w.message}`;
        if (w.basedOn) body += `\n\n↳ based on: ${w.basedOn}`;
        if (w.askWho) body += `\n\n👤 Ask **${w.askWho}**${w.commit ? ` — who made this call in \`${w.commit}\`` : ""}`;
        comments.push({ path: f.file, line, side: "RIGHT", body });
      }
      if (comments.length) {
        await postInlineReview(owner, name, number, token, comments);
        console.log(`Patchwork: posted ${comments.length} inline comment(s).`);
      }
    } catch (e) {
      console.error("Patchwork: inline review skipped —", e && e.message ? e.message : e);
    }
  }
}

// Run only when invoked directly (node src/action.mjs), not when imported.
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("Patchwork action failed:", err && err.message ? err.message : err);
    process.exit(1);
  });
}
