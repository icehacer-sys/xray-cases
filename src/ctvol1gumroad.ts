// Weird CT Case Files: Volume 1 — GUMROAD marketing assets, in the "Deep Scan" style (distinct
// from the X-ray line's navy/cyan/orange forensic HUD): obsidian black, icy cyan-blue + toxic
// scan-green, circular gantry-ring framing. A horizontal cover + square thumbnail + an email
// banner with the price, all compositing the saddle-PE hero CT slice (case01, most dramatic).
// Run from xray-poster root: npx tsx src/ctvol1gumroad.ts
import { readFileSync, writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const CT_VOL = process.env.CT_VOL ?? "1";
// Volume word and number for the marketing art. These were hardcoded to ONE / 1, so Volume 2's
// Gumroad cover shipped reading "VOLUME ONE".
const VOL_WORD: Record<string, string> = { "1": "ONE", "2": "TWO", "3": "THREE", "4": "FOUR" };
const VOL_NAME = VOL_WORD[CT_VOL] ?? CT_VOL; // CT_VOL=2 -> products/ct-volume-2
const DIR = `D:/Projects/xray-poster/products/ct-volume-${CT_VOL}`;

const STYLE =
  "A premium graphic styled like a deep medical CT scan interface. Near-black obsidian background with a " +
  "faint circular radar-sweep grid and a faint ghosted axial brain-slice watermark. Accent palette icy " +
  "cyan-blue (#38bdf8) and toxic scan-green (#4ade80) on black with white text. TITLES use a BIG bold " +
  "DISTRESSED CONDENSED grunge stencil poster font. Body text clean modern sans-serif. A thin green " +
  "radar-sweep arc accent. CRITICAL: render all text crisply and CORRECTLY SPELLED exactly as written, " +
  "with no extra, missing, or misspelled words.";
const CT =
  " Use the PROVIDED CT slice EXACTLY as given (do not redraw, restyle, or change its anatomy); place it " +
  "inside a CIRCULAR cyan-green gantry-ring frame with radial tick marks around the circumference like a " +
  "scanner dial, not a rectangular frame.";

const hero = readFileSync(`${DIR}/images/case01.png`);

const jobs = [
  {
    id: `ctvol${CT_VOL}-cover`,
    size: "1536x1024",
    file: `${DIR}/ctvol${CT_VOL}-cover.png`,
    prompt: `${STYLE}${CT}
LAYOUT (WIDE landscape cover, left two thirds text, right third the CT slice):
LEFT: a green outlined box "WEIRD CT CASE FILES" beside a scan-ring icon with a thin cyan radar-arc. A HUGE distressed white grunge title stacked "VOLUME" then "${VOL_NAME}". A cyan subtitle "10 CT cases that will stop you cold". One short white line "Could you guess what is hiding inside?". At the bottom bold green "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: the provided CT slice centered LARGE inside the circular cyan-green gantry-ring frame with radial tick marks and a tiny code "CT-01".`,
  },
  {
    id: `ctvol${CT_VOL}-thumb`,
    size: "1024x1024",
    file: `${DIR}/ctvol${CT_VOL}-thumb.png`,
    prompt: `${STYLE}${CT}
LAYOUT (SQUARE thumbnail, bold and readable when small): the provided CT slice fills the middle inside a circular cyan-green gantry-ring frame with radial tick marks and a tiny "CT-01" code. At the TOP over a dark band: small green caps "WEIRD CT CASE FILES" then a HUGE distressed white grunge title "VOLUME ${CT_VOL}" and a cyan line "10 CT CASES". At the BOTTOM over a dark band bold green "@mdnoteslab". Keep all text large and legible and do not cover the middle of the CT slice with text.`,
  },
  {
    id: `ctvol${CT_VOL}-email-cover`,
    size: "1536x1024",
    file: `${DIR}/ctvol${CT_VOL}-email-cover.png`,
    prompt: `${STYLE}${CT}
LAYOUT (WIDE landscape EMAIL BANNER, left two thirds text, right third the CT slice):
LEFT: a green outlined box "WEIRD CT CASE FILES" beside a scan-ring icon with a thin cyan radar-arc. A small green rounded badge reading "JUST DROPPED". A HUGE distressed white grunge title stacked "VOLUME" then "${VOL_NAME}". A cyan line "10 CT cases that will stop you cold". A price block: a HUGE bold white "$5" then a small green line "instant PDF yours forever". At the bottom bold green "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: the provided CT slice centered LARGE inside the circular cyan-green gantry-ring frame with radial tick marks and a tiny code "CT-01".`,
  },
];

const only = process.argv[2] ? process.argv[2].split(",") : null;
for (const j of jobs) {
  if (only && !only.includes(j.id)) continue;
  process.stdout.write(`gen ${j.id} (${j.size}) ... `);
  try {
    const buf = await generateSlideImage(j.prompt, hero, j.size);
    writeFileSync(j.file, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> ${j.file}`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
