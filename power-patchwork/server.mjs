#!/usr/bin/env node
// Patchwork as a Kiro Power — a zero-dependency stdio MCP server that exposes
// Patchwork's review to the Kiro agent (or any MCP client). Newline-delimited
// JSON-RPC 2.0 over stdio.
//
//   Register in .kiro/settings/mcp.json:
//   { "mcpServers": { "patchwork": { "command": "node",
//     "args": ["power-patchwork/server.mjs"], "env": { "GITHUB_TOKEN": "..." } } } }
import { reviewPullRequest } from "../src/pipeline.mjs";
import { parseRepo, extractKnowledgeFromApi } from "../src/github/fetch.mjs";

const token = (process.env.GITHUB_TOKEN || "").trim() || undefined;

const TOOLS = [
  {
    name: "patchwork_review",
    description:
      "Review a GitHub pull request against the history behind each changed file. Returns cited, severity-ranked warnings — each names the commit it is based on and who made that decision.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name or a GitHub URL" },
        pr: { type: "number", description: "PR number (optional; defaults to the latest merged PR)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "file_knowledge",
    description:
      "Reconstruct the knowledge behind one file from its git history: its contributors and the recorded reasons (the 'why') worth heeding before you change it.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name or a GitHub URL" },
        path: { type: "string", description: "path of the file inside the repo" },
      },
      required: ["repo", "path"],
    },
  },
];

const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const result = (id, data) => send({ jsonrpc: "2.0", id, result: data });
const rpcError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function callTool(name, args) {
  if (name === "patchwork_review") {
    const r = await reviewPullRequest({ repo: args.repo, pr: args.pr, token });
    return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
  }
  if (name === "file_knowledge") {
    const { owner, repo } = parseRepo(args.repo);
    const k = await extractKnowledgeFromApi(owner, repo, args.path, { token });
    return { content: [{ type: "text", text: JSON.stringify(k, null, 2) }] };
  }
  throw new Error("unknown tool: " + name);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    if (method === "initialize") {
      result(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "patchwork", version: "1.0.0" },
      });
    } else if (method === "tools/list") {
      result(id, { tools: TOOLS });
    } else if (method === "tools/call") {
      try {
        result(id, await callTool(params.name, params.arguments || {}));
      } catch (e) {
        result(id, { content: [{ type: "text", text: "Error: " + (e && e.message ? e.message : e) }], isError: true });
      }
    } else if (method && method.startsWith("notifications/")) {
      /* notifications get no response */
    } else if (id !== undefined) {
      rpcError(id, -32601, "Method not found: " + method);
    }
  }
});
