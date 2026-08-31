// Enforces the @mdnoteslab house punctuation style on Ruth's guide content: NO em/en dashes and
// NO commas except inside a genuine list of 3+ items. Two stages:
//   1. A focused Claude rewrite of any offending field (keeps meaning, just re-punctuates). The
//      generator prompt alone leaks ~14 commas per run, so prompting is not enough on its own.
//   2. A deterministic backstop that cannot be argued with, mirroring the threads-bot sanitize()
//      approach: dashes become new sentences and a lone clause-joining comma is removed or split.
// Idempotent. Run: npx tsx src/ruthstyle.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "./config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(root, "products", "ct-volume-1", "ruth-guide.json");
const KEYS = ["findIt", "whatItIs", "whyItMatters", "treatment", "sayIt", "caution"] as const;

const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

/**
 * Commas that are NOT part of a genuine 3+ item list.
 * NOTE: do not assume ">=2 commas means a list" (the threads-bot shortcut). In long prose a
 * two-comma PARENTHETICAL ("medication, often called blood thinners, given right away") also has
 * two commas and is still a violation. So: detect an actual list span ("A, B and C" / "A, B, C and
 * D") and count only ITS commas as legal. Everything else is a violation.
 */
function violations(text: string): { dashes: number; commas: number } {
  const dashes = (text.match(/[—–]/g) || []).length;
  let commas = 0;
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const all = (s.match(/(?<!\d),(?!\d)/g) || []).length;
    if (all === 0) continue;
    const list = s.match(/\b[\w'’-]+(?:,\s+[\w'’-]+){1,}\s+and\s+[\w'’-]+/);
    const legal = list ? (list[0].match(/,/g) || []).length : 0;
    commas += Math.max(0, all - legal);
  }
  return { dashes, commas };
}

function clean(text: string): boolean {
  const v = violations(text);
  return v.dashes === 0 && v.commas === 0;
}

/** Deterministic backstop — applied after the rewrite so nothing slips through. */
function backstop(text: string): string {
  let t = text.replace(/\s*[—–]\s*/g, ". ");
  // A comma before a joining word is pure noise. Drop it.
  t = t.replace(
    /,\s+(and|but|so|or|yet|then|which|who|because|though|although|while|whereas|since)\b/gi,
    " $1",
  );
  // Any remaining LONE comma in a sentence is a clause join. Split it into two beats.
  t = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => ((s.match(/(?<!\d),(?!\d)/g) || []).length === 1 ? s.replace(/(?<!\d),(?!\d)\s*/, ". ") : s))
    .join(" ");
  t = t.replace(/([.!?])\s+(\p{Ll})/gu, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`);
  return t.replace(/\s+/g, " ").trim();
}

async function rewrite(text: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system:
      "You re-punctuate text to a strict house style. You NEVER change the meaning, the facts, or the " +
      "reading level. You only restructure punctuation and the minimum wording needed to make it read " +
      "naturally.\n\nRULES:\n" +
      "- NO commas at all, except inside a genuine list of three or more items.\n" +
      "- NO em dashes or en dashes.\n" +
      "- No semicolons.\n" +
      "- Use short declarative sentences. Join clauses with and/so/but/then or just start a new sentence.\n" +
      "- Never produce a sentence fragment. Every sentence must stand on its own.\n\n" +
      "Reply with ONLY the rewritten text. No preamble and no quotes.",
    messages: [{ role: "user", content: text }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);
  const out = res.content.find((b: any) => b.type === "text") as any;
  return (out?.text ?? text).trim();
}

const guide = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string | number>[];
let fixed = 0;
let backstopped = 0;

for (const c of guide) {
  for (const k of KEYS) {
    const orig = String(c[k] ?? "");
    if (!orig || clean(orig)) continue;
    let t = await rewrite(orig);
    fixed++;
    if (!clean(t)) {
      t = backstop(t);
      backstopped++;
    }
    c[k] = t;
    process.stdout.write(".");
  }
}

writeFileSync(FILE, JSON.stringify(guide, null, 2));

// Final audit
let bad = 0;
for (const c of guide) {
  for (const k of KEYS) {
    const t = String(c[k] ?? "");
    if (!clean(t)) {
      bad++;
      console.log(`\nSTILL DIRTY case${c.n}.${k}: ${t.slice(0, 100)}`);
    }
  }
}
console.log(`\n\nrewrote ${fixed} field(s) | ${backstopped} needed the deterministic backstop | ${bad} still dirty`);
