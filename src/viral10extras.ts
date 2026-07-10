// Generate the "Viral 10" cover, "How it works" page, and closing page with gpt-image-2,
// same forensic case-file style as the case pages. Cover composites the odontoma X-ray
// (case01, the single highest-viewed case at 6.79M views).
// `npx tsx src/viral10extras.ts`            generates any missing of the three
// `npx tsx src/viral10extras.ts closing`    force-regenerates just that one (cover|howto|closing)
// Output: products/viral-10/pages-gpt/{cover,howto,closing}.png
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSlideImage } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "products", "viral-10");
const imgDir = join(dir, "images");
const pageDir = join(dir, "pages-gpt");
mkdirSync(pageDir, { recursive: true });
const PORTRAIT = "1024x1536";

const STYLE_BASE =
  "A premium portrait page styled like a forensic 'case file' / medical HUD. Near-black deep navy " +
  "background with a faint blueprint grid and a very faint ghosted skull watermark. Accent palette: " +
  "electric cyan (#22d3ee) and bold orange (#f59e0b) on dark navy, with white text. TITLES use a BIG " +
  "bold DISTRESSED CONDENSED grunge poster font (worn, textured, lightly stencilled, like a thriller " +
  "title). Body text is a clean modern sans-serif. A thin cyan EKG heartbeat line as a top accent. " +
  "CRITICAL: render all text crisply and CORRECTLY SPELLED exactly as written, with no extra, missing, " +
  "or misspelled words.";
const XRAY_CLAUSE =
  " Use the PROVIDED X-ray EXACTLY as given (do not redraw, restyle, or change its anatomy); place it " +
  "inside a cyan scanner frame with corner brackets and small measurement tick marks along the edges.";

const coverPrompt =
  `${STYLE_BASE}${XRAY_CLAUSE}\nLAYOUT (striking book FRONT COVER): Top a small orange folder icon with ` +
  `"WEIRD X-RAY CASE FILES" in bold orange caps and a thin cyan EKG line. Below it a HUGE distressed white ` +
  `grunge title stacked on two lines: "THE VIRAL" / "10". Under the title one short cyan line: ` +
  `"The 10 X-rays that broke the internet". Center the provided X-ray LARGE inside the cyan scanner ` +
  `frame (corner brackets, edge tick marks, an "R"/"L" marker and a tiny code "XR-01"). Near the bottom ` +
  `one short white line: "Millions of views. Now in one pack.". At the very bottom in bold cyan: ` +
  `"@mdnoteslab". A tiny grey footer: "Educational entertainment only. Not medical advice.". Make it look ` +
  `like a collectible thriller book cover.`;

const howtoPrompt =
  `${STYLE_BASE}\nLAYOUT ("How it works" page): top a thin cyan EKG line and small orange caps ` +
  `"WEIRD X-RAY CASE FILES". A big distressed white grunge heading: "HOW IT WORKS". Then three steps, each ` +
  `a bold orange circle number then one short white line inside a dark rounded card with a thin cyan edge:\n` +
  `1  Study the X-ray. Look closely.\n2  Make your guess. A B or C.\n3  Flip the page for the answer.\n` +
  `Below them one short cyan italic line: "No medical degree required. Only curiosity.". A faint ghosted ` +
  `X-ray skull in the background. A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const closingPrompt =
  `${STYLE_BASE}\nLAYOUT (closing page): top a thin cyan EKG line and small orange caps ` +
  `"WEIRD X-RAY CASE FILES". A big distressed white grunge heading stacked on two lines: "UNTIL THE NEXT" / ` +
  `"STRANGE ONE". Then two short white lines: "A brand new weird X-ray drops every single day on Threads." ` +
  `and "Come guess along with thousands of curious minds.". Then one bold cyan line: "Follow @mdnoteslab". ` +
  `Then a small orange caps label "WANT MORE" and three short cyan lines stacked exactly:\n` +
  `xray.mednoteslab.com\nspot.mednoteslab.com\nmednoteslab.gumroad.com/l/collection\n` +
  `A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const coverXray = existsSync(join(imgDir, "case01.png")) ? readFileSync(join(imgDir, "case01.png")) : undefined;
const jobs: { name: string; prompt: string; base?: Buffer }[] = [
  { name: "cover", prompt: coverPrompt, base: coverXray },
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
