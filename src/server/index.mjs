// Patchwork — web server (zero dependency; node:http). Serves the UI and the API.
//   node src/server/index.mjs   ->   http://localhost:4175

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
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
      try {
        const result = await reviewPullRequest({ repo: input.repo, pr: input.pr, token });
        return send(res, 200, JSON.stringify(result), MIME[".json"]);
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
  console.log(`\n🔧 Patchwork running on port ${PORT}\n`);
});
