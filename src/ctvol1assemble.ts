// Assemble the final Weird CT Case Files: Volume 1 PDF from the gpt-image-2 pages. Order:
// cover, how-it-works, then each case's question + answer page, then the closing page. Each
// 1024x1536 PNG is recompressed to a baseline JPEG (quality 90, 4:4:4) and embedded full-bleed
// on a 6x9in (2:3) page, matching the Weird X-ray Case Files volumes exactly.
// Output: products/ct-volume-1/ct-volume-1.pdf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFPage, PDFName, PDFString, PDFDict } from "pdf-lib";
import sharp from "sharp";

function addLink(page: PDFPage, doc: PDFDocument, rect: [number, number, number, number], url: string): void {
  const action = doc.context.obj({ Type: "Action", S: "URI" }) as PDFDict;
  action.set(PDFName.of("URI"), PDFString.of(url));
  const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0] }) as PDFDict;
  annot.set(PDFName.of("A"), action);
  const ref = doc.context.register(annot);
  const ex = page.node.lookup(PDFName.of("Annots"));
  if (ex) (ex as any).push(ref); else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const pageDir = join(dir, "pages-gpt");

interface Case { n: number }
const cases = (JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as Case[]).sort((a, b) => a.n - b.n);

const order: string[] = ["cover", "howto"];
for (const c of cases) {
  const nn = String(c.n).padStart(2, "0");
  order.push(`case${nn}-q`, `case${nn}-a`);
}
order.push("closing");

const W = 432, H = 648; // 6x9in at 72pt
const SCALE = W / 1024; // source pages are 1024x1536
const pdf = await PDFDocument.create();
let missing = 0, bytesIn = 0, bytesOut = 0;

// Hand-measured (top-down px, in the 1024x1536 source image) link boxes on the closing page.
const CLOSING_LINKS: { box: [number, number, number, number]; url: string }[] = [
  { box: [260, 785, 855, 870], url: "https://gumroad.com/library" }, // "Leave a quick review..."
  // The second card sells the NEXT thing, which differs per volume: Vol 1 recruits the Vol 2
  // waitlist, Vol 2 onward cross-sells Volume 1. Keep this in step with NEXT_CARD in ctvol1extras.ts.
  { box: [135, 1155, 930, 1250], url: CT_VOL === "1" ? "https://ctvol2.mednoteslab.com/" : "https://ctvol1.mednoteslab.com/" },
  { box: [110, 1360, 945, 1405], url: "https://www.threads.net/@mdnoteslab" }, // "Follow @mdnoteslab..."
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
    for (const { box: [x1, yT, x2, yB], url } of CLOSING_LINKS) {
      addLink(page, pdf, [x1 * SCALE, H - yB * SCALE, x2 * SCALE, H - yT * SCALE], url);
    }
    console.log(`  + ${CLOSING_LINKS.length} links added to closing page`);
  }
}

pdf.setTitle("Weird CT Case Files: Volume 1");
pdf.setAuthor("@mdnoteslab");
pdf.setSubject("A guess-the-diagnosis CT scan puzzle book");
pdf.setCreator("@mdnoteslab — Weird CT Case Files");

const out = join(dir, `ct-volume-${CT_VOL}.pdf`);
writeFileSync(out, await pdf.save());
const mb = (n: number) => (n / 1048576).toFixed(1) + "MB";
console.log(`wrote ${out}`);
console.log(`${pdf.getPageCount()} pages | PNG ${mb(bytesIn)} -> JPEG ${mb(bytesOut)}${missing ? ` | ${missing} MISSING PAGES` : " | all pages present"}`);
