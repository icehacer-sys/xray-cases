// One-off cloud sample: generate gpt-image-2 carousel slides for one case and write
// them as *-ai.png (NEVER overwrites the live question/answer/cta.png) so the output can
// be reviewed before committing to AI slides. Usage: tsx src/slidesample.ts <folder>
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases } from "./cases.js";
import { generateSlides } from "./slidegen.js";

const folder = process.argv[2] ?? "00001-ollier-disease";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const c = loadCases().find((x) => x.folder === folder);
if (!c) throw new Error(`no case folder ${folder}`);
if (!c.condition) throw new Error(`case ${folder} has no embedded condition`);

const xray = readFileSync(join(root, "cases", folder, c.threadsImage));
console.log(`generating gpt-image-2 sample slides for ${folder} ...`);
const slides = await generateSlides(c, c.condition, xray);
writeFileSync(join(root, "cases", folder, "question-ai.png"), slides.question);
writeFileSync(join(root, "cases", folder, "answer-ai.png"), slides.answer);
writeFileSync(join(root, "cases", folder, "cta-ai.png"), slides.cta);
console.log(`wrote question-ai.png, answer-ai.png, cta-ai.png for ${folder}`);
