// Text generation for each case: the deterministic Threads challenge caption, the
// pinned answer (drafted with Claude when the owner left the breakdown fields blank),
// the Instagram caption (Claude hook + the exact IG layout), the verbatim CTA picker,
// and the ChatGPT X-ray image prompt. The EXACT FORMAT blocks in SPEC.md are reproduced
// here verbatim; only the {fields} vary.

import Anthropic from "@anthropic-ai/sdk";
import { config, requireEnv } from "./config.js";
import type { Case, CtaKey } from "./types.js";

// ---------------------------------------------------------------------------
// Anthropic client (lazy: --prompt mode never needs it)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return _client;
}

/** Run a single non-streaming Claude call and return the concatenated text. */
async function ask(system: string, user: string, maxTokens = 600): Promise<string> {
  const res = await client().messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ---------------------------------------------------------------------------
// Threads challenge caption — DETERMINISTIC
// ---------------------------------------------------------------------------

export function generateThreadsCaption(c: Case): string {
  // The SAME fixed skeleton the audience knows (patient -> X-ray -> hook) plus four durable
  // reach upgrades layered in: a public Case number for collectibility, a guess-difficulty, a
  // layperson secondary question so the non-medical majority can reply too, and a reveal-time
  // nudge that drives "guess now / come back" behaviour. Fields are clamped so the whole caption
  // stays under Threads' 500-char cap even in the worst case.
  const symptom = clamp(c.symptom, 110);
  const hook = clamp(c.hook, 150);

  // Public number reflects the account's true running total (folder numbers are internal + low).
  const caseNo = (c.number ?? 1) + config.caseNumberOffset;
  const d = c.difficulty;
  const diffPart = d && d >= 1 && d <= 5 ? ` Difficulty ${Math.round(d)}/5` : "";

  const lp = c.laypersonQuestion?.trim();

  const blocks = [
    `A patient came in with ${symptom}.`,
    `Then the X-ray loaded 😭`,
    `And ${hook}.`,
    `Case #${caseNo} 🩻${diffPart}`,
  ];
  // The two audience questions EACH get their own block so a blank line sits between them (owner
  // spacing, 2026-07-03). An older/hand-made case with no layperson question falls back to the
  // single classic ask.
  if (lp) blocks.push(`Medics: your diagnosis?`, `Everyone else: ${clamp(lp, 55)}`);
  else blocks.push(`What's the most likely diagnosis?`);
  blocks.push(`Answer in ${config.answerDelayMin} min 👀 no spoilers from me till then`);

  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Engagement fields — one Claude draft producing the difficulty rating, the
// layperson secondary question, and the first-comment seed hint. All NON-spoiling.
// ---------------------------------------------------------------------------

export interface Engagement {
  difficulty: number; // 1-5
  laypersonQuestion: string;
  seedHint: string;
}

export async function draftEngagement(c: Case): Promise<Engagement> {
  const system =
    "You write engagement copy for @mdnoteslab, a daily 'guess the weird X-ray diagnosis' account. " +
    "Voice: punchy, curious, plain-spoken. CRITICAL RULES: do NOT use commas anywhere (write short " +
    "sentences or join clauses with 'and'); a comma is allowed ONLY inside a list of three or more items. " +
    "NEVER name, spell, abbreviate, or give away the diagnosis or its specific category — these run BEFORE " +
    "the answer is revealed. No emojis, no hashtags, no quotation marks, no labels. " +
    "Respond ONLY with a JSON object using exactly these keys: difficulty, laypersonQuestion, seedHint.";

  const user =
    `Diagnosis (NEVER reveal or hint the name): ${c.diagnosis}\n` +
    `Presenting symptom: ${c.symptom}\n` +
    `What the X-ray looks like: ${c.hook}\n\n` +
    `Produce:\n` +
    `- difficulty: an integer 1 to 5 for how hard this is to guess from the X-ray for a mixed medical + lay ` +
    `audience (1 = an obvious foreign object anyone names, 5 = a subtle or obscure finding).\n` +
    `- laypersonQuestion: ONE short question under 55 characters that someone with NO medical knowledge can ` +
    `answer about this image or story (a gut reaction or curiosity, never asking for the diagnosis). End with '?'.\n` +
    `- seedHint: ONE short line under 90 characters to post as the first comment that makes people look closer ` +
    `WITHOUT revealing the answer (point at where or what to notice or pose a simple either/or).`;

  const raw = await ask(system, user, 300);
  const p = parseJsonObject(raw);
  let d = Math.round(Number(p.difficulty));
  if (!Number.isFinite(d) || d < 1) d = 3;
  if (d > 5) d = 5;
  const strip = (s: string) => cleanPunct(s).replace(/^["']+|["']+$/g, "").trim();
  return {
    difficulty: d,
    laypersonQuestion: strip(str(p.laypersonQuestion)),
    seedHint: strip(str(p.seedHint)),
  };
}

/** The author's first-comment seed text (the drafted non-spoiling hint), or null if none. */
export function generateSeedComment(c: Case): string | null {
  const hint = c.seedHint?.trim();
  return hint ? clamp(hint, 120) : null;
}

// ---------------------------------------------------------------------------
// Threads pinned answer — owner fields if present, else one Claude draft
// ---------------------------------------------------------------------------

export async function generateThreadsAnswer(c: Case): Promise<string> {
  let { whatYouSee, whyItMatters, treatment, takeaway } = c;

  // treatment is intentionally blank for non-disease cases (artifacts, normal variants), so a
  // blank one must NOT trigger a re-draft; only re-draft when the descriptive fields are missing.
  if (!whatYouSee || !whyItMatters || !takeaway) {
    const draft = await draftBreakdown(c);
    whatYouSee = whatYouSee ?? draft.whatYouSee;
    whyItMatters = whyItMatters ?? draft.whyItMatters;
    treatment = treatment ?? draft.treatment;
    takeaway = takeaway ?? draft.takeaway;
  }

  // Threads caps each reply at config.answerMaxChars (500) and the answer must be ONE reply (no
  // chains, no truncation). DISPLAY order (owner, 2026-07-03): What you see -> Why it matters ->
  // Treatment (Tx last, with a blank line under its label). The DROP order is decoupled from the
  // display order via `keep`: when the budget is tight the LEAST-important section (Why it matters)
  // is skipped first and the Treatment stays protected (owner: never drop the Tx, 2026-06-19/28) —
  // so Tx renders last but is never the one cut. The full untrimmed 4-section breakdown still lives
  // on the IG answer slide, which has no length limit. Non-disease cases (a motion artifact, a
  // normal variant) have no treatment: the Tx section is omitted entirely (owner, 2026-06-28).
  const head = `Answer: ${c.diagnosis}`;
  const secs = [
    { display: 0, keep: 3, text: `👀 What you see:\n${clamp(whatYouSee, 200)}` },
    { display: 1, keep: 1, text: `🦴 Why it matters:\n${clamp(whyItMatters, 170)}` },
    ...(treatment && treatment.trim()
      ? [{ display: 2, keep: 2, text: `💊 Treatment:\n\n${clamp(treatment, 170)}` }]
      : []),
  ];
  void takeaway; // still drafted (kept for the breakdown) but no longer shown in the reply
  // Select by keep-priority within the 500 budget, then emit in display order.
  const chosen: typeof secs = [];
  let len = head.length;
  for (const s of [...secs].sort((a, b) => b.keep - a.keep)) {
    if (len + 2 + s.text.length > config.answerMaxChars) continue; // skip overflow; a shorter one may still fit
    chosen.push(s);
    len += 2 + s.text.length;
  }
  chosen.sort((a, b) => a.display - b.display);
  return [head, ...chosen.map((s) => s.text)].join("\n\n");
}

/** Normalize AI-drafted punctuation: em/en dashes -> hyphen; collapse runs of spaces. */
export function cleanPunct(s: string): string {
  return s.replace(/\s*[—–]\s*/g, " - ").replace(/[ \t]{2,}/g, " ").trim();
}

/** Trim to <= max chars at a sentence boundary, else a word boundary (never mid-word). */
export function clamp(s: string, max: number): string {
  s = s.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence > max * 0.55) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim().replace(/[.,;:]$/, "");
}

interface Breakdown {
  whatYouSee: string;
  whyItMatters: string;
  treatment: string;
  takeaway: string;
}

async function draftBreakdown(c: Case): Promise<Breakdown> {
  const system =
    "You are a radiologist writing a short, accurate breakdown for a social-media X-ray " +
    "diagnosis challenge. Be tight and factual. Use only well-known, established facts about " +
    "the named condition — never invent specific measurements, patient details, or studies. " +
    "Each field is ONE short line (a sentence or two). No emojis, no labels, no markdown. " +
    "Do NOT use commas: write short sentences or join clauses with words like 'and' or 'with'. " +
    "A comma is allowed ONLY when listing three or more items. " +
    "Respond ONLY with a JSON object using exactly these keys: " +
    "whatYouSee, whyItMatters, treatment, takeaway.";

  const user =
    `Diagnosis: ${c.diagnosis}\n` +
    `Presenting symptom: ${c.symptom}\n` +
    `What the image looks like: ${c.hook}\n\n` +
    `Write the four breakdown lines:\n` +
    `- whatYouSee: the classic radiographic finding(s) a viewer would notice on this X-ray.\n` +
    `- whyItMatters: the clinical significance — why this finding is important.\n` +
    `- treatment: the standard management/treatment approach.\n` +
    `- takeaway: one memorable, plain-language lesson.`;

  const raw = await ask(system, user, 700);
  const parsed = parseJsonObject(raw);

  return {
    whatYouSee: cleanPunct(str(parsed.whatYouSee)),
    whyItMatters: cleanPunct(str(parsed.whyItMatters)),
    treatment: cleanPunct(str(parsed.treatment)),
    takeaway: cleanPunct(str(parsed.takeaway)),
  };
}

// ---------------------------------------------------------------------------
// Instagram caption — Claude hook + exact IG layout
// ---------------------------------------------------------------------------

export async function generateIgCaption(c: Case): Promise<string> {
  const hookLines = (await draftIgHook(c))
    .split("\n")
    .map((l) => cleanPunct(l))
    .filter((l) => l.length > 0);

  // Owner-agreed IG format: a blank line between EVERY line, with a few tasteful emojis for
  // character (one per structural line; the dynamic hook lines and the disclaimer stay clean).
  // Instagram COLLAPSES empty lines, so a plain "\n\n" loses the spacing on IG; we join with a
  // U+2800 (Braille blank) spacer line so the blank line survives. Threads renders it fine too.
  const SPACER = "\n⠀\n";
  return [
    `Case File ${pad2(c.number)} 🩻`,
    ...hookLines,
    `A real condition most people have never seen 🤯`,
    `So before you swipe: A, B, or C? 🤔`,
    `Swipe for the answer then tell me if you got it 👇`,
    `A new weird X-ray case every single day 🗓️`,
    `Follow along and you'll start reading scans like a doctor 🧠`,
    `Want the free 5-case starter pack? 🎁`,
    `Comment SAMPLE and I'll send it your way 📩`,
    `Educational entertainment only. Not medical advice.`,
    `#radiology #xray #spotthediagnosis #medicalmystery #medstudent`,
  ].join(SPACER);
}

async function draftIgHook(c: Case): Promise<string> {
  const system =
    "You write short, punchy Instagram hooks for a daily X-ray diagnosis challenge in the " +
    "voice of @mdnoteslab: curious, a little dramatic, never clickbait-fake. Write 2-3 short " +
    "lines (each its own line). Build intrigue around the case WITHOUT naming the diagnosis. " +
    "Do NOT use commas (except a genuine list) and NO dashes or em dashes: keep each line short or join clauses with 'and'. " +
    "No hashtags, no emojis, no quotation marks, no labels. Just the lines.";

  const user =
    `Diagnosis (do NOT reveal it): ${c.diagnosis}\n` +
    `Presenting symptom: ${c.symptom}\n` +
    `What the X-ray looks like: ${c.hook}\n\n` +
    `Write the 2-3 line hook now.`;

  const hook = await ask(system, user, 200);
  // Collapse any blank lines the model may emit so the IG block spacing stays exact.
  return hook
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

// ---------------------------------------------------------------------------
// CTA picker — verbatim text, rotates by case number when unset
// ---------------------------------------------------------------------------

const CTA_TEXT: Record<CtaKey, string> = {
  // Free lead magnet (email capture at Gumroad $0+ checkout) — the top of the funnel. Weighted
  // heavily in the rotation below: a free pack pulls far more downloads (= emails) than a paid PDF,
  // and the email list is what durably sells the paid collection.
  hopital: [
    `If these weird X-rays keep pulling you in.`,
    `I put 5 of the strangest into a free pack.`,
    `Guess hopital then flip for what each one really is.`,
    `Grab it free.`,
    `hopital.mednoteslab.com`,
  ].join("\n\n"),

  vol2: [
    `If these weird X-rays made you learn something or laugh or question reality for a second.`,
    `I put 20 brand-new cases into a PDF.`,
    `None repeated from Volume 1.`,
    `Support the page if you'd like and I'd appreciate it 🙏`,
    `xray2.mednoteslab.com`,
  ].join("\n\n"),

  rare: [
    `Some of these X-rays are so rare most doctors will never see them in person.`,
    `I collected 10 of the rarest findings in radiology into one PDF.`,
    `Look then guess then flip for a simple breakdown.`,
    `If the weird ones hooked you then these are the next level 🙏`,
    `rare.mednoteslab.com`,
  ].join("\n\n"),

  vol1: [
    `If these weird X-rays have made you learn something or laugh or question reality for a few seconds 😭`,
    `I put 20 of the most bizarre cases into a digital PDF.`,
    `And if you'd like to support the page I'd genuinely appreciate it 🙏`,
    `xray.mednoteslab.com`,
  ].join("\n\n"),

  spotit: [
    `If these weird X-rays keep pulling you in.`,
    `I put 50 of the strangest ones ever into a book.`,
    `Take your guess then flip for the answer and the true story behind each one.`,
    `spot.mednoteslab.com`,
  ].join("\n\n"),

  collection: [
    `If you cannot get enough of these weird X-rays.`,
    `I bundled every collection into one library.`,
    `Volume 1 and Volume 2 and the Rarest Findings and the new Could You Spot It.`,
    `Over a hundred strange real X-rays with all the answers.`,
    `mednoteslab.gumroad.com/l/collection`,
  ].join("\n\n"),
};

// Free pack every other slot (top-of-funnel email capture), the rest rotate the paid products
// (the complete collection first, then the individual sets). ctaReply is off so this only drafts
// a SUGGESTED cta into case.json — the owner posts it manually and can still swap.
const CTA_ROTATION: CtaKey[] = ["hopital", "collection", "hopital", "spotit", "hopital", "rare"];

export function pickCta(c: Case): { key: CtaKey; text: string } {
  if (c.cta) {
    return { key: c.cta, text: CTA_TEXT[c.cta] };
  }
  const n = c.number ?? 1;
  const key = CTA_ROTATION[(n - 1 + CTA_ROTATION.length * 1000) % CTA_ROTATION.length];
  return { key, text: CTA_TEXT[key] };
}

// ---------------------------------------------------------------------------
// ChatGPT X-ray image prompt — pure string assembly (for --prompt)
// ---------------------------------------------------------------------------

export function imagePrompt(c: Case): string {
  const view = "AP chest";
  const keyFindings = c.whatYouSee?.trim()
    ? c.whatYouSee.trim()
    : "the classic radiographic signs of the condition";

  return [
    `Create a realistic, de-identified ${view} X-ray for a medical diagnosis challenge.`,
    ``,
    `Show classic ${c.diagnosis}: ${keyFindings}.`,
    ``,
    `Prioritize clinical realism over symmetry. Make it look like a genuine accessory/abnormal`,
    `finding, not a perfect textbook diagram.`,
    ``,
    `Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.`,
    ``,
    `Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray`,
    `grain, no cinematic glow, no artificial sharpening, no labels, arrows, or annotations.`,
    ``,
    `High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.`,
    `No watermark.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Two-digit zero-padded case number ("Case File 07"). */
function pad2(n?: number): string {
  return String(n ?? 1).padStart(2, "0");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

/** Tolerantly extract the first JSON object from a model response. */
function parseJsonObject(raw: string): Record<string, unknown> {
  const fenced = raw.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  const slice = start !== -1 && end !== -1 ? fenced.slice(start, end + 1) : fenced;
  try {
    const obj = JSON.parse(slice);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Claude breakdown was not valid JSON:\n${raw}`);
  }
}
