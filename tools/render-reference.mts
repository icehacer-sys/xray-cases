// Render ONE preview X-ray for a pool condition from its atlas reference plus the anatomy guide.
// Writes BOT_REFERENCE_DIR/renders/<slug>.png (outside this public repo). No Claude calls, no case.
// One render per condition: refuses when the preview already exists. After the owner picks it:
//   npx tsx src/generate.ts --threads-only --diagnosis "<name>" --image <that png>
// Usage: npx tsx tools/render-reference.mts "<diagnosis>"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../src/config.js";
import { buildXrayPrompt } from "../src/anatomy.js";
import { generateXray } from "../src/openai.js";
import { loadReference } from "../src/reference.js";
import type { Condition } from "../src/types.js";

const name = process.argv[2];
if (!name) throw new Error('usage: render-reference "<diagnosis>"');
const pool = JSON.parse(readFileSync(resolve(config.conditionsFile), "utf8")) as Condition[];
const cond = pool.find((c) => c.diagnosis.toLowerCase() === name.toLowerCase());
if (!cond) throw new Error(`"${name}" is not in ${config.conditionsFile}`);
if (!cond.referenceImage) throw new Error(`"${name}" has no referenceImage`);
const reference = loadReference(cond)!;
const out = join(resolve(config.referenceDir), "renders", `${cond.diagnosis.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`);
if (existsSync(out)) throw new Error(`${out} already exists; one render per case, never a re-roll`);
mkdirSync(join(resolve(config.referenceDir), "renders"), { recursive: true });
writeFileSync(out, await generateXray(buildXrayPrompt(cond), reference));
console.log(`rendered ${cond.diagnosis} -> ${out}`);
