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
import { renderSlides } from "./slides.js";
import type { Case, Condition } from "./types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Cli {
  count: number;
  mock: boolean;
  topup: boolean;
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  let count = 1;
  let mock = false;
  let topup = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--mock") mock = true;
    else if (a === "--topup") topup = true;
    else if (a === "--count") {
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

  return { count, mock, topup };
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
// (captions.imagePrompt-style), including the "AI-generated illustration" tag.
// ---------------------------------------------------------------------------

function xrayPrompt(cond: Condition): string {
  return [
    `Create a realistic, de-identified ${cond.view} X-ray for a medical diagnosis challenge.`,
    ``,
    `Show classic ${cond.diagnosis}: ${cond.keyFindings}.`,
    ``,
    `Prioritize clinical realism over symmetry. Make it look like a genuine abnormal finding,`,
    `not a perfect textbook diagram.`,
    ``,
    `Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.`,
    ``,
    `Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray`,
    `grain, no cinematic glow, no artificial sharpening, no labels, arrows, or annotations.`,
    ``,
    `High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.`,
    `No watermark. Add a small "AI-generated illustration" tag in a corner.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pre-draft captions (mirror index.ts ensureGenerated): caption/answer/ig/cta.
// ---------------------------------------------------------------------------

async function predraftCaptions(c: Case): Promise<void> {
  const threadsCaption = generateThreadsCaption(c);
  const threadsAnswer = await generateThreadsAnswer(c);
  const igCaption = await generateIgCaption(c);
  const ctaText = pickCta(c).text;
  c.generated = { threadsCaption, threadsAnswer, igCaption, ctaText };
}

// ---------------------------------------------------------------------------
// Build a Case from a Condition (the four breakdown fields carry over verbatim
// so captions/slides use the owner-vetted facts).
// ---------------------------------------------------------------------------

function buildCase(cond: Condition, folder: string, number: number, postAt: Date): Case {
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
    igSlides: ["question.png", "answer.png", "cta.png"],
    postAt: postAt.toISOString(),
    approved: false,
    source: "generated",
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
): Promise<GenResult> {
  const folder = `${pad5(number)}-${slug(cond.diagnosis)}`;
  const dir = join(projectRoot, config.casesDir, folder);
  mkdirSync(dir, { recursive: true });

  // 1. X-ray (the ONLY AI-generated image; slides are rendered).
  const xrayPng = mock ? placeholderXray() : await generateXray(xrayPrompt(cond));
  writeFileSync(join(dir, "xray.png"), xrayPng);

  // 2. Assemble the Case, then render the 3 IG slides from the deterministic template.
  const c = buildCase(cond, folder, number, postAt);
  const slides = renderSlides(c, cond, xrayPng);
  writeFileSync(join(dir, "question.png"), slides.question);
  writeFileSync(join(dir, "answer.png"), slides.answer);
  writeFileSync(join(dir, "cta.png"), slides.cta);

  // 3. Pre-draft captions, then persist the case (approved:false, source:"generated").
  await predraftCaptions(c);
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
    // Pick the first condition that is neither already burned (pool flag) nor a
    // diagnosis we've ever posted (history). Guarantees no case is ever repeated.
    const cond = conditions.find(
      (c) => c.used !== true && !isUsedDiagnosis(used, c.diagnosis, c.aliases ?? []),
    );
    if (!cond) {
      log(`no fresh conditions left after ${results.length} case(s); add new ones to ${config.conditionsFile}.`);
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

    const result = await generateOne(cond, number, postAt, cli.mock);
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
