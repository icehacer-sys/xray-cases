// Generate Weird CT Case Files: Volume 1's cover, "How it works" page, and closing page in the
// same Deep Scan style as the case pages. Cover composites the case01 CT slice (picked for
// maximum shock). Resumable.
// `npx tsx src/ctvol1extras.ts`         generates any missing of the three
// `npx tsx src/ctvol1extras.ts closing` force-regenerates just that one (cover|howto|closing)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSlideImage } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
// The cover and the closing page both carried Volume 1 text hardcoded, so Volume 2 shipped a cover
// reading "VOLUME ONE" and a closing page advertising its own waitlist. Both now follow CT_VOL.
const VOL_WORD: Record<string, string> = { "1": "ONE", "2": "TWO", "3": "THREE", "4": "FOUR" };
const VOL_NAME = VOL_WORD[CT_VOL] ?? CT_VOL;
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const imgDir = join(dir, "images");
const pageDir = join(dir, "pages-gpt");
mkdirSync(pageDir, { recursive: true });
const PORTRAIT = "1024x1536";

const STYLE_BASE =
  "A premium portrait page styled like a deep medical CT scan interface. Near-black obsidian background " +
  "with a very faint circular radar-sweep grid and a faint ghosted axial brain-slice watermark. Accent " +
  "palette: icy cyan-blue (#38bdf8) and toxic scan-green (#4ade80) on black, with white text. TITLES use " +
  "a BIG bold DISTRESSED CONDENSED grunge poster font (worn, textured, lightly stencilled, like a thriller " +
  "title). Body text is a clean modern sans-serif. A thin green radar-sweep arc as a top accent. CRITICAL: " +
  "render all text crisply and CORRECTLY SPELLED exactly as written, with no extra, missing, or misspelled " +
  "words.";
const CT_CLAUSE =
  " Use the PROVIDED CT slice EXACTLY as given (do not redraw, restyle, or change its anatomy); place it " +
  "inside a CIRCULAR cyan-green gantry-ring frame with radial tick marks around the circumference like a " +
  "scanner dial, not a rectangular frame.";

const coverPrompt =
  `${STYLE_BASE}${CT_CLAUSE}\nLAYOUT (striking book FRONT COVER): Top a small green scan-ring icon with ` +
  `"WEIRD CT CASE FILES" in bold green caps and a thin cyan radar-arc. Below it a HUGE distressed white ` +
  `grunge title stacked on two lines: "VOLUME" / "${VOL_NAME}". Under the title one short cyan line: ` +
  `"10 real CT scans that will stop you cold". Center the provided CT slice LARGE inside the circular ` +
  `cyan-green gantry-ring frame (radial tick marks, an "AXIAL" marker and a tiny code "CT-01"). Near the ` +
  `bottom one short white line: "Could you guess what is hiding inside?". At the very bottom in bold green: ` +
  `"@mdnoteslab". A tiny grey footer: "Educational entertainment only. Not medical advice.". Make it look ` +
  `like a collectible thriller book cover with a distinct sci-fi deep-scan mood, a sibling to but visually ` +
  `distinct from the Weird X-ray Case Files covers.`;

const howtoPrompt =
  `${STYLE_BASE}\nLAYOUT ("How it works" page): top a thin cyan radar-arc and small green caps ` +
  `"WEIRD CT CASE FILES". A big distressed white grunge heading: "HOW IT WORKS". Then three steps, each ` +
  `a bold cyan circle number then one short white line inside a dark rounded card with a thin green edge:\n` +
  `1  Study the CT slice. Look closely.\n2  Make your guess. A B or C.\n3  Flip the page for the answer.\n` +
  `Below them one short green italic line: "No medical degree required. Only curiosity.". A faint ghosted ` +
  `axial brain slice in the background. A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

// Volume 1 recruits for the Volume 2 waitlist. Volume 2 onward cannot advertise its own waitlist,
// so it cross-sells the volume that already exists instead.
const NEXT_CARD =
  CT_VOL === "1"
    ? `a bold cyan heading "VOLUME 2 IS COMING" and one white line "Be first in line the day it drops. Join the waitlist now." and beneath it a big bold green URL on its own line: "ctvol2.mednoteslab.com"`
    : `a bold cyan heading "MISSED VOLUME ONE" and one white line "Ten more real CT scans and the story behind every one." and beneath it a big bold green URL on its own line: "ctvol1.mednoteslab.com"`;

const closingPrompt =
  `${STYLE_BASE}\nLAYOUT (closing / final page): top a thin cyan radar-arc and small green caps ` +
  `"WEIRD CT CASE FILES". A big distressed white grunge heading stacked on two lines: "UNTIL THE NEXT" / ` +
  `"DEEP SCAN". Then one short white line: "You made it through all ten cases. I hope a few stuck with you.". ` +
  `Then a green-bordered rounded card with a small cyan star icon, a bold white heading "ENJOYED THE HUNT" and one white line: ` +
  `"Leave a quick review. It helps a med student more than you know.". ` +
  `Then a cyan-bordered rounded card with ${NEXT_CARD}. ` +
  `Then one bold green line: "Follow @mdnoteslab for a new weird case every day.". ` +
  `A tiny grey footer: "Educational entertainment only. Not medical advice.". Render every word and the URL exactly as written and correctly spelled.`;

const coverCt = existsSync(join(imgDir, "case01.png")) ? readFileSync(join(imgDir, "case01.png")) : undefined;
const jobs: { name: string; prompt: string; base?: Buffer }[] = [
  { name: "cover", prompt: coverPrompt, base: coverCt },
  { name: "howto", prompt: howtoPrompt },
  { name: "closing", prompt: closingPrompt },
];

const only = process.argv[2];
for (const j of jobs) {
  if (only && j.name !== only) continue;
  const out = join(pageDir, `${j.name}.png`);
  if (existsSync(out) && !only) { console.log(`= ${j.name} exists, skipping`); continue; }
  try {
    writeFileSync(out, await generateSlideImage(j.prompt, j.base, PORTRAIT));
    console.log(`[+] ${j.name}`);
  } catch (e) {
    console.log(`! ${j.name} failed: ${e instanceof Error ? e.message : e}`);
  }
}
console.log("done");
