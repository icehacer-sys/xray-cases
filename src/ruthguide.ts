// Generates the per-case teaching content for Ruth's personal CT guide. Richer and much more
// beginner-facing than the puzzle-book copy in cases.json: it assumes ZERO radiology background
// and focuses on ORIENTATION (where to look, what is bright vs dark and why) so she can explain
// each image to a lay audience without overstating it.
// Output: products/ct-volume-1/ruth-guide.json   Run: npx tsx src/ruthguide.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "./config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const OUT = join(dir, "ruth-guide.json");

interface Case {
  n: number; diagnosis: string; title: string; story: string;
  whatYouSee: string; whyItMatters: string; treatment: string; takeaway: string;
}
const cases = (JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as Case[]).sort((a, b) => a.n - b.n);

const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
const MODEL = "claude-sonnet-5";

const TOOL: Anthropic.Tool = {
  name: "case_guide",
  description: "Beginner-facing teaching notes for one CT finding.",
  input_schema: {
    type: "object",
    properties: {
      findIt: {
        type: "string",
        description:
          "2-4 sentences. How to actually LOCATE the finding on an axial slice for someone with zero radiology training. Name the landmark to start from, then where to move the eye, then what the abnormal thing looks like versus the normal tissue around it (brighter/darker/bigger). Concrete and visual.",
      },
      whatItIs: { type: "string", description: "2-3 sentences. Plain-language explanation of the condition itself. No jargon without immediately defining it." },
      whyItMatters: { type: "string", description: "2-3 sentences. Why this is dangerous or clinically significant. Be concrete about what actually happens to the person." },
      treatment: { type: "string", description: "1-2 sentences. How it is actually managed in practice." },
      sayIt: { type: "string", description: "ONE sentence she can say out loud when teaching this image to a lay audience. Accurate but not overstated. Should sound natural spoken." },
      caution: { type: "string", description: "ONE short sentence: the most likely thing a non-expert would get WRONG or overstate about this image. A guardrail." },
    },
    required: ["findIt", "whatItIs", "whyItMatters", "treatment", "sayIt", "caution"],
  },
};

const SYSTEM = `You write radiology teaching notes for a specific reader: an intelligent adult with NO medical training who works in patient education around blood clots and pulmonary embolism. She wants to explain CT images to lay audiences and is terrified of representing something incorrectly.

PUNCTUATION RULES (house style, strictly enforced):
- Do NOT use commas. Write short sentences or join clauses with and/so/but/then. A comma is allowed ONLY inside a genuine list of three or more items (like "bone, calcium and metal").
- NEVER use em dashes or en dashes. Use a period and start a new sentence instead.
- No semicolons. No parenthetical asides stacked with commas.
- This means SHORT declarative sentences. That is the voice. Lean into it.

CONTENT RULES:
- Accurate standard radiology. These are classic textbook findings.
- Assume ZERO prior knowledge. Define any term the moment you use it.
- Be VISUAL and concrete about locating things on an axial slice. Remember an axial CT is viewed as if looking up from the patient's feet so the patient's LEFT appears on the viewer's RIGHT.
- Dense structures like bone and iodine contrast and calcium and metal appear BRIGHT white. Air appears BLACK. Soft tissue and fluid are shades of grey. Fat is darker grey.
- Never overstate. If something is only suggestive rather than diagnostic then say so.
- Warm and plain-spoken. No hype and no fluff.`;

async function gen(c: Case) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Finding: ${c.diagnosis}\n` +
          `Body region / scan: implied by this case story -> "${c.story}"\n` +
          `The classic appearance (from the puzzle book): ${c.whatYouSee}\n` +
          `Why it matters (short version): ${c.whyItMatters}\n` +
          `Treatment (short version): ${c.treatment}\n\n` +
          `Write her teaching notes for THIS finding via the tool.`,
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "case_guide" },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  const block = res.content.find((b: any) => b.type === "tool_use") as any;
  return block.input;
}

const out: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const done = new Set(out.map((o) => o.n));
for (const c of cases) {
  if (done.has(c.n)) { console.log(`= case ${c.n} already done`); continue; }
  process.stdout.write(`gen case ${c.n} (${c.diagnosis}) ... `);
  try {
    const g = await gen(c);
    out.push({ n: c.n, diagnosis: c.diagnosis, title: c.title, ...g });
    out.sort((a, b) => a.n - b.n);
    writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log("ok");
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log(`\nwrote ${OUT} (${out.length}/${cases.length} cases)`);
