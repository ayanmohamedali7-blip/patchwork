// Patchwork — review engine
// Takes a proposed change (a diff) plus the reconstructed knowledge behind that
// area of the code, and produces grounded warnings. The AI path uses Google Gemini;
// a heuristic path runs with no key so the pipeline is always testable.

/** Build the prompt we send to the model. Grounded, no fabrication. */
export function buildPrompt(knowledge, diff) {
  const notable = (knowledge.notableCommits || [])
    .map((c) => `- "${c.subject}" (${c.author})${c.body ? `: ${c.body.split("\n").find((l) => l.trim()) || ""}` : ""}`)
    .join("\n");
  const authors = (knowledge.contributors || [])
    .slice(0, 5)
    .map((c) => `${c.author} (${c.commits} changes)`)
    .join(", ");

  return `You are Patchwork, a reviewer that protects a codebase by surfacing the REASONING
behind the area a change touches. You are given the real, recorded history of this area and a
proposed change. Warn the author about anything their change risks breaking, grounded ONLY in
the history provided. Do not invent facts. If the history shows a decision the change seems to
undo, say so and name the commit.

AREA: ${knowledge.file}
TOTAL RECORDED CHANGES: ${knowledge.totalCommits}
PEOPLE WHO SHAPED IT: ${authors || "unknown"}

REASONS RECORDED IN HISTORY (the "why"):
${notable || "(none clearly explained)"}

PROPOSED CHANGE (unified diff):
\`\`\`diff
${(diff || "").slice(0, 12000)}
\`\`\`

Respond with STRICT JSON only, no prose, in this shape:
{
  "summary": "one sentence overall verdict",
  "warnings": [
    {
      "severity": "high|medium|low",
      "message": "specific, actionable",
      "basedOn": "which recorded reason/commit this comes from",
      "action": "one concrete next step the author should take, grounded in the commit history (e.g. 'Read commit abc1234 and confirm your change preserves the exactly-once guard')",
      "codeHint": "OPTIONAL: if this warning is about one specific changed line, copy that exact line VERBATIM from the diff above (an added '+' line without its leading '+', or a context line) so the comment can be placed on it; omit if it is about the file as a whole"
    }
  ]
}
If nothing in the history is at risk, return an empty "warnings" array and say so in the summary.`;
}

/**
 * Attach "who to ask" to each warning: the author (and short hash) of the commit
 * the warning is based on. Turns a warning into institutional memory — you know
 * exactly who made the decision you might be undoing.
 */
export function enrichWarnings(warnings, knowledge) {
  const notable = knowledge.notableCommits || [];
  return (warnings || []).map((w) => {
    const based = String(w.basedOn || "").toLowerCase();
    const hit = notable.find((c) => {
      const h = String(c.hash || "").slice(0, 8).toLowerCase();
      const subj = String(c.subject || "").toLowerCase();
      return (h && based.includes(h.slice(0, 7))) || (subj.length > 10 && based.includes(subj.slice(0, 22)));
    });
    if (hit && hit.author && hit.author !== "unknown") {
      return { ...w, askWho: hit.author, commit: String(hit.hash || "").slice(0, 7) };
    }
    return w;
  });
}

/** Heuristic reviewer — no AI. Flags risk from history signals so the pipeline always runs. */
export function heuristicReview(knowledge, diff) {
  const warnings = [];
  const riskyWords = /\b(money|wallet|payment|refund|charge|price|pricing|auth|security|permission|token|secret|migration|schema|race|lock|limit|trust)\b/i;

  for (const c of knowledge.notableCommits || []) {
    const text = `${c.subject} ${c.body}`;
    if (riskyWords.test(text)) {
      const short = c.hash?.slice(0, 8);
      warnings.push({
        severity: "medium",
        message: `This area carries a sensitive decision: "${c.subject}". Make sure your change preserves it.`,
        basedOn: `${short} — ${c.author}`,
        action: `Read commit ${short} and confirm your change does not undo the decision recorded there.`,
      });
    }
  }
  if ((knowledge.contributors || []).length >= 3) {
    const hashes = (knowledge.notableCommits || [])
      .slice(0, 3)
      .map((c) => c.hash?.slice(0, 8))
      .filter(Boolean)
      .join(", ");
    warnings.push({
      severity: "low",
      message: `Many hands shaped this file (${knowledge.contributors.length} contributors). Context is spread out — review notable commits before changing behavior.`,
      basedOn: "contributor spread",
      action: hashes
        ? `Check the notable commits (${hashes}) to understand prior intent before merging.`
        : "Review the notable commits listed above before merging.",
    });
  }
  return {
    summary:
      warnings.length === 0
        ? "No high-risk history signals found for this change."
        : `${warnings.length} point(s) from this area's history deserve attention before you change it.`,
    warnings: enrichWarnings(warnings.slice(0, 6), knowledge),
    engine: "heuristic",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Call Gemini via REST (no SDK dependency), with retries on transient errors. */
async function geminiReview(knowledge, diff, { apiKey, model, retries = 4 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(knowledge, diff) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  let lastErr = "";
  let res;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000); // never hang forever
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (e) {
      // network error or timeout — treat as transient and retry
      lastErr = `Gemini request failed: ${e.name === "AbortError" ? "timed out" : e.message}`;
      if (attempt === retries) throw new Error(lastErr);
      await sleep(800 * (attempt + 1));
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) break;
    const detail = await res.text().catch(() => "");
    lastErr = `Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`;
    // Retry on transient: 429 (rate), 500, 503 (busy). Give up on others.
    if (![429, 500, 503].includes(res.status) || attempt === retries) {
      throw new Error(lastErr);
    }
    await sleep(800 * (attempt + 1)); // simple backoff
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { summary: text.slice(0, 200), warnings: [] };
  }
  return {
    summary: parsed.summary || "",
    warnings: enrichWarnings(Array.isArray(parsed.warnings) ? parsed.warnings : [], knowledge),
    engine: `gemini:${model}`,
  };
}

/**
 * Review a change. Uses Gemini when GEMINI_API_KEY is set and valid; otherwise the
 * heuristic path. Never throws for a missing key — it degrades gracefully.
 */
export async function reviewChange(knowledge, diff, env = process.env) {
  const apiKey = (env.GEMINI_API_KEY || "").trim();
  const model = (env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim();
  const hasKey = apiKey && apiKey !== "PUT_YOUR_KEY_HERE";

  if (!hasKey) return heuristicReview(knowledge, diff);

  try {
    return await geminiReview(knowledge, diff, { apiKey, model });
  } catch (err) {
    const fallback = heuristicReview(knowledge, diff);
    fallback.summary = `[AI unavailable, used heuristic] ${fallback.summary}`;
    fallback.error = err.message;
    return fallback;
  }
}
