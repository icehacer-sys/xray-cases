// One-off: premium Payhip product covers. COMPOSITED (readable text via Resvg — no gpt-image
// text garble): dark accent-tinted gradient + a real case X-ray panel + title/subtitle/badge.
// 1600x1000 landscape (>=1000px wide). Saves to D:/Downloads/cover-<slug>.png.
// Run from xray-poster root:  npx tsx src/covergen.ts
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const W = 1600, H = 1000;
const CASES = "cases";

interface Product {
  slug: string; series: string; title: string; subtitle: string; badge: string;
  accent: string; hero: string; // case folder name, or "montage"
}

const PRODUCTS: Product[] = [
  { slug: "volume-3", series: "WEIRD X-RAY CASE FILES", title: "VOLUME 3", subtitle: "Twenty brand new cases you have never seen. The strangest set yet.", badge: "20 NEW CASES", accent: "#7c5cff", hero: "00028-cloverleaf-skull" },
  { slug: "hopital-field-edition", series: "WEIRD X-RAY CASE FILES", title: "HOPITAL FIELD EDITION", subtitle: "20 wild real X-rays. The only answer is always hopital.", badge: "GUESS HOPITAL", accent: "#ff8a3d", hero: "00059-mediastinal-teratoma" },
  { slug: "its-just-anxiety", series: "THE MEDICAL GASLIGHTING CARD GAME", title: "IT'S JUST ANXIETY", subtitle: "120 cards. Draw an impossible case. The most dismissive answer wins the round.", badge: "120 CARDS", accent: "#ff4d5e", hero: "00006-swallowed-sword" },
  { slug: "complete-collection", series: "WEIRD X-RAY CASE FILES", title: "THE COMPLETE COLLECTION", subtitle: "Six editions. 140 strange real X-rays. Every answer. All in one place.", badge: "$30 OFF WITH CODE SPOTIT", accent: "#22d3ee", hero: "montage" },
  { slug: "could-you-spot-it", series: "WEIRD X-RAY CASE FILES", title: "COULD YOU SPOT IT?", subtitle: "50 of the strangest real X-rays ever taken. One guess per page.", badge: "50 CASES", accent: "#34d399", hero: "00026-complex-odontoma" },
  { slug: "rarest-findings", series: "WEIRD X-RAY CASE FILES", title: "RAREST FINDINGS", subtitle: "The 10 rarest things in all of radiology. Most doctors never see one.", badge: "10 RAREST", accent: "#f5c542", hero: "00040-myositis-ossificans" },
  { slug: "volume-2", series: "WEIRD X-RAY CASE FILES", title: "VOLUME 2", subtitle: "Twenty more real X-rays you will not believe are real.", badge: "20 CASES", accent: "#3b82f6", hero: "00027-gardner-syndrome" },
  { slug: "hopital-pack", series: "WEIRD X-RAY CASE FILES", title: "THE HOPITAL PACK", subtitle: "5 of the wildest real X-rays. Guess hopital. Then flip for the truth.", badge: "FREE", accent: "#ff8a3d", hero: "00026-complex-odontoma" },
  { slug: "volume-1", series: "WEIRD X-RAY CASE FILES", title: "VOLUME 1", subtitle: "The 20 strangest real X-rays I could find. The original.", badge: "20 CASES", accent: "#22d3ee", hero: "00043-tophaceous-gout" },
];

const allXrays = (): string[] => readdirSync(CASES).map((f) => join(CASES, f, "xray.png")).filter(existsSync);

function heroPath(folder: string): string {
  const p = join(CASES, folder, "xray.png");
  if (existsSync(p)) return p;
  const all = allXrays();
  return all[Math.floor((folder.length * 7) % all.length)]; // deterministic fallback
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur) lines.push(cur); return lines;
}

// Right-side hero: a case X-ray (or montage) filling the right ~44%, faded into the bg on its left.
async function heroLayer(p: Product): Promise<Buffer> {
  const panelW = 720, panelX = W - panelW; // 880..1600
  let img: Buffer;
  if (p.hero === "montage") {
    const xr = allXrays();
    for (let i = xr.length - 1; i > 0; i--) { const j = (i * 97 + 13) % (i + 1); [xr[i], xr[j]] = [xr[j], xr[i]]; }
    const cols = 3, rows = 4, tile = Math.ceil(H / rows); // 250
    const tiles = await Promise.all(Array.from({ length: cols * rows }, (_, i) =>
      sharp(xr[i % xr.length]).resize(tile, tile, { fit: "cover" }).toBuffer()));
    img = await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#05070f" } })
      .composite(tiles.map((input, i) => ({ input, left: (i % cols) * tile, top: Math.floor(i / cols) * tile })))
      .resize(panelW, H, { fit: "cover" }).png().toBuffer();
  } else {
    img = await sharp(heroPath(p.hero)).resize(panelW, H, { fit: "cover" }).toBuffer();
  }
  // left-edge fade + accent tint + inner darken, so the panel melts into the dark bg
  const fade = Buffer.from(
    `<svg width="${panelW}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#060810" stop-opacity="1"/>
        <stop offset="0.38" stop-color="#060810" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#060810" stop-opacity="0.15"/></linearGradient>
      <linearGradient id="t" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.accent}" stop-opacity="0.16"/>
        <stop offset="1" stop-color="${p.accent}" stop-opacity="0.05"/></linearGradient></defs>
      <rect width="${panelW}" height="${H}" fill="url(#f)"/><rect width="${panelW}" height="${H}" fill="url(#t)"/></svg>`);
  const panel = await sharp(img).composite([{ input: fade, blend: "over" }]).png().toBuffer();
  // place on a transparent WxH canvas at panelX
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: panel, left: panelX, top: 0 }]).png().toBuffer();
}

function textSvg(p: Product): Buffer {
  const ax = 96;
  const titleSize = p.title.length <= 9 ? 116 : p.title.length <= 17 ? 82 : 64;
  const titleWrap = Math.floor(760 / (titleSize * 0.62));
  const titleLines = wrap(p.title, titleWrap);
  const titleTop = 300 - (titleLines.length - 1) * titleSize * 0.5;
  const subLines = wrap(p.subtitle, 46);
  const subTop = titleTop + (titleLines.length - 1) * (titleSize + 8) + 92;
  const badgeY = subTop + subLines.length * 40 + 46;
  const badgeW = 44 + p.badge.length * 15.5;

  const titleTspans = titleLines.map((l, i) =>
    `<text x="${ax}" y="${titleTop + i * (titleSize + 8)}" font-family="Arial Black, Segoe UI, sans-serif" font-weight="900" font-size="${titleSize}" fill="#ffffff" letter-spacing="-1">${esc(l)}</text>`).join("");
  const subTspans = subLines.map((l, i) =>
    `<text x="${ax}" y="${subTop + i * 40}" font-family="Segoe UI, Arial, sans-serif" font-weight="400" font-size="28" fill="#c7d2e3">${esc(l)}</text>`).join("");

  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="${ax}" y="170" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="24" fill="${p.accent}" letter-spacing="6">${esc(p.series)}</text>
      <rect x="${ax}" y="196" width="70" height="4" fill="${p.accent}"/>
      ${titleTspans}
      ${subTspans}
      <rect x="${ax}" y="${badgeY}" width="${badgeW}" height="52" rx="26" fill="${p.accent}"/>
      <text x="${ax + badgeW / 2}" y="${badgeY + 34}" text-anchor="middle" font-family="Arial Black, Segoe UI, sans-serif" font-weight="900" font-size="24" fill="#0a0f1e">${esc(p.badge)}</text>
      <text x="${ax}" y="${H - 54}" font-family="Segoe UI, Arial, sans-serif" font-weight="400" font-size="20" fill="#6b7890">Guess the diagnosis. Flip for the answer.  ·  mednoteslab</text>
    </svg>`);
}

function bgLayer(accent: string): Buffer {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#070b16"/><stop offset="1" stop-color="#0b1120"/></linearGradient>
    <radialGradient id="glow" cx="0.68" cy="0.32" r="0.7"><stop offset="0" stop-color="${accent}" stop-opacity="0.22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/></svg>`;
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng());
}

async function main(): Promise<void> {
  for (const p of PRODUCTS) {
    const bg = bgLayer(p.accent);
    const hero = await heroLayer(p);
    const text = new Resvg(textSvg(p).toString("utf8"), { font: { loadSystemFonts: true, defaultFontFamily: "Arial" }, fitTo: { mode: "original" } }).render().asPng();
    const out = await sharp(bg).composite([{ input: hero, blend: "over" }, { input: text, blend: "over" }]).png().toBuffer();
    const path = `D:/Downloads/cover-${p.slug}.png`;
    writeFileSync(path, out);
    console.log(`saved ${path}`);
  }
  console.log(`done — ${PRODUCTS.length} covers (${W}x${H})`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
