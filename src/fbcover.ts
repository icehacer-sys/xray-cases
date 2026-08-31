// One-off: build a premium "wall of weird X-rays" Facebook cover — a mosaic of REAL case
// X-rays under a modern gradient wash + vignette. No AI, no text-garble. Saves to D:/Downloads.
// Run from xray-poster root:  npx tsx src/fbcover.ts
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const W = 1640, H = 624;
const COLS = 8, ROWS = 3;            // 24 tiles (denser wall)
const TILE = Math.ceil(H / ROWS);    // 208
const CANVAS_W = COLS * TILE;        // 1664 (crop to W, centered)

// gather case X-rays
const casesDir = "cases";
const xrays: string[] = [];
for (const f of readdirSync(casesDir)) {
  const p = join(casesDir, f, "xray.png");
  if (existsSync(p)) xrays.push(p);
}
for (let i = xrays.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xrays[i], xrays[j]] = [xrays[j], xrays[i]]; }
const need = COLS * ROWS;
const pick: string[] = [];
for (let i = 0; i < need; i++) pick.push(xrays[i % xrays.length]);
console.log(`mosaic from ${xrays.length} X-rays, ${need} tiles`);

// build the mosaic
const tiles = await Promise.all(pick.map((p) => sharp(p).resize(TILE, TILE, { fit: "cover" }).toBuffer()));
const composites = tiles.map((input, i) => ({ input, left: (i % COLS) * TILE, top: Math.floor(i / COLS) * TILE }));
const mosaicFull = await sharp({ create: { width: CANVAS_W, height: ROWS * TILE, channels: 3, background: "#05070f" } })
  .composite(composites).png().toBuffer();
const mosaic = await sharp(mosaicFull).extract({ left: Math.floor((CANVAS_W - W) / 2), top: 0, width: W, height: H }).toBuffer();

// premium navy -> violet gradient wash + vignette (kept moderate so the scans stay visible)
const overlay = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0a1030" stop-opacity="0.62"/>
        <stop offset="0.5" stop-color="#1a1550" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#5a1f9e" stop-opacity="0.62"/>
      </linearGradient>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.8">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="0.65" stop-color="#000000" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.62"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#wash)"/>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`,
);

const out = await sharp(mosaic).composite([{ input: overlay, blend: "over" }]).png().toBuffer();
const path = "D:/Downloads/fb-cover-wall.png";
writeFileSync(path, out);
console.log(`saved -> ${path} (${W}x${H})`);
