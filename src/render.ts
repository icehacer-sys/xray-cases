// Regenerate the 3 Instagram carousel slides for every case whose X-ray is in place,
// using gpt-image-2 (the owner chose AI-generated slides). Needs OPENAI_API_KEY, so this
// runs in the cloud, not locally. Re-running is safe (it overwrites the slide PNGs).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { loadCases } from "./cases.js";
import { generateSlides } from "./slidegen.js";
import type { Case } from "./types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function folderPath(c: Case): string {
  return join(projectRoot, config.casesDir, c.folder);
}

async function main(): Promise<void> {
  const cases = loadCases();
  let rendered = 0;
  for (const c of cases) {
    const dir = folderPath(c);
    const xray = join(dir, c.threadsImage);
    if (!existsSync(xray)) {
      console.log(`skip ${c.folder}: no ${c.threadsImage} yet`);
      continue;
    }
    if (!c.condition) {
      console.log(`skip ${c.folder}: no embedded condition`);
      continue;
    }
    const slides = await generateSlides(c, c.condition, readFileSync(xray));
    writeFileSync(join(dir, c.igSlides[0] ?? "question.png"), slides.question);
    writeFileSync(join(dir, c.igSlides[1] ?? "answer.png"), slides.answer);
    writeFileSync(join(dir, c.igSlides[2] ?? "cta.png"), slides.cta);
    rendered += 1;
    console.log(`generated gpt-image-2 slides for ${c.folder} (${c.diagnosis})`);
  }
  console.log(`\nDone. Regenerated ${rendered} case(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
