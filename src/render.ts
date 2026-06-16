// Re-render the 3 Instagram slides for every case whose X-ray is in place.
//
// The MANUAL workflow (no OpenAI key): scaffold cases with `npm run generate -- --mock`,
// drop your real X-ray over each cases/<folder>/xray.png, then run `npm run render` to
// rebuild the slides from your real image. Only the X-ray comes from you; the bot draws
// the slides. Rendering is deterministic, so running it again is harmless.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { loadCases } from "./cases.js";
import { renderSlides } from "./slides.js";
import type { Case } from "./types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function folderPath(c: Case): string {
  return join(projectRoot, config.casesDir, c.folder);
}

function main(): void {
  const cases = loadCases();
  let rendered = 0;
  for (const c of cases) {
    const dir = folderPath(c);
    const xray = join(dir, c.threadsImage);
    if (!existsSync(xray)) {
      console.log(`skip ${c.folder}: no ${c.threadsImage} yet — add your X-ray first`);
      continue;
    }
    if (!c.condition) {
      console.log(`skip ${c.folder}: no embedded condition (scaffold it with the generator)`);
      continue;
    }
    const slides = renderSlides(c, c.condition, readFileSync(xray));
    writeFileSync(join(dir, c.igSlides[0] ?? "question.png"), slides.question);
    writeFileSync(join(dir, c.igSlides[1] ?? "answer.png"), slides.answer);
    writeFileSync(join(dir, c.igSlides[2] ?? "cta.png"), slides.cta);
    rendered += 1;
    console.log(`rendered slides for ${c.folder} (${c.diagnosis})`);
  }
  console.log(`\nDone. Rendered ${rendered} case(s).`);
}

main();
