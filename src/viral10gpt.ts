// Generate "Weird X-Ray Case Files: The Viral 10" question/answer pages via gpt-image-2.
// Same forensic case-file template as the other books. Resumable (skips pages already made).
// Output: products/viral-10/pages-gpt/caseNN-q.png + -a.png
// `npx tsx src/viral10gpt.ts <maxNewPages>` limits how many NEW pages to make (for testing).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSlideImage } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "products", "viral-10");
const imgDir = join(dir, "images");
const pageDir = join(dir, "pages-gpt");
mkdirSync(pageDir, { recursive: true });

interface BookCase {
  n: number; title: string; story: string; options: string[];
  answer: string; diagnosis: string; whatYouSee: string; whatItMeans: string; wonder: string;
}
const cases = (JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as BookCase[]).sort((a, b) => a.n - b.n);
const PORTRAIT = "1024x1536";

function firstSentence(s: string): string {
  const m = String(s ?? "").match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : String(s ?? "")).trim();
}

const STYLE =
  "A premium portrait page styled like a forensic 'case file' / medical HUD. Near-black deep navy " +
  "background with a faint blueprint grid and a very faint ghosted skull watermark. Accent palette: " +
  "electric cyan (#22d3ee) and bold orange (#f59e0b) on dark navy, with white text. TITLES use a BIG " +
  "bold DISTRESSED CONDENSED grunge poster font (worn, textured, lightly stencilled, like a thriller " +
  "title). Body text is a clean modern sans-serif. A thin cyan EKG heartbeat line as a top accent. Keep " +
  "the SAME consistent template on every page. CRITICAL: render all text crisply and CORRECTLY SPELLED " +
  "exactly as written, no extra or misspelled words. Use the PROVIDED X-ray EXACTLY as given (do not " +
  "redraw, restyle, or change its anatomy); place it inside a cyan scanner frame with corner brackets " +
  "and small measurement tick marks along the edges.";

function qPrompt(c: BookCase): string {
  return `${STYLE}\nLAYOUT (question page): top-left a small orange folder icon with "VIRAL CASE ${String(c.n).padStart(2, "0")}" in bold orange caps; top-right a thin cyan EKG line. ` +
    `A huge distressed white grunge title: "${c.title.toUpperCase()}". Beneath it this prompt in two short white lines: "${c.story}". ` +
    `Then the provided X-ray centered in the cyan scanner frame (corner brackets, edge tick marks, a small "R"/"L" marker, a tiny code "XR-${String(c.n).padStart(2, "0")}"). ` +
    `Then a bold cyan heading "WHAT IS THE MOST LIKELY DIAGNOSIS". Then three option rows, each an orange circle with the letter then the text in a dark rounded card with a thin cyan edge:\n` +
    `A  ${c.options[0]}\nB  ${c.options[1]}\nC  ${c.options[2]}\n` +
    `At the very bottom an orange rounded banner reading "THINK BEFORE YOU FLIP". A tiny grey footer "Educational entertainment only. Not medical advice.".`;
}
function aPrompt(c: BookCase): string {
  return `${STYLE}\nLAYOUT (answer page): top-left a small cyan ribcage icon with the wordmark "WEIRD X-RAY CASE FILES"; top-right a cyan "ANSWER" tab. ` +
    `A cyan-bordered rounded box with a cyan check-circle icon reading "Correct answer: ${c.answer}. ${c.diagnosis}". ` +
    `Below it a left column of three sections, each a small line icon + bold colored heading + one short line of text: ` +
    `(1) a cyan eye icon, heading "WHAT YOU ARE SEEING", text "${firstSentence(c.whatYouSee)}"; ` +
    `(2) a purple DNA icon, heading "WHY IT MATTERS", text "${firstSentence(c.whatItMeans)}"; ` +
    `(3) a yellow lightbulb icon, heading "SIMPLE TAKEAWAY", text "${c.wonder}". ` +
    `On the RIGHT side the provided X-ray in a cyan scanner frame with tick marks, an "L"/"AP" marker and a tiny code. ` +
    `A tiny grey footer "Educational content only. Not medical advice.".`;
}

const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
let made = 0;
for (const c of cases) {
  const xrayPath = join(imgDir, `case${String(c.n).padStart(2, "0")}.png`);
  if (!existsSync(xrayPath)) { console.log(`! case ${c.n}: X-ray not found, skipping`); continue; }
  const xray = readFileSync(xrayPath);
  for (const [suffix, prompt] of [["q", qPrompt(c)], ["a", aPrompt(c)]] as const) {
    if (made >= limit) break;
    const out = join(pageDir, `case${String(c.n).padStart(2, "0")}-${suffix}.png`);
    if (existsSync(out)) continue;
    try {
      writeFileSync(out, await generateSlideImage(prompt, xray, PORTRAIT));
      made += 1;
      console.log(`[+${made}] case ${c.n} ${suffix === "q" ? "question" : "answer"} (${c.diagnosis})`);
    } catch (e) {
      console.log(`! case ${c.n} ${suffix} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
console.log(`\nDone. ${made} new pages generated in ${pageDir}`);
