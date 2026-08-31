// Generate the Volume 3 book X-rays with gpt-image-2 from products/volume-3/cases.json,
// saved as products/volume-3/images/caseNN.png. Resumable (skips images already made).
// Same technique as bookimages.ts, pointed at the Volume 3 product dir.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateXray } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "products", "volume-3");
const imgDir = join(dir, "images");
mkdirSync(imgDir, { recursive: true });

interface BookCase { n: number; diagnosis: string; whatYouSee: string; }
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as BookCase[];

function prompt(c: BookCase): string {
  return [
    `Create a realistic, de-identified X-ray for a "guess the diagnosis" book.`,
    ``,
    `Show classic ${c.diagnosis}: ${c.whatYouSee}`,
    ``,
    `Diagnostic-quality radiograph. Authentic grayscale contrast and natural X-ray grain.`,
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
