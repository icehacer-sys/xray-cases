// Generate Weird CT Case Files: Volume 1's CT slices with gpt-image-2 from
// products/ct-volume-1/cases.json, saved as products/ct-volume-1/images/caseNN.png.
// Resumable (skips images already made). Same technique as vol3images.ts but prompted for
// authentic axial CT slices (not X-ray film).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateXray } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const imgDir = join(dir, "images");
mkdirSync(imgDir, { recursive: true });

interface Case { n: number; diagnosis: string; whatYouSee: string; }
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as Case[];

function prompt(c: Case): string {
  return [
    `Create a realistic, de-identified AXIAL CT SCAN SLICE for a "guess the diagnosis" book.`,
    ``,
    `Show classic ${c.diagnosis}: ${c.whatYouSee}`,
    ``,
    `Authentic cross-sectional axial CT slice, the kind seen on a radiology workstation: correct`,
    `soft-tissue or lung or bone windowing for this finding, grayscale CT grain and noise, round`,
    `body outline with the anatomy in true cross-section (not a frontal X-ray projection).`,
    `No cinematic glow. No artificial sharpening. No labels, arrows, text, or annotations.`,
    `De-identified. No patient identifiers. No hospital branding. No watermark.`,
  ].join("\n");
}

const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
let done = 0;
let made = 0;
for (const c of cases) {
  if (made >= limit) break;
  const file = join(imgDir, `case${String(c.n).padStart(2, "0")}.png`);
  if (existsSync(file)) {
    done += 1;
    continue;
  }
  try {
    const png = await generateXray(prompt(c));
    writeFileSync(file, png);
    done += 1;
    made += 1;
    console.log(`[${done}/${cases.length}] generated case ${c.n} (${c.diagnosis})`);
  } catch (e) {
    console.log(`! case ${c.n} (${c.diagnosis}) failed: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`\nDone. ${done}/${cases.length} images present (${made} newly generated) in ${imgDir}`);
