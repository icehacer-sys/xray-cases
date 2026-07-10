// Gumroad LISTING images for "The Viral 10" — landscape cover (>=1280x720, 72dpi) and square
// thumbnail (>=600x600), both gpt-image-2 EDIT calls anchored on the portrait PDF cover already
// generated (pages-gpt/cover.png), same pattern as coverlandscape.ts.
// Run: npx tsx src/viral10covers.ts [cover|thumb|all]
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { requireEnv, config } from "./config.js";

const DIR = "D:/Projects/xray-poster/products/viral-10";
const REF = `${DIR}/pages-gpt/cover.png`;
const OUT = DIR;
mkdirSync(OUT, { recursive: true });

const COMMON =
  "Keep the EXACT same premium brand style as the reference: near-black navy medical-dossier " +
  "background with a faint blueprint grid and a ghosted skull/skeleton, bright cyan HUD scanner " +
  'frame(s) with corner brackets and ruler ticks around the X-ray(s), a distressed off-white ' +
  'spray-stencil title, a cyan ECG heartbeat line, the "@mdnoteslab" handle in cyan and tiny grey ' +
  '"Educational entertainment only. Not medical advice." Render every word crisply and spelled ' +
  "EXACTLY as written. No extra text, no cropping the title. High contrast, cinematic, premium.";

const jobs: { name: string; size: string; prompt: string }[] = [
  {
    name: "gumroad-cover",
    size: "1536x1024", // horizontal 3:2, > 1280x720
    prompt:
      `Recompose this cover into a horizontal LANDSCAPE layout, 3:2. LEFT: an orange folder tab ` +
      `"WEIRD X-RAY CASE FILES", a massive distressed title stacked "THE VIRAL" / "10", cyan subtitle ` +
      `"The 10 X-rays that broke the internet", and below it "Millions of views. Now in one pack.". ` +
      `RIGHT: the real grayscale odontoma X-ray (dense knot of tooth material in the jaw) in a cyan HUD ` +
      `frame with R and L markers and an "XR-01" tag. ${COMMON}`,
  },
  {
    name: "gumroad-thumb",
    size: "1024x1024", // square, > 600x600
    prompt:
      `Recompose this cover into a SQUARE 1:1 layout. Top: an orange folder tab "WEIRD X-RAY CASE ` +
      `FILES". Center: a massive distressed title stacked on two lines "THE VIRAL" / "10", filling most ` +
      `of the square. Below it a small cyan line "The 10 X-rays that broke the internet". The real ` +
      `grayscale odontoma X-ray small in a cyan HUD frame tucked in one corner, not the main focus — the ` +
      `TITLE should dominate this square crop since it is used as a small library/profile thumbnail. ${COMMON}`,
  },
];

async function genEdit(ref: Buffer, prompt: string, size: string): Promise<Buffer> {
  const form = new FormData();
  form.append("model", config.imageModel);
  form.append("prompt", prompt);
  form.append("size", size);
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
  if (!existsSync(REF)) throw new Error(`reference cover not found: ${REF} (run viral10extras.ts first)`);
  const ref = await sharp(readFileSync(REF)).png().toBuffer();
  const target = process.argv[2] ?? "all";
  const list = jobs.filter((j) => target === "all" || j.name.includes(target));
  for (const j of list) {
    console.log(`generating ${j.name} (${j.size}) ...`);
    try {
      const png = await genEdit(ref, j.prompt, j.size);
      const out = `${OUT}/${j.name}.png`;
      writeFileSync(out, png);
      console.log(`  saved ${out} (${Math.round(png.length / 1024)}KB)`);
    } catch (e) {
      console.error(`  FAILED ${j.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
