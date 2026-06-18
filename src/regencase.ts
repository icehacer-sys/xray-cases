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
const EMPHASIS: Record<string, string> = {
  "00005-achondroplasia":
    "Make the diagnosis unmistakable: show the classic achondroplasia pelvis with squared short iliac wings, " +
    "a champagne-glass pelvic inlet, narrow sacrosciatic notches, and horizontal flat acetabular roofs. Keep " +
    "any overlying bowel gas minimal and clean with no smudged or blotchy texture.",
  "00006-cochlear-implant":
    "Make the cochlear implant unmistakable: a small round receiver-stimulator package fixed to the skull just " +
    "behind the ear, connected by a thin lead to a fine, tightly COILED electrode array spiralling into the " +
    "cochlea (the classic 'watch-spring' coil in the petrous temporal bone). Render that coil crisply and " +
    "clearly. Exactly ONE implant.",
  "00007-gallstone-ileus":
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

function xrayPrompt(): string {
  const lines = [
    `Create a realistic, de-identified ${cond!.view} X-ray for a medical diagnosis challenge.`,
    ``,
    `Show classic ${cond!.diagnosis}: ${cond!.keyFindings}.`,
    ``,
    `ANATOMY MUST BE CORRECT. Render a real human body with the NORMAL number of bones and organs. Do NOT`,
    `duplicate, mirror, or add any extra bone, organ, or structure. Exactly one of each paired structure`,
    `unless the pathology only changes a structure's position, shape, or density. Represent the pathology as a`,
    `change to a SINGLE structure, never an added duplicate. No melted, smeared, doubled, or garbled bone.`,
    ``,
    `Prioritize clinical realism over symmetry. A genuine abnormal finding, not a perfect textbook diagram.`,
    `Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain. Diagnostic-quality`,
    `radiograph, authentic grayscale contrast, natural X-ray grain, no cinematic glow, no artificial`,
    `sharpening, no labels, arrows, or annotations. De-identified. No identifiers, branding, or watermark.`,
  ];
  const emph = EMPHASIS[folder];
  if (emph) lines.push(``, emph);
  return lines.join("\n");
}

if (mode === "xray") {
  let png = await generateXray(xrayPrompt());
  const r = await censorXray(png);
  png = r.png;
  writeFileSync(join(dir, "xray.png"), png);
  console.log(`regenerated xray.png for ${folder} (${cond.diagnosis})${r.result.censored ? " [genital region blurred]" : ""} — REVIEW it before rendering slides`);
} else if (mode === "slides") {
  const xrayPng = readFileSync(join(dir, "xray.png"));
  const slides = await generateSlides(c, cond, xrayPng);
  slides.question = (await censorXray(slides.question)).png;
  slides.answer = (await censorXray(slides.answer)).png;
  writeFileSync(join(dir, "question.png"), slides.question);
  writeFileSync(join(dir, "answer.png"), slides.answer);
  writeFileSync(join(dir, "cta.png"), slides.cta);
  console.log(`re-rendered 3 slides for ${folder} (${cond.diagnosis})`);
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
} else {
  console.error(`unknown mode "${mode}" (use xray|slides|censor|blurbox)`);
  process.exit(1);
}
