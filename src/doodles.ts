// One-off: gpt-image-2 decorative DOODLE overlays for the Payhip store.
// gpt-image-2 can't output transparency, so we generate each doodle as WHITE on
// PURE BLACK (max contrast), then a PIL post-step (doodles_key.py) keys the black
// to alpha and recolors the stroke to the exact brand hex. Output = clean
// transparent PNGs in the pop orange (#FF8A3D) / electric cyan (#22D3EE) accents.
// Run: npx tsx src/doodles.ts   (then: python doodles_key.py)
import { writeFileSync, mkdirSync } from "node:fs";
import { config, requireEnv } from "./config.js";

const RAW = "D:/Downloads/doodles/raw";

const COMMON = [
  `The doodle is drawn in solid pure WHITE (#FFFFFF) on a completely FLAT PURE BLACK (#000000) background that fills the entire frame edge to edge.`,
  `Pure black background, pure white stroke, maximum contrast, NOTHING else in frame — no other colors, no gray panel, no gradient, no shadow, no border.`,
  `Style: a single confident HAND-DRAWN doodle, thick grease-pencil / paint-marker stroke, slightly rough and imperfect like a human annotated a photo with a marker.`,
  `Bold, clean, crisp edges, centered with generous empty black margin all around. Spell any word exactly right.`,
].join(" ");

type Job = { name: string; size: string; prompt: string };

const JOBS: Job[] = [
  { name: "arrow-orange-down-right", size: "1536x1024", prompt: `A bold sweeping curved arrow that starts upper-left and hooks down to point toward the lower-right. One clean arrowhead.` },
  { name: "arrow-cyan-down-left", size: "1536x1024", prompt: `A bold sweeping curved arrow that starts upper-right and hooks down to point toward the lower-left. One clean arrowhead.` },
  { name: "circle-cyan-highlight", size: "1024x1024", prompt: `A rough hand-drawn OVAL circle-highlight ring, like circling something on a photo with a marker — a loose open ellipse loop with the two ends slightly overshooting, EMPTY black center.` },
  { name: "scribble-spot-it-orange", size: "1536x1024", prompt: `Energetic handwritten marker lettering reading exactly "SPOT IT?" in fun bold casual handwriting with a quick underline flourish.` },
  { name: "scribble-guess-cyan", size: "1536x1024", prompt: `Playful handwritten marker lettering reading exactly "guess the Dx!" in loose casual handwriting.` },
  { name: "underline-orange", size: "1536x1024", prompt: `A single rough hand-drawn double UNDERLINE emphasis stroke (two quick roughly-parallel marker lines sweeping left to right). Just the underline, nothing else.` },
  { name: "starburst-cyan", size: "1024x1024", prompt: `A small hand-drawn "pow" starburst / sparkle emphasis mark (a rough spiky star doodle with a couple of tiny accent ticks around it).` },
  { name: "arrow-orange-curl-up", size: "1024x1024", prompt: `A small looping hand-drawn arrow that curls around and points UP. One clean arrowhead.` },
];

async function gen(p: string, size: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    body: JSON.stringify({ model: config.imageModel, prompt: `${p}\n\n${COMMON}`, size, quality: "high", n: 1 }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  for (const job of JOBS) {
    try {
      const png = await gen(job.prompt, job.size);
      const path = `${RAW}/${job.name}.png`;
      writeFileSync(path, png);
      console.log(`saved ${path} (${job.size})`);
    } catch (e) {
      console.error(`FAILED ${job.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`done — raw doodles -> ${RAW}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
