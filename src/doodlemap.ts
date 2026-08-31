// One-off: gpt-image-2 "doodle MAP" cover art for the Payhip store — cohesive
// hand-drawn investigation/treasure-map trails + outlines meant to sit as a
// transparent BACKGROUND banner behind a header / section (edge-to-edge, center
// left airy for text). Two-tone brand accents (pop orange #FF8A3D + cyan #22D3EE)
// drawn on PURE BLACK, then doodlemap_key.py keys black->alpha and snaps each
// stroke to the exact brand hex. Run: npx tsx src/doodlemap.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { config, requireEnv } from "./config.js";

const RAW = "D:/Downloads/doodlemap/raw";

const COMMON = [
  `Everything is drawn in thick hand-drawn marker / grease-pencil strokes using ONLY two colors: pop ORANGE (#FF8A3D) and electric CYAN (#22D3EE), roughly balanced between the two.`,
  `The background is COMPLETELY FLAT PURE BLACK (#000000) filling the entire frame edge to edge — pure black only, NO other colors, no gray, no gradient, no paper texture, no vignette.`,
  `Loose, airy, spaced out, spread edge to edge like a decorative overlay. Clean crisp marker lines. Spell any words exactly right.`,
].join(" ");

type Job = { name: string; size: string; prompt: string };

const JOBS: Job[] = [
  {
    name: "map-trail-a",
    size: "1536x1024",
    prompt: `A playful hand-drawn "case-file investigation MAP": a long winding DASHED-DOTTED trail line snaking horizontally across the whole width, with small circled "hotspot" markers and little X-marks along it, a few directional arrows following the trail, one magnifying glass, a couple of question marks, and tiny simple X-RAY doodles scattered along the way (a small rib-cage outline, a little skull outline, a bone, a hand X-ray outline). Alternate orange and cyan elements so it feels balanced. Keep the vertical middle band relatively open.`,
  },
  {
    name: "map-trail-b",
    size: "1536x1024",
    prompt: `A hand-drawn "detective evidence trail" doodle map spread wide: a dotted winding path connecting several small circled marks, several bold directional arrows pointing in different directions, two or three little scribbled tags reading "SPOT IT?" and "guess?" and "Dx", a few stars/sparkle marks, corner viewfinder brackets, and a tiny magnifying glass. Alternate orange and cyan. Airy composition, elements near the edges, center kept mostly open.`,
  },
  {
    name: "map-frame",
    size: "1536x1024",
    prompt: `A hand-drawn decorative BORDER of doodles arranged only around the EDGES and CORNERS of the frame, leaving the whole CENTER empty black for text to sit over: rough corner viewfinder brackets in each corner, short dashed-dotted trail segments running along the top and bottom edges, a few small arrows pointing inward from the sides, tiny circled marks and star sparkles in the corners, one small X-ray rib-cage outline in a corner. Alternate orange and cyan. The center two-thirds must stay pure black and empty.`,
  },
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
  console.log(`done — raw maps -> ${RAW}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
