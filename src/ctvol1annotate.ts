// Annotates each Volume 1 CT slice with gpt-image-2 as a LABELLED TEACHING DIAGRAM for Ruth:
// CYAN = normal anatomical landmarks (so a reader with no training knows what they are even
// looking at), ORANGE = the abnormal finding (so it pops out from the normal). The scan itself is
// hard-pinned as an overlay-only edit — verified at ~0.5% of pixels changed, i.e. only the markup.
//
// Landmark lists are hand-specified per case rather than model-chosen: the model is good at PLACING
// a label it has been told to find, and bad at deciding which structures matter. Every output is
// still eyeballed before it ships — a confidently wrong label teaches the wrong thing.
// Output: products/ct-volume-1/annotated/caseNN.png   Run: npx tsx src/ctvol1annotate.ts [n]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSlideImage } from "./openai.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Volume selector: CT_VOL=2 targets products/ct-volume-2. Defaults to 1 so Volume 1 builds
// exactly as before. Env var (not argv) because some of these scripts already take positionals.
const CT_VOL = process.env.CT_VOL ?? "1";
const dir = join(root, "products", `ct-volume-${CT_VOL}`);
const imgDir = join(dir, "images");
const outDir = join(dir, "annotated");
mkdirSync(outDir, { recursive: true });

interface Spec {
  region: string;
  landmarks: string[];   // "LABEL — where it is on the slice"
  finding: string;       // the orange label
  findingWhere: string;  // where to draw the orange ellipse/arrow
}

const SPECS: Record<number, Spec> = {
  1: {
    region: "axial CT chest",
    landmarks: [
      "STERNUM — the small bright bone at the front midline",
      "ASCENDING AORTA — the large round bright vessel in the middle front",
      "DESCENDING AORTA — the smaller round bright vessel just in front of the spine",
      "LUNGS — the large black air-filled areas on both sides",
      "RIB — one of the bright curved bones in the chest wall",
      "VERTEBRA — the bright bone at the back midline",
    ],
    finding: "SADDLE EMBOLUS",
    findingWhere: "the pulmonary artery at the point where it splits into its left and right branches, in the middle of the chest",
  },
  2: {
    region: "axial CT chest",
    landmarks: [
      "STERNUM — the small bright bone at the front midline",
      "LUNGS — the large black air-filled areas on both sides",
      "RIB — one of the bright curved bones in the chest wall",
      "VERTEBRA — the bright bone at the back midline",
      "DESCENDING AORTA — the round bright vessel just in front of the spine",
    ],
    finding: "DISSECTION FLAP",
    findingWhere: "the thin line running across the inside of the large bright ascending aorta in the middle front of the chest, splitting it into two channels",
  },
  3: {
    region: "axial CT head",
    landmarks: [
      "SKULL — the bright white ring of bone around the outside",
      "BRAIN — the large grey tissue filling the middle",
      "VENTRICLE — one of the dark butterfly-shaped fluid spaces in the centre of the brain",
      "MIDLINE — the thin line running front to back down the centre of the brain",
    ],
    finding: "SUBDURAL BLOOD",
    findingWhere: "the crescent-shaped brighter collection hugging the inner curve of the skull along one side, pushing the brain inward",
  },
  4: {
    region: "axial CT abdomen",
    landmarks: [
      "ABDOMINAL WALL — the outer rim of muscle and fat around the body",
      "VERTEBRA — the bright bone at the back midline",
      "BOWEL — one of the loops of intestine",
      "MESENTERIC FAT — the darker grey fatty tissue between the bowel loops",
    ],
    finding: "WHIRL SIGN",
    findingWhere: "the tight spiral swirl of twisted bowel and vessels in the middle of the abdomen",
  },
  5: {
    region: "axial CT abdomen",
    landmarks: [
      "LIVER — the large uniform grey organ filling the right side of the slice (appears on the LEFT of the image)",
      "VERTEBRA — the bright bone at the back midline",
      "STOMACH — the structure containing dark air and grey fluid on the left side of the body (appears on the RIGHT of the image)",
      "ABDOMINAL WALL — the outer rim of muscle and fat",
    ],
    finding: "FREE AIR",
    findingWhere: "the black crescent of air trapped between the front of the liver and the inside of the abdominal wall, where air should never be",
  },
  6: {
    region: "axial CT head",
    landmarks: [
      "SKULL — the bright white ring of bone around the outside",
      "BRAIN — the large grey tissue filling the middle",
      "VENTRICLE — one of the dark fluid spaces in the centre of the brain",
      "MIDLINE — the thin line running front to back down the centre of the brain",
    ],
    finding: "EPIDURAL BLOOD",
    findingWhere: "the lens-shaped or lemon-shaped brighter collection pressed against the inner skull on one side, bulging inward",
  },
  7: {
    region: "axial CT abdomen",
    landmarks: [
      "VERTEBRA — the bright bone at the back midline",
      "ABDOMINAL WALL — the outer rim of muscle and fat",
      "BOWEL — one of the loops of intestine",
      "SPINAL MUSCLES — the paired grey muscles either side of the spine at the back",
    ],
    finding: "ANEURYSM",
    findingWhere: "the very enlarged rounded aorta just in front of the spine, ballooned far wider than a normal vessel",
  },
  8: {
    region: "axial CT abdomen",
    landmarks: [
      "ABDOMINAL WALL — the outer rim of muscle and fat",
      "VERTEBRA — the bright bone at the back midline",
      "AORTA — the small round bright vessel just in front of the spine",
      "MESENTERIC FAT — the darker grey fatty tissue between the bowel loops",
    ],
    finding: "DILATED BOWEL",
    findingWhere: "the many hugely swollen fluid-filled loops of small bowel that fill most of the abdomen, each far wider than a normal bowel loop — outline several of the largest swollen loops, NOT the fat or vessels",
  },
  9: {
    // Abdomen, NOT a limb. The source slice is clearly an abdominal CT (spine, kidneys, bowel all
    // visible) even though the case story originally said "limb" — story fixed in cases.json, and
    // these landmarks now match what is actually on the image ("BONE" became "VERTEBRA").
    region: "axial CT abdomen",
    landmarks: [
      "SKIN — the thin bright outer edge of the body",
      "FAT — the darker grey layer just under the skin",
      "MUSCLE — the grey muscle of the abdominal wall",
      "VERTEBRA — the bright bone at the back midline",
      "KIDNEY — one of the paired grey bean-shaped organs either side of the spine",
    ],
    finding: "GAS IN TISSUE",
    findingWhere: "the black bubbles and streaks of gas tracking through the soft tissue layers of the abdominal wall, where there should be no air at all",
  },
  10: {
    region: "axial CT chest, lung window",
    landmarks: [
      "LUNGS — the black air-filled areas on both sides",
      "VERTEBRA — the bright bone at the back midline",
      "RIB — one of the bright curved bones in the chest wall",
      "AIRWAY — the small dark round tube near the middle of the chest",
    ],
    finding: "METASTASES",
    findingWhere: "several of the many round well-defined solid masses scattered through both lungs — outline two or three of the clearest round masses",
  },
};


// Volume 2 anatomy + findings. SPECS above is Volume 1 ONLY and is keyed by case number, so
// running this against another volume silently paints Volume 1's labels onto Volume 2's slices
// (it labelled the intussusception "DISSECTION FLAP" on 2026-08-18). Every entry below was
// written after looking at the actual generated slice in products/ct-volume-2/images.
const SPECS_V2: Record<number, Spec> = {
  1: {
    region: "axial CT upper abdomen",
    landmarks: [
      "LIVER — the large smooth grey organ filling one whole side of the abdomen",
      "STOMACH — the rounded structure containing dark gas near the front",
      "AORTA — the round bright vessel lying just in front of the spine",
      "VERTEBRA — the bright bone at the back midline",
      "RIB — one of the bright curved bones in the abdominal wall",
    ],
    finding: "PORTAL VENOUS GAS",
    findingWhere: "the dark branching lines of gas spreading through the liver all the way out to its outer edge — outline two or three of the clearest branching areas closest to the liver surface, NOT the centre of the liver",
  },
  2: {
    region: "axial CT abdomen",
    landmarks: [
      "BOWEL LOOPS — the rounded tubes scattered through the abdomen",
      "MESENTERIC FAT — the darker grey tissue between the bowel loops",
      "VERTEBRA — the bright bone at the back midline",
      "ABDOMINAL WALL MUSCLE — the grey muscle band running around the outside",
    ],
    finding: "TARGET SIGN",
    findingWhere: "the round structure built of concentric rings one inside another sitting in the right abdomen which appears on the left of the image",
  },
  3: {
    region: "axial CT abdomen",
    landmarks: [
      "LIVER — the large smooth grey organ on one side of the upper abdomen",
      "VERTEBRA — the bright bone at the back midline",
      "KIDNEY — the bean shaped organ beside the spine",
      "ABDOMINAL WALL MUSCLE — the grey muscle band around the outside",
    ],
    finding: "GALLSTONE ILEUS",
    findingWhere: "three separate things — the fine branching gas in the bile ducts in the CENTRE of the liver, several hugely swollen small bowel loops, and the bright ring shaped stone lying inside a bowel loop away from the liver. Outline all three",
  },
  4: {
    region: "axial CT abdomen",
    landmarks: [
      "LIVER — the large smooth grey organ on one side of the upper abdomen",
      "KIDNEYS — the two bean shaped organs either side of the spine which light up brightly",
      "AORTA — the round bright vessel just in front of the spine",
      "VERTEBRA — the bright bone at the back midline",
    ],
    finding: "NON-ENHANCING PANCREAS",
    findingWhere: "the dark patchy pancreas lying across the middle of the upper abdomen in front of the spine which stays dark while the kidneys beside it light up brightly",
  },
  5: {
    region: "axial CT chest",
    landmarks: [
      "STERNUM — the small bright bone at the front midline",
      "LUNGS — the large black air filled areas on both sides",
      "HEART — the large soft tissue structure in the middle of the chest",
      "DESCENDING AORTA — the round bright vessel just in front of the spine",
      "VERTEBRA — the bright bone at the back midline",
    ],
    finding: "MEDIASTINAL GAS",
    findingWhere: "the black streaks and bubbles of gas tracking through the soft tissue around the great vessels in the centre of the chest where there should be no air at all",
  },
  6: {
    region: "axial CT head",
    landmarks: [
      "SKULL — the bright white ring of bone around the outside",
      "BRAIN — the grey tissue filling the skull",
      "ORBIT — the eye socket at the front",
      "MIDBRAIN — the central structure at the base of the brain",
    ],
    finding: "SUBARACHNOID BLOOD",
    findingWhere: "the bright white blood filling the star shaped spaces at the base of the brain in the centre of the image where the fluid should be dark",
  },
  7: {
    region: "axial CT upper abdomen",
    landmarks: [
      "LIVER — the large smooth grey organ on one side",
      "SPLEEN — the organ on the opposite side to the liver",
      "AORTA — the round bright vessel just in front of the spine",
      "VERTEBRA — the bright bone at the back midline",
      "STOMACH — the structure containing gas near the front",
    ],
    finding: "SPLENIC LACERATION",
    findingWhere: "the dark irregular split running through the spleen together with the darker rim of blood collected around the outside of it",
  },
  8: {
    region: "axial CT abdomen",
    landmarks: [
      "KIDNEYS — the two bean shaped organs either side of the spine",
      "VERTEBRA — the bright bone at the back midline",
      "BOWEL LOOPS — the rounded tubes across the front of the abdomen",
      "PSOAS MUSCLE — the rounded muscle either side of the vertebra",
    ],
    finding: "URETERIC STONE",
    findingWhere: "the tiny brilliant white dot lying just beside the vertebra which is the stone sitting in the ureter, and also outline the swollen dark collecting system inside the kidney above it",
  },
  9: {
    region: "axial CT lower abdomen",
    landmarks: [
      "ILIAC BONE — the bright curved bones of the pelvis on both sides",
      "SACRUM — the bright bone at the back midline",
      "BOWEL LOOPS — the rounded tubes through the middle",
      "ABDOMINAL WALL MUSCLE — the grey muscle band around the outside",
    ],
    finding: "APPENDICOLITH",
    findingWhere: "the small bright white stone low on the right side which appears on the left of the image, together with the dark bubbles of free gas sitting beside it",
  },
  10: {
    region: "axial CT head",
    landmarks: [
      "SKULL — the bright white ring of bone around the outside",
      "BRAIN — the grey tissue filling the skull",
      "FALX — the thin bright line running down the middle between the halves",
      "VENTRICLE — the darker fluid space deep in the brain",
    ],
    finding: "EMPTY DELTA SIGN",
    findingWhere: "the structure at the back midline which has a bright enhancing rim around a dark centre because the vein inside it is filled with clot",
  },
};

// Pick the map for the volume being built.
const ACTIVE_SPECS: Record<number, Spec> = CT_VOL === "2" ? SPECS_V2 : SPECS;

function prompt(n: number, s: Spec): string {
  const lm = s.landmarks.map((l) => `- ${l}`).join("\n");
  return (
    `Use the PROVIDED ${s.region} slice EXACTLY as given. Do NOT redraw, restyle, re-render, or change ` +
    `ANY anatomy, greyscale value, or detail of the scan itself. It must stay pixel-identical. Your ONLY ` +
    `job is to draw a clean annotation overlay ON TOP, like a labelled teaching diagram made for someone ` +
    `who has never read a CT scan before.\n\n` +
    `STEP 1 — label these NORMAL landmarks in CYAN (#38bdf8). For each: a THIN cyan leader line from the ` +
    `structure out to a SMALL bold cyan all-caps label placed in the empty black space outside the body:\n${lm}\n\n` +
    `STEP 2 — mark the ABNORMALITY in ORANGE (#f59e0b) so it stands out clearly from the cyan: a thin ` +
    `orange ellipse around ${s.findingWhere}, a short orange arrow pointing at it, and a bold orange ` +
    `all-caps label "${s.finding}".\n\n` +
    `Keep every line thin and every label small so the underlying anatomy stays fully visible. Place labels ` +
    `in the black space around the body so they never cover anatomy. Spell every label EXACTLY as written. ` +
    `Add nothing else — no extra text, no title, no watermark, no border.`
  );
}

const only = process.argv[2] ? Number(process.argv[2]) : null;
for (const [k, s] of Object.entries(ACTIVE_SPECS)) {
  const n = Number(k);
  if (only && n !== only) continue;
  const src = join(imgDir, `case${String(n).padStart(2, "0")}.png`);
  const out = join(outDir, `case${String(n).padStart(2, "0")}.png`);
  if (!existsSync(src)) { console.log(`! case ${n}: source missing`); continue; }
  process.stdout.write(`label case ${n} (${s.finding}) ... `);
  try {
    writeFileSync(out, await generateSlideImage(prompt(n, s), readFileSync(src), "1024x1024"));
    console.log("ok");
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
