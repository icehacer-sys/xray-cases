// One-off: generate Volume 1 + Volume 2 Payhip covers ENTIRELY with gpt-image-2, matching the
// existing "classified medical case file" brand style (near-black grunge, orange stencil badge,
// big distressed stencil title, cyan HUD X-ray frame + ECG + radiology metadata). 2 variants each.
// Run from xray-poster root:  npx tsx src/covergpt.ts
import { writeFileSync } from "node:fs";
import { config, requireEnv } from "./config.js";

const SIZE = "1536x1024"; // 3:2 landscape, >1000px wide
const VARIANTS = 2;

interface Cover { slug: string; title: string; tagline: string; hero: string }
const COVERS: Cover[] = [
  { slug: "cover-rarest-findings", title: "RAREST FINDINGS", tagline: "The 10 rarest things in all of radiology", hero: "a bizarre chest X-ray where the ribs are wavy and ribbon shaped undulating like ripples instead of smooth curves" },
];

function prompt(c: Cover): string {
  return [
    `Create a dark cinematic "classified medical case file" cover artwork in landscape orientation.`,
    ``,
    `BACKGROUND: near-black and heavily textured grunge like an old X-ray archive dossier. Faint ghostly anatomical skeleton and skull line drawings bleed through the shadows over a subtle dark blueprint grid with scattered tiny technical annotations and scratches.`,
    ``,
    `TOP LEFT: a distressed ORANGE rectangular stencil badge containing the text "WEIRD X-RAY CASE FILES" in a bold weathered military stencil font.`,
    ``,
    `MAIN TITLE on the left side: the words "${c.title}" in a massive distressed off-white and silver GRUNGE SPRAY STENCIL military typeface, rough scratched and weathered, dominating the left half.`,
    ``,
    `BELOW THE TITLE: a glowing electric CYAN tagline reading "${c.tagline}", a bright cyan ECG heartbeat line, and the cyan handle "@mdnoteslab".`,
    ``,
    `HUD DETAILS scattered subtly in cyan and orange: a small orange radiation hazard trefoil symbol, a monospace metadata block reading CASE ID and MODALITY RADIOGRAPH and VIEW PA and DATE, a small exposure readout with kV mAs EXPO EI DAP, and a faint targeting reticle crosshair.`,
    ``,
    `A bold distressed ORANGE circular rubber stamp reading "EXTREMELY RARE" is stamped at an angle in a lower corner.`,
    ``,
    `RIGHT SIDE: a realistic grayscale X-ray of ${c.hero}, shown inside a bright CYAN futuristic HUD viewer frame with corner brackets, ruler tick marks along the edges, and small "R" and "L" side markers.`,
    ``,
    `PALETTE: near-black background with ORANGE and electric CYAN accents only. Mood: mysterious, premium, cinematic, a classified medical dossier. Ultra high detail. Spell every word correctly and clearly.`,
  ].join("\n");
}

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
  for (const c of COVERS) {
    for (let v = 1; v <= VARIANTS; v++) {
      const png = await gen(prompt(c));
      const path = `D:/Downloads/cover-gpt-${c.slug}-${v}.png`;
      writeFileSync(path, png);
      console.log(`saved ${path}`);
    }
  }
  console.log(`done — ${COVERS.length} covers x ${VARIANTS} variants (gpt-image-2, ${SIZE})`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
