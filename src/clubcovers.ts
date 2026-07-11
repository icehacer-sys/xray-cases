// Gumroad LISTING images for "The Case File Club" membership — landscape cover (1536x1024) and
// square thumbnail (1024x1024), gpt-image-2 EDIT anchored on the viral-10 cover for brand
// consistency, reworked into a membership / "members only" treatment.
// Run: npx tsx src/clubcovers.ts [cover|thumb|all]
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { requireEnv, config } from "./config.js";

const DIR = "D:/Projects/xray-poster/products/case-file-club";
const REF = "D:/Projects/xray-poster/products/viral-10/gumroad-cover.png";
mkdirSync(DIR, { recursive: true });

const COMMON =
  "Keep the EXACT same premium brand style as the reference: near-black navy medical-dossier " +
  "background with a faint blueprint grid and a ghosted skull, bright cyan HUD scanner frames with " +
  "corner brackets and ruler ticks, a distressed off-white spray-stencil title, a cyan ECG heartbeat " +
  'line, the "@mdnoteslab" handle in cyan and tiny grey "Educational entertainment only. Not medical ' +
  'advice." Render every word crisply and spelled EXACTLY as written, no extra text. High contrast, ' +
  "cinematic, premium, collectible.";

const jobs: { name: string; size: string; prompt: string }[] = [
  {
    name: "gumroad-cover",
    size: "1536x1024",
    prompt:
      `Recompose into a horizontal LANDSCAPE membership cover, 3:2. LEFT: an orange folder tab ` +
      `"WEIRD X-RAY CASE FILES", a massive distressed title stacked "THE CASE FILE" / "CLUB", cyan ` +
      `subtitle "More cases. The full vault. Every week." RIGHT: a fanned STACK of several X-ray case ` +
      `file cards in cyan HUD frames overlapping like a deck (grayscale X-rays: a skull, a chest, a ` +
      `jaw), suggesting a whole growing archive. Add a bold cyan rubber-stamp badge angled over the ` +
      `corner reading "MEMBERS ONLY". ${COMMON}`,
  },
  {
    name: "gumroad-thumb",
    size: "1024x1024",
    prompt:
      `Recompose into a SQUARE 1:1 membership thumbnail. Top: an orange folder tab "WEIRD X-RAY CASE ` +
      `FILES". Center: a massive distressed title stacked on two lines "CASE FILE" / "CLUB", filling ` +
      `most of the square. A small cyan rubber-stamp badge "MEMBERS ONLY" tucked in a corner, and one ` +
      `small grayscale X-ray in a cyan HUD frame in another corner — the TITLE dominates since this is ` +
      `a small library/profile thumbnail. ${COMMON}`,
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
  if (!existsSync(REF)) throw new Error(`reference cover not found: ${REF}`);
  const ref = await sharp(readFileSync(REF)).png().toBuffer();
  const target = process.argv[2] ?? "all";
  const list = jobs.filter((j) => target === "all" || j.name.includes(target));
  for (const j of list) {
    console.log(`generating ${j.name} (${j.size}) ...`);
    try {
      const png = await genEdit(ref, j.prompt, j.size);
      const out = `${DIR}/${j.name}.png`;
      writeFileSync(out, png);
      console.log(`  saved ${out} (${Math.round(png.length / 1024)}KB)`);
    } catch (e) {
      console.error(`  FAILED ${j.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
