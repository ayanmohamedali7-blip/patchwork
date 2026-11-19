// Patchwork — web server (zero dependency; node:http). Serves the UI and the API.
//   node src/server/index.mjs   ->   http://localhost:4175

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { loadEnv } from "../lib/env.mjs";
import { reviewPullRequest } from "../pipeline.mjs";

loadEnv();
const token = (process.env.GITHUB_TOKEN || "").trim() || undefined;
const PORT = Number(process.env.PORT || 4175);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

// --- In-memory cache + per-IP rate limit (zero dependency) ---
// The public demo holds shared GitHub/Gemini quota, so identical requests are
// cached for an hour (the ready-made examples then open instantly and cost
// nothing), and only real upstream computations count against a gentle per-IP
// limit — so one visitor can't drain the keys before a judge arrives.
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const RATE_MAX = 15;                 // upstream reviews per IP…
const RATE_WINDOW_MS = 60 * 60 * 1000; // …per hour
const reviewCache = new Map();       // "repo|pr" -> { at, result }
const rateHits = new Map();          // ip -> [timestamps]

const cacheKey = (repo, pr) => `${String(repo).toLowerCase()}|${pr ?? "latest"}`;

function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.socket?.remoteAddress || "unknown";
}
function underRateLimit(ip) {
  const now = Date.now();
  const arr = (rateHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  rateHits.set(ip, arr);
  if (rateHits.size > 5000) rateHits.clear(); // guard against unbounded growth
  return arr.length < RATE_MAX;
}
function recordHit(ip) {
  const arr = rateHits.get(ip) || [];
  arr.push(Date.now());
  rateHits.set(ip, arr);
}
function cacheGet(key) {
  const hit = reviewCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  if (hit) reviewCache.delete(key);
  return null;
}
function cacheSet(key, result) {
  if (reviewCache.size > 500) reviewCache.clear(); // simple bound
  reviewCache.set(key, { at: Date.now(), result });
}

// A self-contained SVG badge any repo can embed: "Guarded by Patchwork".
function badgeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="196" height="28" role="img" aria-label="Guarded by Patchwork">
  <defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#f2a541"/><stop offset=".6" stop-color="#37d3c3"/><stop offset="1" stop-color="#9d8bff"/></linearGradient></defs>
  <rect width="196" height="28" rx="7" fill="#11161f"/>
  <rect x=".75" y=".75" width="194.5" height="26.5" rx="6.3" fill="none" stroke="url(#pg)" stroke-width="1.5"/>
  <circle cx="17" cy="14" r="4" fill="url(#pg)"/>
  <path d="M17 7V21M10 14H24" stroke="url(#pg)" stroke-width="1.2" stroke-dasharray="2 3" opacity=".6"/>
  <text x="30" y="18.5" font-family="Segoe UI,Arial,sans-serif" font-size="12.5" fill="#e9eef6" font-weight="600">Guarded by <tspan fill="url(#pg)" font-weight="800">Patchwork</tspan></text>
</svg>`;
}

async function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") path = "/index.html";
  const full = normalize(join(PUBLIC, path));
  if (!full.startsWith(PUBLIC)) return send(res, 403, "Forbidden");
  try {
    const data = await readFile(full);
    const ext = full.slice(full.lastIndexOf("."));
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  } catch {
    if (path === "/index.html") {
      // Root must always answer (never 404) so platform health checks pass.
      return send(res, 200, "<h1>Patchwork</h1><p>Starting…</p>", MIME[".html"]);
    }
    send(res, 404, "Not found");
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  try {
    console.log(`${req.method} ${req.url}`);
    if (req.method === "GET" && /^\/badge(\/.*)?\.svg$/.test(req.url.split("?")[0])) {
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "max-age=3600" });
      return res.end(badgeSvg());
    }
    if (req.method === "POST" && req.url === "/api/review") {
      const body = await readBody(req);
      let input = {};
      try {
        input = JSON.parse(body || "{}");
      } catch {
        return send(res, 400, JSON.stringify({ error: "Invalid JSON body" }), MIME[".json"]);
      }
      if (!input.repo) {
        return send(res, 400, JSON.stringify({ error: "Provide a repo like owner/name." }), MIME[".json"]);
      }
      // Serve a cached result instantly unless the caller asked to refresh.
      const key = cacheKey(input.repo, input.pr);
      if (!input.refresh) {
        const cached = cacheGet(key);
        if (cached) return send(res, 200, JSON.stringify({ ...cached, cached: true }), MIME[".json"]);
      }
      // A real upstream review is about to run — this one counts against the limit.
      const ip = clientIp(req);
      if (!underRateLimit(ip)) {
        return send(res, 429, JSON.stringify({
          error: "You've run quite a few fresh reviews this hour. The ready-made examples still open instantly — please try again a little later.",
        }), MIME[".json"]);
      }
      recordHit(ip);
      try {
        const result = await reviewPullRequest({ repo: input.repo, pr: input.pr, token });
        cacheSet(key, result);
        return send(res, 200, JSON.stringify({ ...result, cached: false }), MIME[".json"]);
      } catch (err) {
        // Generic message to the client; detail to server logs only.
        console.error("review error:", err);
        return send(res, 502, JSON.stringify({ error: err.message || "Review failed." }), MIME[".json"]);
      }
    }
    return serveStatic(req, res);
  } catch (err) {
    console.error(err);
    send(res, 500, "Server error");
  }
});

// Bind to 0.0.0.0 so the host platform (Render, etc.) can route to it.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🔧 Patchwork on port ${PORT} (env.PORT=${process.env.PORT})`);
  console.log(`PUBLIC=${PUBLIC}`);
  console.log(`index.html exists=${existsSync(join(PUBLIC, "index.html"))}\n`);
});
