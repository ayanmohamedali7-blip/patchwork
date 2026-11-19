// Patchwork — GitHub source
// Reads a public repo's per-file history and a pull request's diff straight from
// the GitHub REST API (no local clone needed). Feeds the same buildKnowledge().

import { buildKnowledge } from "../history/analyze.mjs";

const GH = "https://api.github.com";

function headers(token, accept = "application/vnd.github+json") {
  const h = {
    // Generic client name — never the user's personal details.
    "User-Agent": "patchwork-code-review",
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Accept "owner/repo", a github.com URL, or a PR URL → { owner, repo }. */
export function parseRepo(input) {
  const s = String(input).trim();
  const m =
    s.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:\/|$)/i) ||
    s.match(/^([^/\s]+)\/([^/\s#?]+)$/);
  if (!m) throw new Error(`Could not read "owner/repo" from: ${input}`);
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

async function ghFetch(url, { token, accept, timeout = 25000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { headers: headers(token, accept), signal: ac.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 403 && /rate limit/i.test(body)) {
        throw new Error("GitHub rate limit hit. Add a GITHUB_TOKEN to .env for higher limits.");
      }
      if (res.status === 404) {
        throw new Error("Repository or pull request not found — check the owner/name and that the repo is public.");
      }
      // Surface the full request URL and GitHub's response so users can debug failures themselves.
      throw new Error(`GitHub request failed (HTTP ${res.status}) for ${url}: ${body}`);
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

/** Per-file commit history from the API, mapped to our commit shape. */
export async function getFileHistoryFromApi(owner, repo, path, { token, limit = 60 } = {}) {
  const url = `${GH}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=${Math.min(limit, 100)}`;
  const res = await ghFetch(url, { token });
  const arr = await res.json();
  return arr.map((c) => {
    const msg = c.commit?.message || "";
    const nl = msg.indexOf("\n");
    return {
      hash: c.sha,
      author: c.commit?.author?.name || c.author?.login || "unknown",
      email: c.commit?.author?.email || "",
      date: c.commit?.author?.date || "",
      subject: nl === -1 ? msg : msg.slice(0, nl),
      body: nl === -1 ? "" : msg.slice(nl + 1).trim(),
    };
  });
}

/** Knowledge for one file, sourced from GitHub. */
export async function extractKnowledgeFromApi(owner, repo, path, opts = {}) {
  const commits = await getFileHistoryFromApi(owner, repo, path, opts);
  return buildKnowledge(path, commits, { topNotable: opts.topNotable || 8 });
}

/** Most recent merged pull request number for a repo (handy demo default). */
export async function getLatestMergedPr(owner, repo, { token } = {}) {
  const url = `${GH}/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=20`;
  const res = await ghFetch(url, { token });
  const arr = await res.json();
  const merged = arr.find((p) => p.merged_at);
  if (!merged) throw new Error(`No recently merged PR found for ${owner}/${repo}.`);
  return { number: merged.number, title: merged.title };
}

/** Raw unified diff of a pull request. */
export async function getPullRequestDiff(owner, repo, number, { token } = {}) {
  const url = `${GH}/repos/${owner}/${repo}/pulls/${number}`;
  const res = await ghFetch(url, { token, accept: "application/vnd.github.v3.diff" });
  return res.text();
}

/** Split a unified diff into per-file sections: [{ file, patch }]. */
export function splitDiffByFile(diffText) {
  const lines = String(diffText).split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = { file: m[2], patch: line + "\n" };
    } else if (current) {
      current.patch += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}
