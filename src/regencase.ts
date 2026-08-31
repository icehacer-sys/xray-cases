// One-off maintenance: regenerate the X-ray and/or slides for an EXISTING queued case,
// keeping its case.json + captions. Used to replace a weak or defective image. Always
// eyeball the new X-ray before rendering slides / posting.
//   npx tsx src/regencase.ts <folder> xray     regenerate just xray.png (hardened prompt + per-case emphasis)
//   npx tsx src/regencase.ts <folder> slides   re-render the 3 slides from the current xray.png
//   npx tsx src/regencase.ts <folder> censor   blur genitalia on the existing xray.png + slides in place
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { generateXray } from "./openai.js";
import { generateSlides } from "./slidegen.js";
import { censorXray, blurBox } from "./censor.js";
import { buildXrayPrompt } from "./anatomy.js";
import sharp from "sharp";
import type { Case, Condition } from "./types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const folder = process.argv[2];
const mode = (process.argv[3] ?? "xray").toLowerCase(); // "xray" | "slides"
if (!folder) {
  console.error("usage: regencase <folder> <xray|slides>");
  process.exit(1);
}

// Per-case prompt emphasis to strengthen the weak diagnostic feature the QA flagged.
// Keyed by folder SLUG (the number prefix is stripped before lookup) so an emphasis written
// for a case keeps working when the same diagnosis is regenerated under a new case number.
const EMPHASIS: Record<string, string> = {
  "achondroplasia":
    "Make the diagnosis unmistakable: show the classic achondroplasia pelvis with squared short iliac wings, " +
    "a champagne-glass pelvic inlet, narrow sacrosciatic notches, and horizontal flat acetabular roofs. Keep " +
    "any overlying bowel gas minimal and clean with no smudged or blotchy texture.",
  "cochlear-implant":
    "Make the cochlear implant unmistakable: a small round receiver-stimulator package fixed to the skull just " +
    "behind the ear, connected by a thin lead to a fine, tightly COILED electrode array spiralling into the " +
    "cochlea (the classic 'watch-spring' coil in the petrous temporal bone). Render that coil crisply and " +
    "clearly. Exactly ONE implant, entirely on ONE side of the head: the package, its lead, and the cochlear " +
    "coil form a single unbroken connected chain on that same side. The lead must visibly JOIN the package to " +
    "the coil and must not end in mid-air, and there must be no second package, lead, or coil anywhere.",
  "gallstone-ileus":
    "Make the diagnosis unmistakable via the Rigler triad: multiple dilated gas-filled small-bowel loops " +
    "(obstruction), branching lucent gas in the biliary tree (pneumobilia) in the right upper quadrant, and a " +
    "single well-defined laminated ectopic gallstone in the right lower quadrant. The gallstone must be clearly visible.",
};

const dir = join(root, config.casesDir, folder);
const casePath = join(dir, "case.json");
if (!existsSync(casePath)) {
  console.error(`no case.json at ${casePath}`);
  process.exit(1);
}
const c = JSON.parse(readFileSync(casePath, "utf8")) as Case;
const cond = c.condition as Condition | undefined;
if (!cond) {
  console.error(`case ${folder} has no .condition to rebuild from`);
  process.exit(1);
}

/**
 * Uses THE canonical prompt from anatomy.ts. This file used to carry its own weaker copy with
 * no region rules and no device-coherence rule, so repairing a defective case could quietly
 * reintroduce the very artifact the QA gate had just caught. `avoid` feeds the recorded
 * verifyDefects back in so a regeneration is actively steered away from the known failure.
 */
function xrayPrompt(): string {
  return buildXrayPrompt(cond!, {
    emphasis: EMPHASIS[folder] ?? EMPHASIS[folder.replace(/^\d+-/, "")],
    avoid: c.verifyDefects ?? [],
  });
}

if (mode === "xray") {
  // Generate a CLEAN X-ray (no auto-censor — auto-placement is unreliable; blur manually
  // afterward with `grid` + `blurbox`).
  const png = await generateXray(xrayPrompt());
  writeFileSync(join(dir, "xray.png"), png);
  console.log(`regenerated CLEAN xray.png for ${folder} (${cond.diagnosis}) — grid + blurbox the genitals before posting`);
} else if (mode === "slides") {
  // Render CLEAN slides from the current xray.png (blur genitals afterward with grid + blurbox).
  const xrayPng = readFileSync(join(dir, "xray.png"));
  const slides = await generateSlides(c, cond, xrayPng);
  writeFileSync(join(dir, "question.png"), slides.question);
  writeFileSync(join(dir, "answer.png"), slides.answer);
  writeFileSync(join(dir, "cta.png"), slides.cta);
  console.log(`re-rendered 3 CLEAN slides for ${folder} (${cond.diagnosis}) — grid + blurbox the genitals before posting`);
} else if (mode === "censor") {
  // Blur genitalia on the existing images in place (no regeneration).
  const x = await censorXray(readFileSync(join(dir, "xray.png")));
  writeFileSync(join(dir, "xray.png"), x.png);
  let slidesBlurred = false;
  for (const f of ["question.png", "answer.png"]) {
    const p = join(dir, f);
    if (!existsSync(p)) continue;
    const r = await censorXray(readFileSync(p));
    writeFileSync(p, r.png);
    slidesBlurred = slidesBlurred || r.result.censored;
  }
  console.log(`censored ${folder}: xray ${x.result.censored ? "blurred" : "clean"}, slides ${slidesBlurred ? "blurred" : "clean"}`);
} else if (mode === "blurbox") {
  // Explicit tight blur of a known normalized box on a specific image (the reliable path: blur
  // the FINAL image directly, never via a gpt re-composite which moves/restores the region).
  //   npx tsx src/regencase.ts <folder> blurbox <file: xray|question|answer|cta> <x> <y> <w> <h>  (0-1)
  const file = process.argv[4];
  const [x, y, w, h] = process.argv.slice(5).map(Number);
  if (!file || [x, y, w, h].some((v) => !Number.isFinite(v))) {
    console.error("blurbox needs: <file: xray|question|answer|cta> x y w h (each a 0-1 fraction)");
    process.exit(1);
  }
  const fp = join(dir, file.endsWith(".png") ? file : `${file}.png`);
  const out = await blurBox(readFileSync(fp), { x, y, w, h });
  writeFileSync(fp, out);
  console.log(`blurred box [x=${x} y=${y} w=${w} h=${h}] on ${folder}/${file}`);
} else if (mode === "grid") {
  // Overlay a 0-1 coordinate grid (lines every 0.05, labels every 0.1) so an exact blur box
  // can be read off the image. Writes _grid_<file>.png next to it (not committed).
  //   npx tsx src/regencase.ts <folder> grid <file: xray|question|answer>
  const file = process.argv[4] ?? "xray";
  const fp = join(dir, file.endsWith(".png") ? file : `${file}.png`);
  const png = readFileSync(fp);
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  let g = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 1; i < 20; i++) {
    const x = Math.round((W * i) / 20);
    const y = Math.round((H * i) / 20);
    const wide = i % 2 === 0;
    g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="red" stroke-opacity="${wide ? 0.7 : 0.3}" stroke-width="1"/>`;
    g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="red" stroke-opacity="${wide ? 0.7 : 0.3}" stroke-width="1"/>`;
  }
  for (let i = 1; i < 10; i++) {
    const x = Math.round((W * i) / 10);
    const y = Math.round((H * i) / 10);
    g += `<text x="${x + 2}" y="22" fill="yellow" font-size="22" font-family="sans-serif">.${i}</text>`;
    g += `<text x="4" y="${y - 4}" fill="yellow" font-size="22" font-family="sans-serif">.${i}</text>`;
  }
  g += `</svg>`;
  const out = await sharp(png).composite([{ input: Buffer.from(g), top: 0, left: 0 }]).png().toBuffer();
  const outPath = join(dir, `_grid_${file}.png`);
  writeFileSync(outPath, out);
  console.log(outPath);
} else if (mode === "zoom") {
  // Extract + enlarge a normalized box for close inspection. Writes _zoom_<file>.png (not committed).
  //   npx tsx src/regencase.ts <folder> zoom <file> <x> <y> <w> <h>
  const file = process.argv[4] ?? "xray";
  const [x, y, w, h] = process.argv.slice(5).map(Number);
  const fp = join(dir, file.endsWith(".png") ? file : `${file}.png`);
  const png = readFileSync(fp);
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  const left = Math.max(0, Math.round(x * W));
  const top = Math.max(0, Math.round(y * H));
  const width = Math.min(W - left, Math.round(w * W));
  const height = Math.min(H - top, Math.round(h * H));
  const region = await sharp(png).extract({ left, top, width, height }).resize(680).png().toBuffer();
  const outPath = join(dir, `_zoom_${file}.png`);
  writeFileSync(outPath, region);
  console.log(outPath);
} else {
  console.error(`unknown mode "${mode}" (use xray|slides|censor|blurbox|grid|zoom)`);
  process.exit(1);
}
