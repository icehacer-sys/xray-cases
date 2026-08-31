// Builds the Case File Club "Member Archive" PDF — a plain, text-laid-out compilation of
// every case in the local pipeline (cases/*/case.json), one page per case: X-ray + the 4-part
// breakdown (What you see / Why it matters / Treatment / Takeaway). Deliberately NOT styled
// like the premium gpt-image-2 poster PDFs (Could You Spot It, Volumes, etc.) — this is a
// plain reference document so it doesn't cannibalize those paid products. Grows as the
// pipeline posts more cases; just rerun to rebuild with whatever is on disk today.
// Run: npx tsx src/memberarchive.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadCases } from "./cases.js";

const OUT_DIR = "D:/Projects/xray-poster/products/case-file-club";
const CASES_DIR = "D:/Projects/xray-poster/cases";
const BACKFILL_DIR = `${OUT_DIR}/backfill`;
mkdirSync(OUT_DIR, { recursive: true });

// Common shape both the local pipeline cases and the Threads-backfilled history convert to,
// so buildCasePage doesn't need to know which source a case came from.
interface ArchiveEntry {
  diagnosis: string;
  imgPath: string;
  whatYouSee: string;
  whyItMatters: string;
  treatment: string;
  takeaway: string;
  postedAt: string;
}

interface BackfillEntry {
  diagnosis: string;
  whatYouSee: string;
  whyItMatters: string;
  treatment: string;
  takeaway: string;
  postedAt: string;
  imageFile: string;
}

const W = 432;
const H = 648;
const MARGIN = 32;

const NAVY = rgb(0.043, 0.071, 0.126);
const CYAN = rgb(0.02, 0.55, 0.65);
const ORANGE = rgb(0.8, 0.45, 0.02);
const BLACK = rgb(0.12, 0.12, 0.14);
const GREY = rgb(0.45, 0.45, 0.48);
const WHITE = rgb(1, 1, 1);

// Backfilled text comes from real Threads captions (emoji, curly quotes, etc.) which the
// PDF's StandardFonts (WinAnsi encoding) cannot render — strip anything outside that range
// rather than letting embedFont/widthOfTextAtSize throw mid-build.
function sanitize(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}️]/gu, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x00-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSection(
  page: PDFPage,
  label: string,
  body: string,
  y: number,
  bold: PDFFont,
  regular: PDFFont,
  accent: ReturnType<typeof rgb>,
): number {
  // Backfilled (Threads-sourced) cases never have a Treatment section — the posted answer reply
  // format never included one — so skip drawing an empty label rather than showing a heading
  // with nothing under it.
  if (!body.trim()) return y;
  const maxWidth = W - MARGIN * 2;
  page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: accent });
  let cursor = y - 13;
  for (const line of wrapText(body, regular, 9, maxWidth)) {
    page.drawText(line, { x: MARGIN, y: cursor, size: 9, font: regular, color: BLACK });
    cursor -= 12;
  }
  return cursor - 8;
}

async function buildCoverPage(doc: PDFDocument, bold: PDFFont, regular: PDFFont, count: number): Promise<void> {
  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: NAVY });
  page.drawText("THE CASE FILE CLUB", { x: MARGIN, y: H - 90, size: 12, font: bold, color: ORANGE });
  page.drawText("MEMBER ARCHIVE", { x: MARGIN, y: H - 130, size: 26, font: bold, color: WHITE });
  page.drawText(`${count} cases and counting.`, { x: MARGIN, y: H - 170, size: 11, font: regular, color: CYAN });
  page.drawText("A new one joins every week.", { x: MARGIN, y: H - 186, size: 11, font: regular, color: CYAN });
  page.drawText("@mdnoteslab", { x: MARGIN, y: 60, size: 12, font: bold, color: CYAN });
  page.drawText("Educational entertainment only. Not medical advice.", {
    x: MARGIN,
    y: 40,
    size: 8,
    font: regular,
    color: rgb(0.6, 0.6, 0.65),
  });
}

async function buildCasePage(
  doc: PDFDocument,
  bold: PDFFont,
  regular: PDFFont,
  num: number,
  diagnosis: string,
  imgPath: string,
  whatYouSee: string,
  whyItMatters: string,
  treatment: string,
  takeaway: string,
): Promise<void> {
  const page = doc.addPage([W, H]);
  page.drawText(`CASE FILE ${String(num).padStart(2, "0")}`, {
    x: MARGIN,
    y: H - 40,
    size: 9,
    font: bold,
    color: ORANGE,
  });
  page.drawText(diagnosis, { x: MARGIN, y: H - 58, size: 15, font: bold, color: BLACK });

  // Kept deliberately small (not full-bleed like the premium volumes) — the 4-section
  // breakdown needs the vertical room; the longest case (16 wrapped lines) only fits
  // once the image stops eating most of the page.
  const imgSize = 190;
  const y = H - 72 - imgSize;
  if (existsSync(imgPath)) {
    const jpg = await sharp(readFileSync(imgPath)).resize(600, 600).jpeg({ quality: 85 }).toBuffer();
    const img = await doc.embedJpg(jpg);
    page.drawImage(img, { x: (W - imgSize) / 2, y, width: imgSize, height: imgSize });
  }

  let cursor = y - 20;
  cursor = drawSection(page, "WHAT YOU SEE", whatYouSee, cursor, bold, regular, CYAN);
  cursor = drawSection(page, "WHY IT MATTERS", whyItMatters, cursor, bold, regular, ORANGE);
  cursor = drawSection(page, "TREATMENT", treatment, cursor, bold, regular, CYAN);
  cursor = drawSection(page, "TAKEAWAY", takeaway, cursor, bold, regular, ORANGE);

  page.drawText("Educational entertainment only. Not medical advice.", {
    x: MARGIN,
    y: 20,
    size: 7,
    font: regular,
    color: GREY,
  });
}

async function main(): Promise<void> {
  const localCases = loadCases().filter((c) => c.stages?.challengePostedAt); // only cases actually posted
  const local: ArchiveEntry[] = localCases.map((c) => ({
    diagnosis: sanitize(c.diagnosis),
    imgPath: join(CASES_DIR, c.folder, c.threadsImage),
    whatYouSee: sanitize(c.whatYouSee ?? ""),
    whyItMatters: sanitize(c.whyItMatters ?? ""),
    treatment: sanitize(c.treatment ?? ""),
    takeaway: sanitize(c.takeaway ?? ""),
    postedAt: c.postAt,
  }));

  const backfillFile = join(BACKFILL_DIR, "backfill.json");
  const backfilled: ArchiveEntry[] = existsSync(backfillFile)
    ? (JSON.parse(readFileSync(backfillFile, "utf8")) as BackfillEntry[]).map((b) => ({
        diagnosis: sanitize(b.diagnosis),
        imgPath: join(BACKFILL_DIR, b.imageFile),
        whatYouSee: sanitize(b.whatYouSee),
        whyItMatters: sanitize(b.whyItMatters),
        treatment: sanitize(b.treatment),
        takeaway: sanitize(b.takeaway),
        postedAt: b.postedAt,
      }))
    : [];
  if (backfilled.length > 0) console.log(`+ ${backfilled.length} cases from the Threads history backfill`);

  const cases = [...local, ...backfilled].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  if (cases.length === 0) {
    console.log("No posted cases found — nothing to build.");
    return;
  }

  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  doc.setTitle("The Case File Club — Member Archive");
  doc.setAuthor("@mdnoteslab");

  await buildCoverPage(doc, bold, regular, cases.length);

  // Display number is this archive's own sequential position (chronological, by postedAt) — not
  // any per-source id, so the local pipeline's folder numbers and the backfill's post ids never
  // collide or leak a duplicate "CASE FILE N" into the PDF.
  for (const [i, c] of cases.entries()) {
    await buildCasePage(doc, bold, regular, i + 1, c.diagnosis, c.imgPath, c.whatYouSee, c.whyItMatters, c.treatment, c.takeaway);
    console.log(`+ case ${i + 1}: ${c.diagnosis}`);
  }

  const out = `${OUT_DIR}/member-archive.pdf`;
  writeFileSync(out, await doc.save());
  console.log(`\nwrote ${out} | ${cases.length} cases (${local.length} local + ${backfilled.length} backfilled) | ${doc.getPageCount()} pages`);
}

await main();
