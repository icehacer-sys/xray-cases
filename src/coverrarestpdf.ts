// One-off: NEW portrait first-page cover for the Rarest Findings PDF, gpt-image-2.
// Matches the "Weird X-Ray Case Files" product family (grunge stencil title + cyan HUD
// X-ray frames + orange badge) but PORTRAIT and fixed: cyan/orange palette only (no magenta),
// REAL diagnosis names. 2 variants. Run from xray-poster root:  npx tsx src/coverrarestpdf.ts
import { writeFileSync } from "node:fs";
import { config, requireEnv } from "./config.js";

const SIZE = "1024x1536"; // portrait, PDF page
const VARIANTS = 2;

const PROMPT = [
  `Create a dark cinematic "classified medical case file" PRODUCT COVER in PORTRAIT orientation (clearly taller than wide), premium and print-quality.`,
  ``,
  `BACKGROUND: near-black, heavily textured grunge like an old X-ray archive dossier, with a faint dark blueprint grid and faint ghostly skeleton and skull line drawings bleeding through the shadows.`,
  ``,
  `TOP: a distressed ORANGE rectangular stencil badge containing the text "WEIRD X-RAY CASE FILES" in a bold weathered military stencil font, with a small orange radiation hazard trefoil to its left and a bright cyan ECG heartbeat line to its right.`,
  ``,
  `MAIN TITLE (upper third, very large, dominating): the words "RAREST FINDINGS" in a massive distressed off-white and silver GRUNGE SPRAY STENCIL military typeface, rough scratched and weathered.`,
  ``,
  `SUBTITLE directly under the title in glowing electric CYAN capitals: "10 OF THE RAREST CASES IN RADIOLOGY".`,
  ``,
  `MIDDLE BAND: a horizontal row of THREE realistic grayscale X-rays, each inside its OWN bright CYAN futuristic HUD viewer frame with corner brackets, ruler tick marks, and small "R"/"L" side markers, and a tiny cyan caption bar beneath each frame:`,
  `  - LEFT frame: a chest X-ray whose ribs are wavy and undulating like rippling ribbons instead of smooth curves. Caption: "RIBBON RIBS".`,
  `  - MIDDLE frame: a femur (thigh bone) X-ray where a segment of the bone shaft has dissolved and vanished, leaving a clear gap with tapered bone ends. Caption: "VANISHING BONE".`,
  `  - RIGHT frame: a hand X-ray where the finger and hand bones are ballooned wide and hollow, filled with rounded bubble-like see-through cavities. Caption: "HOLLOWED HAND".`,
  ``,
  `A bold distressed ORANGE rubber stamp reading "EXTREMELY RARE" is stamped at an angle in the lower-right corner.`,
  ``,
  `BOTTOM: the cyan handle "@mdnoteslab" and a thin footer line "Educational entertainment only. Not medical advice.".`,
  ``,
  `PALETTE: near-black background with ORANGE and electric CYAN accents ONLY. Absolutely NO magenta, pink, purple, or crimson anywhere. Mood: mysterious, premium, cinematic, a classified medical dossier. Ultra high detail, sharp, print quality. Spell every word correctly and clearly.`,
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
    const path = `D:/Downloads/rarest-pdf-cover-${v}.png`;
    writeFileSync(path, png);
    console.log(`saved ${path}`);
  }
  console.log(`done — ${VARIANTS} portrait covers (gpt-image-2, ${SIZE})`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
