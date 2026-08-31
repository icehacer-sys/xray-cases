// One-off: redesign Gumroad product covers with gpt-image-2 EDIT mode, anchored to the existing
// showcase covers (cropped from the complete-collection grid) as style references. 1 variant each.
// Run:  npx tsx src/coverredesign.ts [slug|all]
import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { requireEnv, config } from "./config.js";

const GRID = "D:/Downloads/product-showcases/complete-collection-grid.jpg";
const OUT = "D:/Downloads/covers-redesign";
mkdirSync(OUT, { recursive: true });

// grid = 2904x2654, 3 cols x 2 rows. [col,row] of each product's cover cell.
const GW = 2904, GH = 2654, CW = Math.floor(GW / 3), CH = Math.floor(GH / 2), INSET = 26;
async function cell(col: number, row: number): Promise<Buffer> {
  return sharp(GRID).extract({ left: col * CW + INSET, top: row * CH + INSET, width: CW - INSET * 2, height: CH - INSET * 2 }).png().toBuffer();
}

interface Cover { slug: string; col?: number; row?: number; full?: boolean; size?: string; prompt: string }
const COMMON = `Keep the EXACT same premium visual style as the reference: near-black navy medical-dossier background with a faint blueprint grid and a ghosted skull, a bright cyan HUD scanner frame with corner brackets and ruler ticks around the X-ray, a distressed off-white spray-stencil title, a cyan ECG heartbeat line, the "@mdnoteslab" handle in cyan near the bottom, and tiny grey "Educational entertainment only. Not medical advice." Portrait book-cover proportions. High contrast, cinematic, premium. Render every word crisply and spelled EXACTLY as written. No extra text.`;

const COVERS: Cover[] = [
  { slug: "could-you-spot-it", col: 0, row: 1, prompt: `Redesign this into one clean Gumroad cover. Orange folder tab "WEIRD X-RAY CASE FILES" top-left. Massive title "COULD YOU SPOT IT?". Cyan subtitle "50 of the strangest real X-rays ever taken". One striking real grayscale X-ray in the cyan HUD frame with an "XR-01" corner tag. Line under the frame: "Could you guess what is hiding inside?". ${COMMON}` },
  { slug: "volume-1", col: 0, row: 0, prompt: `Redesign this into one clean Gumroad cover. Massive title "WEIRD X-RAY CASE FILES". Add a clear orange stencil badge reading "VOLUME 1". Cyan subtitle "20 bizarre medical images explained in simple language". Keep three real grayscale X-ray panels in cyan HUD frames (a skull with a lightbulb, a jaw in profile, an abdomen full of swallowed objects). Keep the four small feature icons labelled "REAL CASES", "SIMPLE EXPLANATIONS", "PERFECT FOR CURIOUS MINDS", "SEE BEYOND THE SURFACE". ${COMMON}` },
  { slug: "volume-2", col: 1, row: 0, prompt: `Redesign this into one clean Gumroad cover. Massive title "WEIRD X-RAY CASE FILES" framed by big orange square brackets, with an orange stencil badge "VOLUME 2" below it. Cyan subtitle "20 NEW bizarre medical images explained in simple language". Keep three real grayscale X-ray scans in cyan HUD frames and the four small round feature icons labelled "REAL CASES", "SIMPLE EXPLANATIONS", "PERFECT FOR CURIOUS MINDS", "SEE BEYOND THE SURFACE". ${COMMON}` },
  { slug: "volume-3", col: 2, row: 0, prompt: `Redesign this into one clean Gumroad cover. Orange folder tab "WEIRD X-RAY CASE FILES" top-left. Massive two-line title "VOLUME THREE". Cyan subtitle "20 brand new strange real X-rays". One striking real grayscale skull X-ray (a cloverleaf-shaped skull) in the cyan HUD frame with R and L markers and an "XR-01" corner tag. Line under the frame: "Could you guess what is hiding inside?". ${COMMON}` },
  { slug: "hopital-field-edition", col: 1, row: 1, prompt: `Redesign this into one clean Gumroad cover. Massive title "WEIRD X-RAY CASE FILES" with a bold orange bar below reading "HOPITAL FIELD EDITION". Subtitle "20 wild real cases. one obvious diagnosis." One dramatic real grayscale chest X-ray in the cyan HUD frame. A red distressed rubber stamp reading "HOPITAL" angled in the lower-right corner. ${COMMON}` },
  { slug: "rarest-findings", col: 2, row: 1, prompt: `Redesign this into one clean Gumroad cover in a grittier "classified archive" version of the style. Orange stencil badge "WEIRD X-RAY CASE FILES" top area. Massive silver grunge title "RAREST FINDINGS". Cyan subtitle "10 OF THE RAREST CASES IN RADIOLOGY". Three real grayscale X-rays in cyan HUD frames labelled "RIBBON RIBS", "VANISHING BONE", "HOLLOWED HAND". A bold orange distressed rubber stamp reading "EXTREMELY RARE" angled in a lower corner. Faint classified-dossier annotations in the background. ${COMMON}` },
  { slug: "complete-collection", full: true, size: "1024x1024", prompt: `Keep this exact 2x3 grid of six premium X-ray "case files" product covers, same layout and same style, every cover and all its text intact and legible. Add ONE bold callout banner across the bottom third: a bright cyan and orange ribbon reading "THE COMPLETE COLLECTION" and directly under it a large high-contrast badge reading "USE CODE SPOTIT FOR $30 OFF". Also add a small line "Six editions. 140 strange real X-rays. Every answer." Keep the near-black dossier background. Render every word crisply and spelled EXACTLY as written. Do not distort or cover the six product covers.` },
  { slug: "complete-collection-thumbnail", full: true, size: "1024x1024", prompt: `Design a BOLD SQUARE product THUMBNAIL that must stay readable at small size (it appears tiny in a shop grid), using these six product covers as the source. Near-black navy medical-dossier background with a faint blueprint grid, a ghosted skull, and a cyan ECG heartbeat line. In the CENTER show the six "Weird X-Ray Case Files" editions as a neat overlapping FANNED STACK of covers angled like a spread deck of books, each a dark cover with a glowing cyan HUD X-ray panel, so it clearly reads as a bundle. A big bold distressed off-white spray-stencil title across the TOP: "THE COMPLETE COLLECTION". Near the BOTTOM a large high-contrast rounded badge reading "USE CODE SPOTIT FOR $30 OFF" with the word SPOTIT in bright orange. A small cyan line under it: "Six editions · 140 real X-rays". Small "@mdnoteslab" in a corner. Cyan and orange accents only, premium, cinematic, high contrast, uncluttered so it reads when shrunk. Render every word crisply and spelled EXACTLY as written. No extra text.` },
];

async function genEdit(ref: Buffer, prompt: string, size = "1024x1536"): Promise<Buffer> {
  const form = new FormData();
  form.append("model", config.imageModel); // gpt-image-2
  form.append("prompt", prompt);
  form.append("size", size);
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
  const list = target === "all" ? COVERS
    : target === "rest" ? COVERS.filter((c) => c.slug !== "could-you-spot-it")
    : COVERS.filter((c) => c.slug === target);
  for (const c of list) {
    if (existsSync(`${OUT}/${c.slug}.png`) && process.argv[3] !== "--force") { console.log(`skip ${c.slug} (exists)`); continue; }
    const ref = c.full ? await sharp(GRID).png().toBuffer() : await cell(c.col!, c.row!);
    console.log(`generating ${c.slug} ...`);
    try {
      const png = await genEdit(ref, c.prompt, c.size);
      writeFileSync(`${OUT}/${c.slug}.png`, png);
      console.log(`  saved ${OUT}/${c.slug}.png (${Math.round(png.length / 1024)}KB)`);
    } catch (e) {
      console.error(`  FAILED ${c.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
