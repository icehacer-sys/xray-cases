// Builds the INSTANT WELCOME PDF for new Case File Club members — a 5-page members-only file:
// cover -> welcome note -> one exclusive case (fish hook, Q + A) -> closing. gpt-image-2 pages in
// the forensic case-file style, then assembled with a clickable link on the closing page.
// Resumable (skips pages already rendered). Run: npx tsx src/clubwelcome.ts [gen|pdf|all]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { generateSlideImage } from "./openai.js";
import { PDFDocument, PDFPage, PDFName, PDFString, PDFDict } from "pdf-lib";
import sharp from "sharp";

const DIR = "D:/Projects/xray-poster/products/case-file-club/welcome";
const IMG = `${DIR}/images`;
const PAGES = `${DIR}/pages`;
mkdirSync(PAGES, { recursive: true });
const PORTRAIT = "1024x1536";

const STYLE =
  "A premium portrait page styled like a forensic 'case file' / medical HUD. Near-black deep navy " +
  "background with a faint blueprint grid and a very faint ghosted skull watermark. Accent palette: " +
  "electric cyan (#22d3ee) and bold orange (#f59e0b) on dark navy, with white text. TITLES use a BIG " +
  "bold DISTRESSED CONDENSED grunge poster font. Body text is a clean modern sans-serif. A thin cyan " +
  "EKG heartbeat line as a top accent. Keep the SAME template on every page. CRITICAL: render all text " +
  "crisply and CORRECTLY SPELLED exactly as written, no extra or misspelled words.";
const XRAY_CLAUSE =
  " Use the PROVIDED X-ray EXACTLY as given (do not redraw or change its anatomy); place it inside a " +
  "cyan scanner frame with corner brackets and small measurement tick marks.";

const coverPrompt =
  `${STYLE}${XRAY_CLAUSE}\nLAYOUT (welcome cover): top a small orange folder icon with "THE CASE FILE CLUB" ` +
  `in bold orange caps and a thin cyan EKG line. A HUGE distressed white grunge title stacked two lines: ` +
  `"WELCOME TO" / "THE CLUB". Under it a cyan line: "Your first case file. Members only.". Center the ` +
  `provided X-ray inside a cyan HUD frame (corner brackets, tick marks, an "XR-01" tag). At the bottom in ` +
  `bold cyan: "@mdnoteslab". A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const notePrompt =
  `${STYLE}\nLAYOUT (welcome note page): top orange caps "THE CASE FILE CLUB" and a thin cyan EKG line. ` +
  `A big distressed white grunge heading: "YOU ARE IN". Then short white lines each on its own row:\n` +
  `"You just unlocked every case I have ever posted."\n"A new bonus case drops for members every week."\n` +
  `"Start with this one. It is one of my favorites."\nThen a bold cyan line: "Look then guess then flip.". ` +
  `A faint ghosted X-ray skull in the background. A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const qPrompt =
  `${STYLE}${XRAY_CLAUSE}\nLAYOUT (question page): top-left a small orange folder icon with "CLUB CASE 01" in bold ` +
  `orange caps; top-right a thin cyan EKG line. A huge distressed white title: "THE SNAG". Beneath it two short ` +
  `white lines: "Something snagged going down. Then a sharp pain high behind the breastbone that would not ease.". ` +
  `Then the provided X-ray centered in the cyan scanner frame (an "XR-01" tag). Then a bold cyan heading ` +
  `"WHAT IS THE MOST LIKELY DIAGNOSIS". Then three option rows, each an orange circle with the letter then the ` +
  `text in a dark rounded card with a thin cyan edge:\nA  A fish bone stuck in the throat\nB  A fish hook lodged ` +
  `in the esophagus\nC  A swallowed coin\nAt the very bottom an orange rounded banner: "THINK BEFORE YOU FLIP". ` +
  `A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const aPrompt =
  `${STYLE}${XRAY_CLAUSE}\nLAYOUT (answer page): top-left a small cyan ribcage icon with "WEIRD X-RAY CASE FILES"; ` +
  `top-right a cyan "ANSWER" tab. A cyan-bordered rounded box with a check-circle reading "Correct answer: B. Fish ` +
  `hook impaction in the esophagus". Below it a left column of three sections, each a small line icon + bold ` +
  `colored heading + one short line: (1) cyan eye icon, "WHAT YOU ARE SEEING", "A small curved metal hook with its ` +
  `barb caught sideways in the food pipe."; (2) purple DNA icon, "WHY IT MATTERS", "The barb built to hold a fish ` +
  `holds just as well in soft human tissue and will not slide back out."; (3) orange medical-cross icon, ` +
  `"TREATMENT", "It comes out with an endoscope guided down the food pipe so the barb can be freed without ` +
  `tearing tissue.". On the RIGHT the provided X-ray in a cyan scanner frame. ` +
  `A tiny grey footer: "Educational content only. Not medical advice.".`;

const closingPrompt =
  `${STYLE}\nLAYOUT (closing page): top orange caps "THE CASE FILE CLUB" and a thin cyan EKG line. A big distressed ` +
  `white grunge heading stacked two lines: "THIS DROPS" / "EVERY WEEK". Then short white lines:\n` +
  `"A new members-only case every week."\n"The monthly Vault Drop at the end of the month."\n` +
  `"And the Guessing Room where we hang.".\nThen a bold cyan line: "See you inside." and under it in cyan: ` +
  `"club.mednoteslab.com". A tiny grey footer: "Educational entertainment only. Not medical advice.".`;

const jobs: { name: string; prompt: string; xray?: boolean }[] = [
  { name: "cover", prompt: coverPrompt, xray: true },
  { name: "note", prompt: notePrompt },
  { name: "case01-q", prompt: qPrompt, xray: true },
  { name: "case01-a", prompt: aPrompt, xray: true },
  { name: "closing", prompt: closingPrompt },
];

async function gen(): Promise<void> {
  const xray = readFileSync(`${IMG}/case01.png`);
  for (const j of jobs) {
    const out = `${PAGES}/${j.name}.png`;
    if (existsSync(out)) { console.log(`= ${j.name} exists`); continue; }
    try {
      writeFileSync(out, await generateSlideImage(j.prompt, j.xray ? xray : undefined, PORTRAIT));
      console.log(`[+] ${j.name}`);
    } catch (e) { console.log(`! ${j.name} failed: ${e instanceof Error ? e.message : e}`); }
  }
}

function addLink(page: PDFPage, doc: PDFDocument, rect: [number, number, number, number], url: string): void {
  const action = doc.context.obj({ Type: "Action", S: "URI" }) as PDFDict;
  action.set(PDFName.of("URI"), PDFString.of(url));
  const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0] }) as PDFDict;
  annot.set(PDFName.of("A"), action);
  const ref = doc.context.register(annot);
  const ex = page.node.lookup(PDFName.of("Annots"));
  if (ex) (ex as any).push(ref); else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
}

async function pdf(): Promise<void> {
  const order = ["cover", "note", "case01-q", "case01-a", "closing"];
  const W = 432, H = 648, SCALE = W / 1024;
  const doc = await PDFDocument.create();
  let missing = 0;
  for (const name of order) {
    const p = `${PAGES}/${name}.png`;
    if (!existsSync(p)) { console.log(`! MISSING ${name}`); missing++; continue; }
    const jpg = await sharp(readFileSync(p)).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    const img = await doc.embedJpg(jpg);
    const page = doc.addPage([W, H]);
    page.drawImage(img, { x: 0, y: 0, width: W, height: H });
    if (name === "closing") {
      // "club.mednoteslab.com" line, hand-measured on the 1024x1536 closing page (top-down px box)
      const [x1, yT, x2, yB] = [60, 1120, 964, 1175];
      addLink(page, doc, [x1 * SCALE, H - yB * SCALE, x2 * SCALE, H - yT * SCALE], "https://club.mednoteslab.com/");
      console.log("  + link added to closing page");
    }
  }
  doc.setTitle("The Case File Club — Welcome Case File");
  doc.setAuthor("@mdnoteslab");
  const out = `${DIR}/welcome-case-file.pdf`;
  writeFileSync(out, await doc.save());
  console.log(`wrote ${out} | ${doc.getPageCount()} pages${missing ? ` | ${missing} MISSING` : " | all present"}`);
}

const mode = process.argv[2] ?? "all";
if (mode === "gen" || mode === "all") await gen();
if (mode === "pdf" || mode === "all") await pdf();
