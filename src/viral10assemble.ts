// Assemble the final "Weird X-Ray Case Files: The Viral 10" PDF from the gpt-image-2 pages.
// Order: cover, how-it-works, then each case's question + answer page (1..10), then closing.
// Each 1024x1536 PNG is recompressed to a baseline JPEG (quality 90, 4:4:4 to keep the
// cyan/orange text edges crisp) and embedded full-bleed on a 6x9in (2:3) page.
// Output: products/viral-10/viral-10.pdf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "products", "viral-10");
const pageDir = join(dir, "pages-gpt");

interface BookCase { n: number }
const cases = (JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as BookCase[]).sort((a, b) => a.n - b.n);

const order: string[] = ["cover", "howto"];
for (const c of cases) {
  const nn = String(c.n).padStart(2, "0");
  order.push(`case${nn}-q`, `case${nn}-a`);
}
order.push("closing");

const W = 432, H = 648; // 6x9in at 72pt — exact 2:3 to match the 1024x1536 pages (no distortion)
const pdf = await PDFDocument.create();
let missing = 0, bytesIn = 0, bytesOut = 0;

for (const name of order) {
  const p = join(pageDir, `${name}.png`);
  if (!existsSync(p)) { console.log(`! MISSING ${name}.png`); missing++; continue; }
  const raw = readFileSync(p);
  bytesIn += raw.length;
  const jpg = await sharp(raw).jpeg({ quality: 90, progressive: false, chromaSubsampling: "4:4:4" }).toBuffer();
  bytesOut += jpg.length;
  const img = await pdf.embedJpg(jpg);
  const page = pdf.addPage([W, H]);
  page.drawImage(img, { x: 0, y: 0, width: W, height: H });
}

pdf.setTitle("Weird X-Ray Case Files: The Viral 10");
pdf.setAuthor("@mdnoteslab");
pdf.setSubject("The 10 highest-viewed X-ray diagnosis challenges, now in one PDF");
pdf.setCreator("@mdnoteslab — Weird X-Ray Case Files");

const out = join(dir, "viral-10.pdf");
writeFileSync(out, await pdf.save());
const mb = (n: number) => (n / 1048576).toFixed(1) + "MB";
console.log(`wrote ${out}`);
console.log(`${pdf.getPageCount()} pages | PNG ${mb(bytesIn)} -> JPEG ${mb(bytesOut)}${missing ? ` | ${missing} MISSING PAGES` : " | all pages present"}`);
