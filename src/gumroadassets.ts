// One-off: generate updated Gumroad art. A square Complete Collection thumbnail, and a
// horizontal cover + square thumbnail for the new Volume 4 Waitlist product.
// Run from xray-poster root: npx tsx src/gumroadassets.ts
import { writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const STYLE =
  "A premium graphic styled like a forensic case-file / medical HUD. Near-black deep navy background with a " +
  "faint blueprint grid and a faint ghosted skull watermark. Accent palette electric cyan (#22d3ee) and bold " +
  "orange (#f59e0b) on dark navy with white text. TITLES use a BIG bold DISTRESSED CONDENSED grunge stencil " +
  "poster font. Body text clean modern sans-serif. A thin cyan EKG heartbeat line accent. CRITICAL: render all " +
  "text crisply and CORRECTLY SPELLED exactly as written, with no extra, missing, or misspelled words.";

const shots = [
  {
    id: "collection-thumb-v3",
    size: "1024x1024",
    file: "D:/Downloads/collection-thumb-v3.png",
    prompt: `${STYLE}
LAYOUT (SQUARE thumbnail, bold and readable even when shown small): centered composition. At the top a small orange folder icon with "WEIRD X-RAY CASE FILES" in orange caps and a thin cyan EKG line. A HUGE distressed white grunge title stacked on two lines: "THE COMPLETE" then "COLLECTION". Under it a cyan bracketed line "SIX EDITIONS   140 CASES". Below that a price row: a grey struck-through "$79" then a big bold white "$49" then a small orange rounded button reading "CODE SPOTIT". Near the bottom in bold cyan "@mdnoteslab". A faint ghosted skull and a subtle strip of tiny X-ray thumbnails in the background. Keep all text large and legible.`,
  },
  {
    id: "vol4-cover",
    size: "1536x1024",
    file: "D:/Downloads/vol4-waitlist-cover.png",
    prompt: `${STYLE}
LAYOUT (WIDE landscape cover, the left two thirds is text and the right third is a mystery panel):
LEFT: an orange outlined box reading "WEIRD X-RAY CASE FILES" beside a small orange folder icon with a thin cyan EKG line. A HUGE distressed white grunge title stacked on two lines: "VOLUME" then "FOUR". A cyan subtitle reading "THE WAITLIST". A small orange rounded badge reading "RESERVE YOUR SPOT". One short cyan line: "First access and the lowest launch price". At the bottom bold cyan "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: a single mysterious X-ray inside a cyan scanner frame with corner brackets and tick marks but heavily REDACTED and obscured so the finding cannot be seen, with a big bold orange diagonal stamp reading "COMING SOON", a large white question mark in the center of the panel, and small cyan HUD text "CASE FILE  CLASSIFIED".`,
  },
  {
    id: "vol4-thumb",
    size: "1024x1024",
    file: "D:/Downloads/vol4-waitlist-thumb.png",
    prompt: `${STYLE}
LAYOUT (SQUARE thumbnail, bold and readable when small): centered. At the top small orange caps "WEIRD X-RAY CASE FILES" with a thin cyan EKG line. A HUGE distressed white grunge title "VOLUME 4". Under it a cyan line "THE WAITLIST". A small orange rounded badge reading "RESERVE YOUR SPOT". A large white question mark in the center with a faint redacted X-ray behind it and a small bold orange "COMING SOON" stamp. Near the bottom bold cyan "@mdnoteslab". Keep all text large and legible. Do NOT add any small side ID codes, status labels, classification text, or HUD annotation columns down the left or right edges. Render ONLY the exact words listed here and nothing else.`,
  },
];

const only = process.argv[2];
for (const s of shots) {
  if (only && s.id !== only) continue;
  process.stdout.write(`gen ${s.id} (${s.size}) ... `);
  try {
    const buf = await generateSlideImage(s.prompt, undefined, s.size);
    writeFileSync(s.file, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> ${s.file}`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
