// Landscape (horizontal) versions of the product covers for Gumroad/Payhip (>=1280x720, 72dpi).
// gpt-image-2 EDIT: reference = the portrait cover already generated, output 1536x1024 (3:2), reflowed
// to a horizontal title-left / X-ray-right layout. Keeps the portrait set intact (writes to /landscape).
// Run:  npx tsx src/coverlandscape.ts [slug|all|rest]
import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { requireEnv, config } from "./config.js";

const SRC = "D:/Downloads/covers-redesign";           // portrait covers (references)
const GRID = "D:/Downloads/product-showcases/complete-collection-grid.jpg";
const OUT = "D:/Downloads/covers-redesign/landscape";
mkdirSync(OUT, { recursive: true });

const COMMON = `Horizontal LANDSCAPE product cover, 3:2, wide. Keep the EXACT same premium brand style as the reference: near-black navy medical-dossier background with a faint blueprint grid and a ghosted skull/skeleton, bright cyan HUD scanner frame(s) with corner brackets and ruler ticks around the X-ray(s), a distressed off-white spray-stencil title, a cyan ECG heartbeat line, the "@mdnoteslab" handle in cyan and tiny grey "Educational entertainment only. Not medical advice." Put the TITLE and all text on the LEFT, the X-ray(s) in HUD frame(s) on the RIGHT. High contrast, cinematic, premium. Render every word crisply and spelled EXACTLY as written. No extra text, no cropping the title.`;

interface Cover { slug: string; grid?: boolean; prompt: string }
const COVERS: Cover[] = [
  { slug: "could-you-spot-it", prompt: `Recompose this cover into a horizontal landscape layout. LEFT: an orange folder tab "WEIRD X-RAY CASE FILES", a massive title "COULD YOU SPOT IT?", a cyan subtitle "50 of the strangest real X-rays ever taken", and below it "Could you guess what is hiding inside?". RIGHT: the striking real grayscale abdomen X-ray (a hidden fetus skeleton inside the pelvis) in a cyan HUD frame with R and L markers and an "XR-01" tag. ${COMMON}` },
  { slug: "volume-1", prompt: `Recompose into horizontal landscape. LEFT: title "WEIRD X-RAY CASE FILES" with an orange "VOLUME 1" badge and cyan subtitle "20 bizarre medical images explained in simple language". RIGHT: three real grayscale X-rays in cyan HUD frames (a skull with a lightbulb, a jaw in profile, an abdomen full of swallowed objects). Along the bottom a row of four small feature icons labelled "REAL CASES", "SIMPLE EXPLANATIONS", "PERFECT FOR CURIOUS MINDS", "SEE BEYOND THE SURFACE". ${COMMON}` },
  { slug: "volume-2", prompt: `Recompose into horizontal landscape. LEFT: title "WEIRD X-RAY CASE FILES" in orange square brackets with an orange "VOLUME 2" badge, cyan subtitle "20 NEW bizarre medical images explained in simple language". RIGHT: three real grayscale X-ray scans in cyan HUD frames. Bottom row: four small round feature icons labelled "REAL CASES", "SIMPLE EXPLANATIONS", "PERFECT FOR CURIOUS MINDS", "SEE BEYOND THE SURFACE". ${COMMON}` },
  { slug: "volume-3", prompt: `Recompose into horizontal landscape. LEFT: orange folder tab "WEIRD X-RAY CASE FILES", massive title "VOLUME THREE", cyan subtitle "20 brand new strange real X-rays", and "Could you guess what is hiding inside?". RIGHT: one real grayscale cloverleaf-shaped skull X-ray in a cyan HUD frame with R and L markers and an "XR-01" tag. ${COMMON}` },
  { slug: "hopital-field-edition", prompt: `Recompose into horizontal landscape. LEFT: title "WEIRD X-RAY CASE FILES" with a bold orange bar "HOPITAL FIELD EDITION" and subtitle "20 wild real cases. one obvious diagnosis." RIGHT: one dramatic real grayscale chest X-ray in a cyan HUD frame, with a red distressed rubber stamp reading "HOPITAL" angled over its corner. ${COMMON}` },
  { slug: "rarest-findings", prompt: `Recompose into horizontal landscape, grittier "classified archive" style. LEFT: an orange stencil badge "WEIRD X-RAY CASE FILES", massive silver grunge title "RAREST FINDINGS", cyan subtitle "10 OF THE RAREST CASES IN RADIOLOGY", and a bold orange distressed stamp "EXTREMELY RARE". RIGHT: three real grayscale X-rays in cyan HUD frames labelled "RIBBON RIBS", "VANISHING BONE", "HOLLOWED HAND". Faint classified-dossier annotations. ${COMMON}` },
  { slug: "complete-collection", grid: true, prompt: `Arrange these six premium X-ray "case files" product covers into a HORIZONTAL landscape composition: three covers across and two down, all six visible with their text intact and legible, on a near-black dossier background. Across the bottom add a bold banner: a bright cyan-and-orange ribbon reading "THE COMPLETE COLLECTION", directly under it a large high-contrast badge "USE CODE SPOTIT FOR $30 OFF", and a small line "Six editions. 140 strange real X-rays. Every answer." Render every word crisply and spelled EXACTLY. Do not distort or cover the six covers.` },
];

async function genEdit(ref: Buffer, prompt: string): Promise<Buffer> {
  const form = new FormData();
  form.append("model", config.imageModel);
  form.append("prompt", prompt);
  form.append("size", "1536x1024"); // horizontal 3:2, > 1280x720
  form.append("quality", "high");
  form.append("n", "1");
  form.append("image", new Blob([new Uint8Array(ref)], { type: "image/png" }), "ref.png");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` }, body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI edits ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? "could-you-spot-it";
  const force = process.argv[3] === "--force";
  const list = target === "all" ? COVERS
    : target === "rest" ? COVERS.filter((c) => c.slug !== "could-you-spot-it")
    : COVERS.filter((c) => c.slug === target);
  for (const c of list) {
    if (existsSync(`${OUT}/${c.slug}.png`) && !force) { console.log(`skip ${c.slug} (exists)`); continue; }
    const ref = c.grid ? await sharp(GRID).png().toBuffer() : await sharp(`${SRC}/${c.slug}.png`).png().toBuffer();
    console.log(`generating landscape ${c.slug} ...`);
    try {
      const png = await genEdit(ref, c.prompt);
      writeFileSync(`${OUT}/${c.slug}.png`, png);
      console.log(`  saved ${OUT}/${c.slug}.png (${Math.round(png.length / 1024)}KB)`);
    } catch (e) {
      console.error(`  FAILED ${c.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
