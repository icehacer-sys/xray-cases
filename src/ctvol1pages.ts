// Generate Weird CT Case Files: Volume 1's full book as gpt-image-2 designed pages, in the new
// "Deep Scan" style: obsidian black, icy cyan-blue + toxic scan-green, circular gantry-ring
// framing around each CT slice (CT slices are round, unlike the rectangular X-ray HUD frames
// used in the Weird X-ray Case Files line). Same STRUCTURE as vol3pages.ts: per case a question
// page + an answer page, but the answer page uses the corrected 4-section format (What you see /
// Why it matters / Treatment / Takeaway) rather than the older 3-section one. Resumable.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSlideImage } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const imgDir = join(dir, "images");
const pageDir = join(dir, "pages-gpt");
mkdirSync(pageDir, { recursive: true });

interface Case {
  n: number; title: string; story: string; options: string[];
  answer: string; diagnosis: string; whatYouSee: string; whyItMatters: string; treatment: string; takeaway: string;
}
const cases = (JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as Case[]).sort((a, b) => a.n - b.n);
const PORTRAIT = "1024x1536";

const STYLE =
  "A premium portrait page styled like a deep medical CT scan interface. Near-black obsidian background " +
  "with a very faint circular radar-sweep grid and a faint ghosted axial brain-slice watermark. Accent " +
  "palette: icy cyan-blue (#38bdf8) and toxic scan-green (#4ade80) on black, with white text. TITLES use " +
  "a BIG bold DISTRESSED CONDENSED grunge poster font (worn, textured, lightly stencilled, like a thriller " +
  "title). Body text is a clean modern sans-serif. A thin green radar-sweep arc as a top accent. Keep the " +
  "SAME consistent template on every page. CRITICAL: render all text crisply and CORRECTLY SPELLED exactly " +
  "as written, no extra or misspelled words.";
const CT_CLAUSE =
  " Use the PROVIDED CT slice EXACTLY as given (do not redraw, restyle, or change its anatomy); place it " +
  "inside a CIRCULAR cyan-green gantry-ring frame with radial tick marks around the circumference like a " +
  "scanner dial, not a rectangular frame.";

function qPrompt(c: Case): string {
  return `${STYLE}${CT_CLAUSE}\nLAYOUT (question page): top-left a small green scan-ring icon with "CT FILE ${String(c.n).padStart(2, "0")}" in bold green caps; top-right a thin cyan radar-arc. ` +
    `A huge distressed white grunge title: "${c.title.toUpperCase()}". Beneath it this prompt in two short white lines: "${c.story}". ` +
    `Then the provided CT slice centered in the circular cyan-green gantry-ring frame (radial tick marks, a small "AXIAL" marker, a tiny code "CT-${String(c.n).padStart(2, "0")}"). ` +
    `Then a bold green heading "WHAT IS THE MOST LIKELY DIAGNOSIS". Then three option rows, each a cyan circle with the letter then the text in a dark rounded card with a thin green edge:\n` +
    `A  ${c.options[0]}\nB  ${c.options[1]}\nC  ${c.options[2]}\n` +
    `At the very bottom a green rounded banner reading "THINK BEFORE YOU FLIP". A tiny grey footer "Educational entertainment only. Not medical advice.".`;
}
function aPrompt(c: Case): string {
  return `${STYLE}${CT_CLAUSE}\nLAYOUT (answer page): top-left a small cyan scan-ring icon with the wordmark "WEIRD CT CASE FILES"; top-right a green "ANSWER" tab. ` +
    `A green-bordered rounded box with a green check-circle icon reading "Correct answer: ${c.answer}. ${c.diagnosis}". ` +
    `Below it a left column of four sections, each a small line icon + bold colored heading + one short line of text: ` +
    `(1) a cyan eye icon, heading "WHAT YOU SEE", text "${c.whatYouSee}"; ` +
    `(2) a violet DNA icon, heading "WHY IT MATTERS", text "${c.whyItMatters}"; ` +
    `(3) a green medical-cross icon, heading "TREATMENT", text "${c.treatment}"; ` +
    `(4) a cyan lightbulb icon, heading "TAKEAWAY", text "${c.takeaway}". ` +
    `On the RIGHT side the provided CT slice in the circular gantry-ring frame with radial tick marks, an "AXIAL" marker and a tiny code. ` +
    `A tiny grey footer "Educational content only. Not medical advice.".`;
}

const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
let made = 0;
for (const c of cases) {
  const ctPath = join(imgDir, `case${String(c.n).padStart(2, "0")}.png`);
  if (!existsSync(ctPath)) { console.log(`! case ${c.n}: CT slice not generated yet, skipping`); continue; }
  const ct = readFileSync(ctPath);
  for (const [suffix, prompt] of [["q", qPrompt(c)], ["a", aPrompt(c)]] as const) {
    if (made >= limit) break;
    const out = join(pageDir, `case${String(c.n).padStart(2, "0")}-${suffix}.png`);
    if (existsSync(out)) continue;
    try {
      writeFileSync(out, await generateSlideImage(prompt, ct, PORTRAIT));
      made += 1;
      console.log(`[+${made}] case ${c.n} ${suffix === "q" ? "question" : "answer"} (${c.diagnosis})`);
    } catch (e) {
      console.log(`! case ${c.n} ${suffix} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
console.log(`\nDone. ${made} new pages generated in ${pageDir}`);
