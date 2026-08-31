// Weird CT Case Files: Vol. 2 Waitlist — GUMROAD marketing assets, same "Deep Scan" style as
// Volume 1 (obsidian black, icy cyan-blue + toxic scan-green, circular gantry-ring framing).
// No real Vol 2 case exists yet, so the frame holds a CLASSIFIED/locked placeholder instead of
// compositing a real CT slice — a teaser, not a claim about specific content.
// Run from xray-poster root: npx tsx src/ctvol2waitlist.ts
import { writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const DIR = "D:/Projects/xray-poster/products/ct-volume-2-waitlist";

const STYLE =
  "A premium graphic styled like a deep medical CT scan interface. Near-black obsidian background with a " +
  "faint circular radar-sweep grid and a faint ghosted axial brain-slice watermark. Accent palette icy " +
  "cyan-blue (#38bdf8) and toxic scan-green (#4ade80) on black with white text. TITLES use a BIG bold " +
  "DISTRESSED CONDENSED grunge stencil poster font. Body text clean modern sans-serif. A thin green " +
  "radar-sweep arc accent. CRITICAL: render all text crisply and CORRECTLY SPELLED exactly as written, " +
  "with no extra, missing, or misspelled words.";
const LOCKED_FRAME =
  " Inside a CIRCULAR cyan-green gantry-ring frame with radial tick marks (matching the Volume 1 CT scans), " +
  "show NOT a real scan but a dark redacted/scrambled placeholder: a heavily pixelated silhouette with a bold " +
  "diagonal green stencil stamp reading 'CLASSIFIED' across it, suggesting a case not yet revealed.";

const jobs = [
  {
    id: "ctvol2-waitlist-cover",
    size: "1536x1024",
    file: `${DIR}/ctvol2-waitlist-cover.png`,
    prompt: `${STYLE}${LOCKED_FRAME}
LAYOUT (WIDE landscape cover, left two thirds text, right third the locked frame):
LEFT: a green outlined box "WEIRD CT CASE FILES" beside a scan-ring icon with a thin cyan radar-arc. A small cyan rounded badge reading "EARLY ACCESS". A HUGE distressed white grunge title stacked "VOLUME" then "TWO". A cyan subtitle "10 brand new CT cases are coming". A price block: a HUGE bold white "$5" then a small green line "lock it in before it drops". At the bottom bold green "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: the locked/classified circular gantry-ring frame, large.`,
  },
  {
    id: "ctvol2-waitlist-thumb",
    size: "1024x1024",
    file: `${DIR}/ctvol2-waitlist-thumb.png`,
    prompt: `${STYLE}${LOCKED_FRAME}
LAYOUT (SQUARE thumbnail, bold and readable when small): the locked/classified circular gantry-ring frame fills the middle. At the TOP over a dark band: small green caps "WEIRD CT CASE FILES" then a HUGE distressed white grunge title "VOLUME 2" and a cyan line "EARLY ACCESS". At the BOTTOM over a dark band a bold white "$5" next to bold green "LOCK IT IN". Keep all text large and legible.`,
  },
];

const only = process.argv[2] ? process.argv[2].split(",") : null;
for (const j of jobs) {
  if (only && !only.includes(j.id)) continue;
  process.stdout.write(`gen ${j.id} (${j.size}) ... `);
  try {
    const buf = await generateSlideImage(j.prompt, undefined, j.size);
    writeFileSync(j.file, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> ${j.file}`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
