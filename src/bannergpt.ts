// One-off: gpt-image-2 promotional BANNER for the Complete Collection bundle headline.
// Case-file grunge style: title + a row of six X-ray case-file panels + SPOTIT discount stamp.
// gpt-image-2 max landscape is 1536x1024 (1.5:1). Run: npx tsx src/bannergpt.ts
import { writeFileSync } from "node:fs";
import { config, requireEnv } from "./config.js";

const SIZE = "1536x1024";
const VARIANTS = 2;

const PROMPT = [
  `Create a dark cinematic "classified medical case file" promotional BANNER, wide landscape.`,
  ``,
  `BACKGROUND: deep near-black navy (#01081b), heavily textured grunge like an old X-ray archive dossier, with a faint dark blueprint grid, faint ghostly skeleton and skull line drawings bleeding through, a small orange radiation hazard trefoil, and a glowing electric-cyan ECG heartbeat line.`,
  ``,
  `TOP CENTER: a small distressed ORANGE military-stencil eyebrow reading "WEIRD X-RAY CASE FILES", and directly below it a MASSIVE distressed off-white and silver GRUNGE SPRAY STENCIL title reading "THE COMPLETE COLLECTION". Under the title, a thin glowing cyan tagline: "6 editions - 140 strange real X-rays - every answer".`,
  ``,
  `CENTER BAND: a neat horizontal ROW of SIX distinct vertical medical case-file dossier book covers, evenly spaced side by side like six editions of a book series lined up on a shelf. Each cover is a dark X-ray dossier showing a DIFFERENT weird grayscale X-ray inside a bright cyan HUD viewer frame with tiny orange labels and R/L markers. Exactly six covers, upright, similar size, clean spacing.`,
  ``,
  `BOTTOM CENTER: a bold distressed ORANGE rounded rubber-stamp badge, stamped slightly at an angle, reading "USE CODE SPOTIT FOR $30 OFF" in heavy military stencil letters.`,
  ``,
  `The small cyan handle "@mdnoteslab" in a lower corner.`,
  ``,
  `PALETTE: deep navy near-black with ORANGE and electric CYAN accents ONLY. No other colors. Mood: premium, cinematic, a classified medical dossier promo poster. Ultra high detail, sharp, print quality. Spell every word correctly and clearly.`,
].join("\n");

async function gen(p: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    body: JSON.stringify({ model: config.imageModel, prompt: p, size: SIZE, quality: "high", n: 1 }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function main(): Promise<void> {
  for (let v = 1; v <= VARIANTS; v++) {
    const png = await gen(PROMPT);
    const path = `D:/Downloads/collection-banner-gpt-${v}.png`;
    writeFileSync(path, png);
    console.log(`saved ${path}`);
  }
  console.log(`done — ${VARIANTS} banners (gpt-image-2, ${SIZE})`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
