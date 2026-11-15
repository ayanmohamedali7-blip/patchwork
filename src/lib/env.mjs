// Tiny .env loader — zero dependency. Reads KEY=VALUE lines into process.env
// without overriding values already present in the environment.

import { readFileSync } from "node:fs";

export function loadEnv(path = ".env") {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {}; // no .env is fine
  }
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return out;
}
