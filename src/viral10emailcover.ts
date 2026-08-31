// Email HEADER banner for "The Viral 10" launch — same landscape gpt-image-2 edit pattern as
// viral10covers.ts, anchored on the already-generated gumroad-cover.png, with a hanging "$5" price
// tag graphic added so the price is visible at a glance in an inbox preview.
// Run: npx tsx src/viral10emailcover.ts
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { requireEnv, config } from "./config.js";

const DIR = "D:/Projects/xray-poster/products/viral-10";
const REF = `${DIR}/gumroad-cover.png`;
const OUT = `${DIR}/email-cover.png`;
mkdirSync(DIR, { recursive: true });

const PROMPT =
  `Recompose this cover into a horizontal EMAIL HEADER banner, wide format. Keep the exact same ` +
  `premium brand style: near-black navy medical-dossier background with a faint blueprint grid and ` +
  `a ghosted skull, bright cyan HUD scanner frame around the X-ray, a distressed off-white spray-` +
  `stencil title stacked "THE VIRAL" / "10", cyan subtitle "The 10 X-rays that broke the internet", ` +
  `the "@mdnoteslab" handle in cyan. ADD a hanging price tag graphic in the top-right corner: a bold ` +
  `orange rounded price tag shape (like a real string-tied sale tag, angled slightly) with bold black ` +
  `text "$5" large inside it, with a small hole and a thin string at the top of the tag as if it is ` +
  `hanging off the corner of the banner. Keep the real X-ray in its cyan HUD frame with R and L markers ` +
  `and an "XR-01" tag intact on the right side of the composition. Render every word crisply and ` +
  `spelled EXACTLY as written, no extra text. High contrast, cinematic, premium.`;

async function genEdit(ref: Buffer, prompt: string): Promise<Buffer> {
  const form = new FormData();
  form.append("model", config.imageModel);
  form.append("prompt", prompt);
  form.append("size", "1536x1024"); // wide email-header friendly, > 1280x720
  form.append("quality", "high");
  form.append("n", "1");
  form.append("image", new Blob([new Uint8Array(ref)], { type: "image/png" }), "ref.png");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI edits ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function main(): Promise<void> {
  if (!existsSync(REF)) throw new Error(`reference cover not found: ${REF} (run viral10covers.ts first)`);
  const ref = await sharp(readFileSync(REF)).png().toBuffer();
  console.log("generating email-cover (1536x1024, with $5 price tag) ...");
  const png = await genEdit(ref, PROMPT);
  writeFileSync(OUT, png);
  console.log(`saved ${OUT} (${Math.round(png.length / 1024)}KB)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
