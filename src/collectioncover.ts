// One-off: generate a fresh landscape Gumroad cover for The Complete Collection.
// Dental panel removed, "SIX EDITIONS 140 CASES" + a "VOL 3 FREE ON RELEASE" badge, price kept.
// Run from xray-poster root: npx tsx src/collectioncover.ts
import { writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const STYLE =
  "A premium WIDE LANDSCAPE product hero banner styled like a forensic 'case file' / medical HUD dashboard. " +
  "Near-black deep navy background with a faint blueprint grid, a faint ghosted skull watermark, and small " +
  "cyan HUD readout text in the corners. Accent palette electric cyan (#22d3ee) and bold orange (#f59e0b) on " +
  "dark navy with white text. TITLES use a BIG bold DISTRESSED CONDENSED grunge stencil poster font. Body text " +
  "clean modern sans-serif. A thin cyan EKG heartbeat line accent. CRITICAL: render all text crisply and " +
  "CORRECTLY SPELLED exactly as written, with no extra, missing, or misspelled words.";

const prompt = `${STYLE}
LAYOUT (the left two thirds is text, the right third is a vertical film strip of X-ray thumbnails):
LEFT SIDE: at the top an orange outlined box reading "WEIRD X-RAY CASE FILES" in bold orange caps beside a small orange folder icon, with a thin cyan EKG line. Below it a HUGE distressed white grunge title stacked on two lines: "THE COMPLETE" then "COLLECTION". Under the title a cyan bracketed subtitle reading "SIX EDITIONS   140 CASES". Directly under that a small orange rounded flag badge reading "+ VOLUME 3 FREE ON RELEASE". Toward the lower left a price row: a grey struck-through "$79" then a huge bold white "$49" then an orange rounded button reading "USE CODE SPOTIT". At the very bottom left in bold cyan: "@mdnoteslab". A tiny grey footer line: "Educational entertainment only. Not medical advice.".
RIGHT SIDE: a vertical stack of FIVE small dramatic X-ray thumbnails, each inside a cyan scanner frame with corner brackets, edge tick marks, a tiny cyan EKG blip, faint HUD readouts, and a small orange label "CASE 01" then "CASE 02" then "CASE 03" then "CASE 04" then "CASE 05". Show a VARIETY of whole-body radiographs: a chest, a skull, an abdomen, a spine, and a hand. Do NOT show any dental panoramic X-ray and no close up of teeth.
Make it look like a collectible thriller boxset cover, matching the Weird X-Ray Case Files brand.`;

for (const v of ["v3", "v3b"]) {
  process.stdout.write(`gen cover ${v} ... `);
  try {
    const buf = await generateSlideImage(prompt, undefined, "1536x1024");
    writeFileSync(`D:/Downloads/complete-collection-cover-${v}.png`, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> D:/Downloads/complete-collection-cover-${v}.png`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
