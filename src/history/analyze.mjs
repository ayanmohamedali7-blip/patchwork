// Patchwork — history/knowledge engine
// Reads a repository's git history and reconstructs the "knowledge" behind an area
// of the code: who shaped it, how often it changes, and the reasons recorded in
// commit messages. Zero dependencies — uses the local `git` binary.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SEP = "\x1e"; // record separator (unlikely to appear in commit text)
const UNIT = "\x1f"; // field separator

/** Run a git command inside a repo and return stdout (trimmed). */
async function git(repoPath, args, { maxBuffer = 1024 * 1024 * 64 } = {}) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer,
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    const msg = (err && err.stderr) || (err && err.message) || String(err);
    throw new Error(`git ${args.join(" ")} failed: ${String(msg).trim()}`);
  }
}

/** Make sure the path is actually a git repository. */
export async function assertGitRepo(repoPath) {
  const out = (await git(repoPath, ["rev-parse", "--is-inside-work-tree"])).trim();
  if (out !== "true") throw new Error(`Not a git repository: ${repoPath}`);
  return true;
}

/** Parse a `git log` stream formatted with our custom separators. */
function parseLog(stdout) {
  return stdout
    .split(SEP)
    .map((rec) => rec.trim())
    .filter(Boolean)
    .map((rec) => {
      const [hash, author, email, isoDate, subject, body = ""] = rec.split(UNIT);
      return {
        hash: (hash || "").trim(),
        author: (author || "").trim(),
        email: (email || "").trim(),
        date: (isoDate || "").trim(),
        subject: (subject || "").trim(),
        body: (body || "").trim(),
      };
    });
}

const LOG_FORMAT = ["%H", "%an", "%ae", "%aI", "%s", "%b"].join(UNIT) + SEP;

/**
 * Full commit history for a single file (follows renames).
 */
export async function getFileHistory(repoPath, filePath, { limit = 400 } = {}) {
  const out = await git(repoPath, [
    "log",
    "--follow",
    `--max-count=${limit}`,
    `--pretty=format:${LOG_FORMAT}`,
    "--",
    filePath,
  ]);
  return parseLog(out);
}

/**
 * Commit messages often carry the "why". We surface the ones that read like
 * decisions, fixes, or warnings rather than noise ("wip", "typo", merge commits).
 */
const NOISE = /^(merge|wip|typo|fix typo|lint|format|cleanup|minor|nit|bump|version|chore\b)/i;
const SIGNAL = /\b(because|so that|to avoid|must|do not|don'?t|never|always|careful|warning|security|race|deadlock|workaround|hack|important|fix(?:es|ed)?|bug|regression|revert|breaking|deprecat|intentional|on purpose|reason)\b/i;

function scoreCommit(c) {
  const text = `${c.subject}\n${c.body}`;
  let score = 0;
  if (SIGNAL.test(text)) score += 3;
  if (c.body && c.body.length > 40) score += 1; // explained commits
  if (NOISE.test(c.subject)) score -= 3;
  if (/^revert\b/i.test(c.subject)) score += 2; // reverts encode hard-won lessons
  return score;
}

/** Aggregate who shaped a file and how much. */
function summarizeContributors(commits) {
  const by = new Map();
  for (const c of commits) {
    const key = c.author || c.email || "unknown";
    const cur = by.get(key) || { author: key, commits: 0, last: "", first: "" };
    cur.commits += 1;
    if (!cur.first || c.date < cur.first) cur.first = c.date;
    if (!cur.last || c.date > cur.last) cur.last = c.date;
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.commits - a.commits);
}

/**
 * Pure knowledge builder: given a file path and its commits (from ANY source —
 * local git or the GitHub API), reconstruct the knowledge object. Shared by the
 * local and remote paths so both behave identically.
 *
 * A commit is: { hash, author, email?, date, subject, body }
 */
export function buildKnowledge(filePath, commits, { topNotable = 8 } = {}) {
  if (!commits || commits.length === 0) {
    return {
      file: filePath,
      exists: false,
      totalCommits: 0,
      contributors: [],
      notableCommits: [],
      summary: `No history found for "${filePath}". It may be new, moved, or the path is wrong.`,
    };
  }

  const contributors = summarizeContributors(commits);
  const notableCommits = [...commits]
    .map((c) => ({ ...c, _score: scoreCommit(c) }))
    .filter((c) => c._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topNotable)
    .map(({ _score, ...c }) => c);

  const firstSeen = commits.reduce((m, c) => (!m || c.date < m ? c.date : m), "");
  const lastChanged = commits.reduce((m, c) => (c.date > m ? c.date : m), "");

  return {
    file: filePath,
    exists: true,
    totalCommits: commits.length,
    firstSeen,
    lastChanged,
    contributors, // sorted, most active first
    primaryAuthors: contributors.slice(0, 3).map((c) => c.author),
    notableCommits, // the "why" — decisions, fixes, reverts, warnings
    summary:
      `"${filePath}" has ${commits.length} recorded changes by ${contributors.length} ` +
      `contributor(s). Primary: ${contributors.slice(0, 3).map((c) => c.author).join(", ")}. ` +
      `${notableCommits.length} commit(s) carry explicit reasoning worth heeding.`,
  };
}

/**
 * Reconstruct the knowledge behind one file/area from a LOCAL git repo.
 */
export async function extractKnowledge(repoPath, filePath, { limit = 400, topNotable = 8 } = {}) {
  await assertGitRepo(repoPath);
  const commits = await getFileHistory(repoPath, filePath, { limit });
  return buildKnowledge(filePath, commits, { topNotable });
}

/**
 * Repository "hotspots" — the files that change most often. These are the areas
 * where lost context hurts the most, so they are good demo targets.
 */
export async function getHotspots(repoPath, { limit = 2000, top = 15 } = {}) {
  await assertGitRepo(repoPath);
  const out = await git(repoPath, [
    "log",
    `--max-count=${limit}`,
    "--name-only",
    "--pretty=format:",
  ]);
  const counts = new Map();
  for (const line of out.split("\n")) {
    const f = line.trim();
    if (!f) continue;
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([file, changes]) => ({ file, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, top);
}
