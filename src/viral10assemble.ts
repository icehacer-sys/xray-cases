// Assemble the final "Weird X-Ray Case Files: The Viral 10" PDF from the gpt-image-2 pages.
// Order: cover, how-it-works, then each case's question + answer page (1..10), then closing.
// Each 1024x1536 PNG is recompressed to a baseline JPEG (quality 90, 4:4:4 to keep the
// cyan/orange text edges crisp) and embedded full-bleed on a 6x9in (2:3) page.
// Output: products/viral-10/viral-10.pdf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFPage, PDFName, PDFString, PDFDict } from "pdf-lib";
import sharp from "sharp";

// The pages are flattened gpt-image-2 renders, not real text — a URL drawn on the image is NOT
// clickable on its own. pdf-lib has no high-level "addLink" helper, so build the Link annotation
// dict by hand and attach it to the page's /Annots array. Rect is in PDF points (origin bottom-left).
// IMPORTANT: context.obj() converts a bare JS string to a PDFName, not a PDFString — that is fine
// for Type/Subtype/S keys but INVALID for /URI (the PDF spec requires a string there, not a name).
// A PDFName URI silently fails to open as a link in real viewers, so URI must be wrapped explicitly.
function addLink(page: PDFPage, pdfDoc: PDFDocument, rect: [number, number, number, number], url: string): void {
  const action = pdfDoc.context.obj({ Type: "Action", S: "URI" }) as PDFDict;
  action.set(PDFName.of("URI"), PDFString.of(url));
  const annot = pdfDoc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0] }) as PDFDict;
  annot.set(PDFName.of("A"), action);
  const ref = pdfDoc.context.register(annot);
  const existing = page.node.lookup(PDFName.of("Annots"));
  if (existing) (existing as any).push(ref);
  else page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([ref]));
}

// Convert an image-pixel box (top-down origin, from eyeballing the 1024x1536 closing.png) to a PDF
// point rect (bottom-left origin) at the page's actual embed scale. imgY1 = box TOP edge (smaller),
// imgY2 = box BOTTOM edge (larger) in image space.
function imgBoxToPdfRect(
  imgX1: number, imgY1: number, imgX2: number, imgY2: number,
  scale: number, pageH: number,
): [number, number, number, number] {
  return [imgX1 * scale, pageH - imgY2 * scale, imgX2 * scale, pageH - imgY1 * scale];
}

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
const SCALE = W / 1024; // == H/1536, uniform (no distortion)
const pdf = await PDFDocument.create();
let missing = 0, bytesIn = 0, bytesOut = 0;

// Clickable zones on the CLOSING page only, in 1024x1536 IMAGE-PIXEL coordinates (top-down),
// hand-measured against pages-gpt/closing.png. [x1, yTop, x2, yBottom] per line of link text.
const CLOSING_LINKS: { box: [number, number, number, number]; url: string }[] = [
  { box: [60, 815, 964, 865], url: "https://www.threads.com/@mdnoteslab" }, // "Follow @mdnoteslab"
  { box: [60, 995, 964, 1035], url: "https://xray.mednoteslab.com/" }, // "xray.mednoteslab.com"
  { box: [60, 1060, 964, 1100], url: "https://spot.mednoteslab.com/" }, // "spot.mednoteslab.com"
  { box: [60, 1125, 964, 1165], url: "https://mednoteslab.gumroad.com/l/collection" }, // "mednoteslab.gumroad.com/l/collection"
];

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
  if (name === "closing") {
    for (const { box, url } of CLOSING_LINKS) {
      const rect = imgBoxToPdfRect(box[0], box[1], box[2], box[3], SCALE, H);
      addLink(page, pdf, rect, url);
    }
    console.log(`  + ${CLOSING_LINKS.length} clickable links added to the closing page`);
  }
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
