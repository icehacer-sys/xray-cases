// One-off: Volume 3 GUMROAD marketing assets (distinct from the internal book cover page).
// A horizontal cover + square thumbnail, compositing the real cloverleaf-skull hero (case01).
// Run from xray-poster root: npx tsx src/vol3gumroad.ts
import { readFileSync, writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const STYLE =
  "A premium graphic styled like a forensic case-file / medical HUD. Near-black deep navy background with a " +
  "faint blueprint grid and a faint ghosted skull watermark. Accent palette electric cyan (#22d3ee) and bold " +
  "orange (#f59e0b) on dark navy with white text. TITLES use a BIG bold DISTRESSED CONDENSED grunge stencil " +
  "poster font. Body text clean modern sans-serif. A thin cyan EKG heartbeat line accent. CRITICAL: render all " +
  "text crisply and CORRECTLY SPELLED exactly as written, with no extra, missing, or misspelled words.";
const XRAY =
  " Use the PROVIDED X-ray EXACTLY as given (do not redraw, restyle, or change its anatomy); place it inside a " +
  "cyan scanner frame with corner brackets and small measurement tick marks along the edges.";

const skull = readFileSync("products/volume-3/images/case01.png");

const jobs = [
  {
    id: "vol3-cover",
    size: "1536x1024",
    file: "D:/Downloads/vol3-cover.png",
    prompt: `${STYLE}${XRAY}
LAYOUT (WIDE landscape cover, left two thirds text, right third the X-ray):
LEFT: an orange outlined box "WEIRD X-RAY CASE FILES" beside a folder icon with a thin cyan EKG line. A HUGE distressed white grunge title stacked "VOLUME" then "THREE". A cyan subtitle "20 brand new strange real X-rays". One short white line "Could you guess what is hiding inside?". At the bottom bold cyan "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: the provided X-ray centered LARGE inside the cyan scanner frame with an "R" and "L" marker, edge tick marks and a tiny code "XR-01".`,
  },
  {
    id: "vol3-thumb",
    size: "1024x1024",
    file: "D:/Downloads/vol3-thumb.png",
    prompt: `${STYLE}${XRAY}
LAYOUT (SQUARE thumbnail, bold and readable when small): the provided X-ray fills the middle inside a cyan scanner frame with tick marks and a tiny "XR-01" code. At the TOP over a dark band: small orange caps "WEIRD X-RAY CASE FILES" then a HUGE distressed white grunge title "VOLUME 3" and a cyan line "20 STRANGE NEW X-RAYS". At the BOTTOM over a dark band bold cyan "@mdnoteslab". Keep all text large and legible and do not cover the middle of the X-ray with text.`,
  },
  {
    id: "vol3-email-cover",
    size: "1536x1024",
    file: "D:/Downloads/vol3-email-cover.png",
    prompt: `${STYLE}${XRAY}
LAYOUT (WIDE landscape EMAIL BANNER, left two thirds text, right third the X-ray):
LEFT: an orange outlined box "WEIRD X-RAY CASE FILES" beside a folder icon with a thin cyan EKG line. A small orange rounded badge reading "JUST DROPPED". A HUGE distressed white grunge title stacked "VOLUME" then "THREE". A cyan line "20 brand new strange real X-rays". A price block: a HUGE bold white "$12" then a small cyan line "instant PDF yours forever". At the bottom bold cyan "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".
RIGHT: the provided X-ray centered LARGE inside the cyan scanner frame with an "R" and "L" marker, edge tick marks and a tiny code "XR-01".`,
  },
];

const only = process.argv[2] ? process.argv[2].split(",") : null;
for (const j of jobs) {
  if (only && !only.includes(j.id)) continue;
  process.stdout.write(`gen ${j.id} (${j.size}) ... `);
  try {
    const buf = await generateSlideImage(j.prompt, skull, j.size);
    writeFileSync(j.file, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> ${j.file}`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
