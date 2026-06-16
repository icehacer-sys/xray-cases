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
  return [
    `A patient came in with ${c.symptom}.`,
    `Then the X-ray loaded 😭`,
    `And ${c.hook}.`,
    `Quick diagnosis challenge 🩻`,
    `What's the most likely diagnosis?`,
    `Wild guesses are welcome 👀`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Threads pinned answer — owner fields if present, else one Claude draft
// ---------------------------------------------------------------------------

export async function generateThreadsAnswer(c: Case): Promise<string> {
  let { whatYouSee, whyItMatters, treatment, takeaway } = c;

  if (!whatYouSee || !whyItMatters || !treatment || !takeaway) {
    const draft = await draftBreakdown(c);
    whatYouSee = whatYouSee ?? draft.whatYouSee;
    whyItMatters = whyItMatters ?? draft.whyItMatters;
    treatment = treatment ?? draft.treatment;
    takeaway = takeaway ?? draft.takeaway;
  }

  return [
    `Answer: ${c.diagnosis}`,
    `👀 What you see:`,
    whatYouSee,
    `🦴 Why it matters:`,
    whyItMatters,
    `💊 Treatment:`,
    treatment,
    `📝 Takeaway:`,
    takeaway,
  ].join("\n");
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
    whatYouSee: str(parsed.whatYouSee),
    whyItMatters: str(parsed.whyItMatters),
    treatment: str(parsed.treatment),
    takeaway: str(parsed.takeaway),
  };
}

// ---------------------------------------------------------------------------
// Instagram caption — Claude hook + exact IG layout
// ---------------------------------------------------------------------------

export async function generateIgCaption(c: Case): Promise<string> {
  const igHook = await draftIgHook(c);

  return [
    `Case File ${pad2(c.number)}. 🩻`,
    ``,
    igHook,
    ``,
    `A real condition most people have never seen.`,
    ``,
    `So before you swipe: A, B, or C? 👉`,
    ``,
    `Swipe for the answer then tell me if you got it. 👇`,
    ``,
    `New weird X-ray case every single day.`,
    ``,
    `Follow along and you'll read scans like a doctor. 🧠`,
    ``,
    `Want the free 5-case starter pack?`,
    ``,
    `Comment SAMPLE and I'll send it.`,
    ``,
    `Educational entertainment only. Not medical advice.`,
    ``,
    `#radiology #xray #spotthediagnosis #medicalmystery #medstudent`,
  ].join("\n");
}

async function draftIgHook(c: Case): Promise<string> {
  const system =
    "You write short, punchy Instagram hooks for a daily X-ray diagnosis challenge in the " +
    "voice of @mdnoteslab: curious, a little dramatic, never clickbait-fake. Write 2-3 short " +
    "lines (each its own line). Build intrigue around the case WITHOUT naming the diagnosis. " +
    "No hashtags, no emojis, no quotation marks, no labels — just the lines.";

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
  vol2: [
    `If these weird X-rays made you learn something, laugh, or question reality for a second.`,
    `I put 20 brand-new cases into a PDF.`,
    `None repeated from Volume 1.`,
    `Support the page if you'd like, I'd appreciate it 🙏`,
    `xray2.mednoteslab.com`,
  ].join("\n"),

  rare: [
    `Some of these X-rays are so rare most doctors will never see them in person.`,
    `I collected 10 of the rarest findings in radiology into one PDF.`,
    `Look, guess, then flip for a simple breakdown.`,
    `If the weird ones hooked you, these are the next level 🙏`,
    `rare.mednoteslab.com`,
  ].join("\n"),

  vol1: [
    `If these weird X-rays have made you learn something, laugh, or question reality for a few seconds 😭`,
    `I put 20 of the most bizarre cases into a digital PDF.`,
    `And if you'd like to support the page, I'd genuinely appreciate it 🙏`,
    `xray.mednoteslab.com`,
  ].join("\n"),
};

const CTA_ROTATION: CtaKey[] = ["vol2", "rare", "vol1"];

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
    `No watermark. Add a small "AI-generated illustration" tag in a corner.`,
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
