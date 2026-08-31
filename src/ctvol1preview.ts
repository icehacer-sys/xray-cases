// Builds a "preview cover" for Weird CT Case Files: Volume 1 — page 1 (cover), page 17
// (case08 question), and page 18 (case08 answer) composited side by side, showing off the
// actual guess-then-flip pages rather than a fresh AI generation. Plain sharp composite, no
// gpt-image-2 call needed since we already have the real pages.
// Output: products/ct-volume-1/ctvol1-preview.png
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CT_VOL = process.env.CT_VOL ?? "1"; // CT_VOL=2 -> products/ct-volume-2
const DIR = `D:/Projects/xray-poster/products/ct-volume-${CT_VOL}`;
const PAGES = `${DIR}/pages-gpt`;

const PANEL_W = 1024;
const PANEL_H = 1536;
const GAP = 24;
const PAD = 24;

async function main(): Promise<void> {
  const panels = ["cover.png", "case08-q.png", "case08-a.png"].map((f) => readFileSync(`${PAGES}/${f}`));

  const outW = PAD * 2 + PANEL_W * 3 + GAP * 2;
  const outH = PAD * 2 + PANEL_H;

  const composites = await Promise.all(
    panels.map(async (buf, i) => ({
      input: await sharp(buf).resize(PANEL_W, PANEL_H).toBuffer(),
      left: PAD + i * (PANEL_W + GAP),
      top: PAD,
    })),
  );

  const png = await sharp({
    create: { width: outW, height: outH, channels: 4, background: { r: 5, g: 8, b: 10, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  writeFileSync(`${DIR}/ctvol1-preview.png`, png);
  console.log(`wrote ${DIR}/ctvol1-preview.png (${outW}x${outH})`);
}

await main();
