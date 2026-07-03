// Auto-generator orchestrator + CLI for xray-case-poster (phase 2; see SPEC-GEN.md).
//
// Picks the next vetted condition from config.conditionsFile, AI-generates ONLY the
// X-ray (OpenAI, or a gray placeholder under --mock), RENDERS the 3 IG slides from a
// deterministic template, assembles a Case queued as `approved:false source:"generated"`,
// pre-drafts its captions, and marks the condition `used`. A reviewer flips approved:true
// (or BOT_AUTO_APPROVE=on) before the publisher (index.ts) will post it.
//
// CLI:
//   --count N   how many cases to generate (default 1)
//   --mock      skip the OpenAI call; write a placeholder gray PNG so the pipeline +
//               slides can be exercised with no API key
//   --topup     generate until pending+approved UNPOSTED cases reach config.queueTarget
//               (no-ops when the queue is already full); overrides --count

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { config } from "./config.js";
import { loadCases, saveCase, loadUsedDiagnoses, isUsedDiagnosis } from "./cases.js";
import { State } from "./state.js";
import {
  generateThreadsCaption,
  generateThreadsAnswer,
  generateIgCaption,
  pickCta,
} from "./captions.js";
import { generateXray } from "./openai.js";
import { generateSlides } from "./slidegen.js";
import { verifyXray, type XrayVerdict } from "./verify.js";
import { censorUntilClean } from "./censor.js";
import type { Case, Condition } from "./types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Cli {
  count: number;
  mock: boolean;
  topup: boolean;
  diagnosis?: string;
  threadsOnly: boolean;
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  let count = 1;
  let mock = false;
  let topup = false;
  let diagnosis: string | undefined;
  let threadsOnly = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--mock") mock = true;
    else if (a === "--topup") topup = true;
    else if (a === "--threads-only") threadsOnly = true;
    else if (a === "--diagnosis") {
      diagnosis = args[++i];
      if (!diagnosis) throw new Error("--diagnosis expects a value, e.g. --diagnosis \"Proteus syndrome\".");
    } else if (a.startsWith("--diagnosis=")) {
      diagnosis = a.slice("--diagnosis=".length);
    } else if (a === "--count") {
      const n = Number(args[++i]);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--count expects a positive integer, got "${args[i]}".`);
      }
      count = Math.floor(n);
    } else if (a.startsWith("--count=")) {
      const n = Number(a.slice("--count=".length));
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--count expects a positive integer, got "${a}".`);
      }
      count = Math.floor(n);
    } else {
      throw new Error(`Unknown argument "${a}". Usage: generate [--count N] [--mock] [--topup]`);
    }
  }

  return { count, mock, topup, diagnosis, threadsOnly };
}

function log(...parts: unknown[]): void {
  console.log(...parts);
}

// ---------------------------------------------------------------------------
// Conditions pool (config.conditionsFile, resolved against the project root)
// ---------------------------------------------------------------------------

function conditionsPath(): string {
  return join(projectRoot, config.conditionsFile);
}

function loadConditions(): Condition[] {
  const file = conditionsPath();
  if (!existsSync(file)) {
    throw new Error(
      `Conditions pool not found at ${file}. Create ${config.conditionsFile} (a JSON array of Condition).`,
    );
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${config.conditionsFile} must be a JSON array of Condition.`);
  }
  parsed.forEach((c, i) => validateCondition(c, i));
  return parsed as Condition[];
}

/**
 * Fail fast (defense-in-depth) on a malformed pool entry so a hand-edited condition
 * never silently produces a broken case/slide. The owner-vetted pool should already
 * be clean; this just names the offending entry if it is not.
 */
function validateCondition(c: unknown, index: number): void {
  const where = `${config.conditionsFile}[${index}]`;
  if (typeof c !== "object" || c === null) {
    throw new Error(`${where} is not an object.`);
  }
  const cond = c as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  const label = isStr(cond.diagnosis) ? cond.diagnosis : where;
  const requiredStrings = [
    "diagnosis",
    "symptom",
    "hook",
    "view",
    "keyFindings",
    "whatYouSee",
    "whyItMatters",
    "treatment",
    "takeaway",
    "igTitle",
  ];
  for (const field of requiredStrings) {
    if (!isStr(cond[field])) {
      throw new Error(`Condition "${label}" (${where}): "${field}" must be a non-empty string.`);
    }
  }
  if (
    !Array.isArray(cond.igOptions) ||
    cond.igOptions.length !== 3 ||
    !cond.igOptions.every((o) => isStr(o))
  ) {
    throw new Error(`Condition "${label}" (${where}): "igOptions" must be an array of 3 non-empty strings.`);
  }
  if (cond.igCorrect !== "A" && cond.igCorrect !== "B" && cond.igCorrect !== "C") {
    throw new Error(`Condition "${label}" (${where}): "igCorrect" must be one of "A", "B", "C".`);
  }
}

function saveConditions(conds: Condition[]): void {
  writeFileSync(conditionsPath(), JSON.stringify(conds, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Numbering / scheduling / slugs
// ---------------------------------------------------------------------------

/** "Maffucci Syndrome (Type II)" -> "maffucci-syndrome-type-ii". */
function slug(s: string): string {
  // NFKD splits accented letters into base + combining mark; the [^a-z0-9] filter
  // below then drops the marks, so "Köhler" -> "kohler" without a separate strip pass.
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "case"
  );
}

/** Zero-padded 5-digit folder prefix, e.g. 7 -> "00007". */
function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

/**
 * Schedule the next case: the day AFTER `latestPostAt` at config.postHourUtc.
 * With no existing queue, schedule tomorrow at that hour. Mutates a Date copy only.
 */
function nextPostAt(latestPostAt: Date | undefined): Date {
  const base =
    latestPostAt && !Number.isNaN(latestPostAt.getTime()) ? latestPostAt : new Date();
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, config.postHourUtc, 0, 0, 0),
  );
  return d;
}

// ---------------------------------------------------------------------------
// Placeholder X-ray (--mock): a flat gray PNG at config.imageSize, no API key needed.
// Rendered with @resvg/resvg-js (already a dep) so --mock pulls in no extra packages.
// ---------------------------------------------------------------------------

function placeholderXray(): Buffer {
  const px = Number.parseInt(String(config.imageSize).split("x")[0], 10) || 1024;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">`,
    `<rect width="${px}" height="${px}" fill="#6b7280"/>`,
    `<text x="50%" y="50%" fill="#e5e7eb" font-family="sans-serif" font-size="${Math.round(px / 22)}" ` +
      `text-anchor="middle" dominant-baseline="middle">MOCK X-RAY</text>`,
    `</svg>`,
  ].join("");
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: px } }).render().asPng());
}

// ---------------------------------------------------------------------------
// X-ray image prompt — assembled from the Condition's view + keyFindings
// (captions.imagePrompt-style).
// ---------------------------------------------------------------------------

function xrayPrompt(cond: Condition, avoid: string[] = []): string {
  const view = cond.view.toLowerCase();
  // Region-specific realism blocks: gpt-image-2's two failure modes are dental arches and
  // overlapping paired bones, so give the view-appropriate anatomy constraint explicitly.
  const region: string[] = [];
  if (/panoram|jaw|mandible|dental|teeth|tooth|odont/.test(view)) {
    region.push(
      `TEETH: render a SINGLE continuous dental arch per jaw — every tooth seated in the alveolar bone along`,
      `one smooth curve, with NO floating, tilted-into-space, duplicated, fused, or extra teeth beyond the`,
      `stated pathology. Use ONE age-appropriate dentition (a normal adult set OR a normal child set, never a`,
      `chaotic mix). Upper and lower arches mirror-consistent in tooth count and spacing. Every tooth except`,
      `the described lesion is normal and correctly positioned.`,
    );
  }
  if (/forearm|radius|ulna|\bleg\b|tibia|fibula/.test(view)) {
    region.push(`Two parallel long bones (radius and ulna, or tibia and fibula) separated by an interosseous space — never a single fused bone.`);
  }
  if (/hand|foot|digit|toe|finger/.test(view)) {
    region.push(`Five digits with the correct phalanx count (thumb/big toe two, the others three); do not add, drop, merge, or detach a digit.`);
  }
  if (/chest|thorax|lung/.test(view)) {
    region.push(`Lung markings are fine BRANCHING vessels tapering to the periphery, not uniform speckled static; symmetric ribcage, one heart shadow, one hemidiaphragm per side.`);
  }
  const lines = [
    `Create a realistic, de-identified ${cond.view} X-ray for a medical diagnosis challenge.`,
    ``,
    `Show classic ${cond.diagnosis}: ${cond.keyFindings}.`,
    ``,
    `Render exactly ONE primary abnormality — the finding above. Everything else on the film is`,
    `unremarkable, normal anatomy. Do not scatter extra lesions, densities, or incidental abnormalities.`,
    ``,
    `ANATOMY MUST BE CORRECT. Render a real human body with the NORMAL number of bones and organs.`,
    `Do NOT duplicate, mirror, or add any extra bone, organ, or structure. Exactly one of each paired`,
    `structure (one scapula and one clavicle per side, the normal count of ribs, fingers, and vertebrae)`,
    `unless the pathology itself only changes a structure's position, shape, or density. Represent the`,
    `pathology as a change to a SINGLE structure, never as an added duplicate. No melted, smeared, doubled,`,
    `or garbled bone.`,
    ``,
    `The PATHOLOGY may be irregular or asymmetric — that is expected. But every NON-pathological paired`,
    `structure (both forearm bones, both sides of the jaw and dental arch, the ribs, the orbits) must stay`,
    `bilaterally consistent, correctly counted, and cleanly superimposed where structures overlap. Make it`,
    `look like a genuine abnormal finding, not a perfect textbook diagram.`,
    ...(region.length ? ["", ...region] : []),
    ``,
    `Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.`,
    ``,
    `Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray`,
    `grain, no cinematic glow, no artificial sharpening, no labels, arrows, or annotations.`,
    ``,
    `High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.`,
    `No watermark.`,
    ``,
    `Avoid these AI artifacts: duplicated or mirrored bones, a floating bone or tooth detached from the`,
    `skeleton, merged or melted cortical bone, teeth outside the arch, an extra scapula/clavicle/rib, the`,
    `wrong number of fingers or toes, a single fused forearm bone, and uniform stippled noise standing in for`,
    `real tissue texture.`,
  ];
  if (avoid.length) {
    lines.push(``, `Avoid these specific errors from a previous attempt: ${avoid.slice(0, 4).join("; ")}.`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Pre-draft captions (mirror index.ts ensureGenerated): caption/answer/ig/cta.
// ---------------------------------------------------------------------------

async function predraftCaptions(c: Case, threadsOnly = false): Promise<void> {
  const threadsCaption = generateThreadsCaption(c);
  const threadsAnswer = await generateThreadsAnswer(c);
  const igCaption = threadsOnly ? "" : await generateIgCaption(c);
  const ctaText = pickCta(c).text;
  c.generated = { threadsCaption, threadsAnswer, igCaption, ctaText };
}

// ---------------------------------------------------------------------------
// Build a Case from a Condition (the four breakdown fields carry over verbatim
// so captions/slides use the owner-vetted facts).
// ---------------------------------------------------------------------------

function buildCase(cond: Condition, folder: string, number: number, postAt: Date, threadsOnly = false): Case {
  const igOptions = cond.igOptions.map(
    (opt, i) => `${"ABC"[i]}. ${opt}`,
  );
  return {
    folder,
    number,
    diagnosis: cond.diagnosis,
    aliases: cond.aliases,
    symptom: cond.symptom,
    hook: cond.hook,
    whatYouSee: cond.whatYouSee,
    whyItMatters: cond.whyItMatters,
    treatment: cond.treatment,
    takeaway: cond.takeaway,
    igOptions,
    threadsImage: "xray.png",
    igSlides: threadsOnly ? [] : ["question.png", "answer.png", "cta.png"],
    postAt: postAt.toISOString(),
    approved: false,
    source: "generated",
    condition: cond, // kept so `npm run render` can rebuild slides after a manual X-ray swap
  };
}

// ---------------------------------------------------------------------------
// Generate one case
// ---------------------------------------------------------------------------

interface GenResult {
  diagnosis: string;
  folder: string;
  postAt: string;
}

async function generateOne(
  cond: Condition,
  number: number,
  postAt: Date,
  mock: boolean,
  threadsOnly: boolean,
): Promise<GenResult> {
  const folder = `${pad5(number)}-${slug(cond.diagnosis)}`;
  const dir = join(projectRoot, config.casesDir, folder);
  mkdirSync(dir, { recursive: true });

  // 1. X-ray (gpt-image-2) behind the anatomy-QA gate. Regenerate on a critical AI artifact
  //    (duplicated/extra bones, wrong body part, melted bone) up to xrayMaxAttempts, feeding
  //    the detected defects back into the prompt to steer away from them. A persistent failure
  //    is queued with needsReview so the publisher never auto-posts a defective image.
  let xrayPng = mock ? placeholderXray() : await generateXray(xrayPrompt(cond));
  let verdict: XrayVerdict | undefined;
  if (!mock && config.xrayVerify) {
    const avoid: string[] = [];
    for (let attempt = 1; attempt <= config.xrayMaxAttempts; attempt++) {
      verdict = await verifyXray(xrayPng, cond);
      if (verdict.ok) {
        if (attempt > 1) log(`    X-ray QA passed on attempt ${attempt}.`);
        break;
      }
      log(`    ⚠ X-ray QA rejected (attempt ${attempt}/${config.xrayMaxAttempts}, ${verdict.severity}): ${verdict.defects.join(" | ")}`);
      avoid.push(...verdict.defects);
      if (attempt < config.xrayMaxAttempts) xrayPng = await generateXray(xrayPrompt(cond, avoid));
    }
  }
  // Blur external genitalia (if any) so Threads/IG do not flag the post as sensitive/adult.
  // Multi-pass because box placement is imprecise on faint X-ray genitalia; if any remain
  // after the passes the case is held for manual review so exposed genitalia can NEVER auto-post.
  let xrayHadGenitals = false;
  let genitalExposed = false;
  let censorFailed = false;
  if (!mock && config.censorGenitals) {
    const r = await censorUntilClean(xrayPng);
    xrayPng = r.png;
    xrayHadGenitals = r.blurred || r.stillExposed;
    genitalExposed = r.stillExposed;
    censorFailed = r.detectionFailed;
    if (r.blurred) log(`    🔒 blurred genital region on the X-ray`);
  }
  writeFileSync(join(dir, "xray.png"), xrayPng);

  // 2. Assemble the Case. If the X-ray failed anatomy QA, flag needsReview and SKIP slides.
  const c = buildCase(cond, folder, number, postAt, threadsOnly);
  const failed = !!(verdict && !verdict.ok);
  if (failed) {
    c.needsReview = true;
    c.verifyDefects = verdict!.defects;
    log(`    ⛔ ${cond.diagnosis} failed X-ray QA after ${config.xrayMaxAttempts} attempts — queued with needsReview (will NOT auto-post); slides skipped.`);
  } else {
    // 3 IG slides with gpt-image-2 (X-ray composited via image-edit). The composite can
    // RESTORE genital detail, so when the X-ray had genitalia, blur the two slides that embed
    // it directly (multi-pass). The CTA slide has no X-ray.
    if (!threadsOnly) {
      const slides = await generateSlides(c, cond, xrayPng);
      if (config.censorGenitals && xrayHadGenitals) {
        const q = await censorUntilClean(slides.question);
        const a = await censorUntilClean(slides.answer);
        slides.question = q.png;
        slides.answer = a.png;
        if (q.stillExposed || a.stillExposed) genitalExposed = true;
      }
      writeFileSync(join(dir, "question.png"), slides.question);
      writeFileSync(join(dir, "answer.png"), slides.answer);
      writeFileSync(join(dir, "cta.png"), slides.cta);
    }

    // Safety: ANY case where genitalia were detected is HELD for manual review. Auto-blur
    // placement on faint X-ray genitalia is unreliable (it can land on the wrong spot), so a
    // human verifies/tightens the blur with `regencase <folder> grid <file>` then
    // `regencase <folder> blurbox <file> x y w h`, and clears needsReview before it can post.
    // Detection that ERRORED (API hiccup) on a groin-relevant view cannot confirm the image is
    // clean, so hold it for review rather than fail-open into a possibly-uncensored post.
    const censorUnverified = censorFailed && /pelvi|hip|abdom|lower|groin|femur|leg|thigh/i.test(cond.view);
    if (xrayHadGenitals || genitalExposed || censorUnverified) {
      c.needsReview = true;
      c.verifyDefects = [
        genitalExposed
          ? "genitalia still visible after auto-censor — blur manually (regencase grid + blurbox) then clear needsReview"
          : censorUnverified
            ? "genital-censor detection errored on a groin-relevant view — verify no genitalia are exposed (regencase grid) then clear needsReview"
            : "genitalia detected and auto-blurred — verify the blur is tight + correctly placed (regencase grid + blurbox) then clear needsReview",
      ];
      log(`    ⛔ ${cond.diagnosis}: ${censorUnverified && !xrayHadGenitals ? "genital-censor could not verify (detection errored)" : "genitalia detected"} — queued with needsReview.`);
    }
  }

  // 3. Pre-draft captions, then persist the case (approved:false, source:"generated").
  await predraftCaptions(c, threadsOnly);
  saveCase(c);

  return { diagnosis: cond.diagnosis, folder, postAt: c.postAt };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Cases that are queued and not yet posted (no challenge stage recorded). */
function unpostedCount(state: State): number {
  return loadCases().filter((c) => !state.getStages(c.folder).challengePostedAt).length;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv);
  const state = new State();
  const conditions = loadConditions();
  // Diagnoses already posted (seeded with the account's history) — never repeat one.
  const used = loadUsedDiagnoses();

  // How many to generate this run.
  let target = cli.count;
  if (cli.topup) {
    const queued = unpostedCount(state);
    target = Math.max(0, config.queueTarget - queued);
    log(`topup: ${queued}/${config.queueTarget} unposted queued — generating ${target}.`);
    if (target === 0) {
      log("queue is full; nothing to generate.");
      return;
    }
  }

  const results: GenResult[] = [];

  for (let i = 0; i < target; i++) {
    // Pick the condition to generate. With --diagnosis, target that exact one (deliberate
    // selection of a strong/shocking case, bypassing array order and the skipPublic flag — but
    // never a diagnosis we've already produced). Otherwise pick the first condition that is
    // neither already burned (pool flag) nor a diagnosis we've ever posted (history).
    const cond = cli.diagnosis
      ? conditions.find(
          (c) =>
            c.diagnosis.toLowerCase() === cli.diagnosis!.toLowerCase() &&
            c.used !== true &&
            !isUsedDiagnosis(used, c.diagnosis, c.aliases ?? []),
        )
      : conditions.find(
          (c) => c.used !== true && c.skipPublic !== true && !isUsedDiagnosis(used, c.diagnosis, c.aliases ?? []),
        );
    if (!cond) {
      log(
        cli.diagnosis
          ? `--diagnosis "${cli.diagnosis}" not found in ${config.conditionsFile} (or already used).`
          : `no fresh conditions left after ${results.length} case(s); add new ones to ${config.conditionsFile}.`,
      );
      break;
    }

    // Re-load the queue each iteration so the new case feeds the next number + postAt.
    const cases = loadCases();
    const maxNumber = cases.reduce((m, c) => Math.max(m, c.number ?? 0), 0);
    const number = maxNumber + 1;
    const latest = cases.reduce<Date | undefined>((latestSoFar, c) => {
      const d = new Date(c.postAt);
      if (Number.isNaN(d.getTime())) return latestSoFar; // skip a corrupted postAt
      return latestSoFar == null || d.getTime() > latestSoFar.getTime() ? d : latestSoFar;
    }, undefined);
    const postAt = nextPostAt(latest);

    // Burn the condition BEFORE the expensive image+slide work and persist it, so a
    // crash never reuses it. This fails safe: if generateOne throws mid-way, the
    // condition stays used (we skip it) rather than producing a duplicate case later.
    cond.used = true;
    saveConditions(conditions);

    const result = await generateOne(cond, number, postAt, cli.mock, cli.threadsOnly);
    results.push(result);

    log(`generated #${number} ${result.diagnosis} -> cases/${result.folder} (postAt ${result.postAt})`);
  }

  // Summary.
  log(`\nGenerated ${results.length} case(s):`);
  for (const r of results) {
    log(`  - ${r.diagnosis}  ->  cases/${r.folder}  @ ${r.postAt}`);
  }
  if (results.length > 0) {
    log(`\nReview each case.json, then set approved:true (or run the publisher with BOT_AUTO_APPROVE=on).`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
