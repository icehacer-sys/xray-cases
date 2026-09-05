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
  // The ORIGINAL fixed format the audience knows — only the symptom + hook vary (owner reverted the
  // Case#/difficulty/layperson/reveal-line experiment on 2026-07-04 after those posts underperformed).
  // Cap symptom+hook so the caption stays well under Threads' 500-char limit.
  const symptom = clamp(c.symptom, 130);
  const hook = clamp(c.hook, 190);
  return [
    `A patient came in with ${symptom}.`,
    `Then the X-ray loaded 😭`,
    `And ${hook}.`,
    `What's the most likely diagnosis? 🩻`,
    `Wild guesses are welcome`,
  ].join("\n\n");
}

/**
 * RETIRED from the caption on 2026-09-05 (owner: redundant once the 🩻 moved to the question,
 * which already says the same thing). Kept ONLY as a strip-token: captions cached in case.json
 * before that date still carry the line, and without this a stale case would post seven lines.
 * "Wild guesses are welcome" stays -- the audit found the non-medical audience needs the
 * low-cost entry point it provides.
 */
export const CHALLENGE_LABEL_LINE = "Quick diagnosis challenge";

/** The follow ask. One short line, house style (no commas), emoji-terminated like its neighbours. */
export const FOLLOW_CTA_LINE = "Follow for a new case every night 🔔";

/**
 * SWAP the redundant challenge label for the follow ask when the B arm is active.
 *
 * This originally APPENDED a seventh line. Owner rejected that: the caption is a tight six-line
 * shape the audience knows, and bolting an extra line on the end read long and salesy. Swapping
 * holds the shape and the length (+8 chars net) and puts the ask last, where a CTA belongs.
 *
 * Applied at POST time, never at generation time. `generated.threadsCaption` is drafted days
 * ahead and cached in case.json, so gating it inside generateThreadsCaption() would label the
 * night a case was DRAFTED rather than the night it publishes, and the arms would be noise.
 *
 * The ~5.3M non-follower viewers only ever see the caption -- most never open the thread -- so
 * this is the only surface where a follow ask reaches the people the experiment is about.
 *
 * Falls back to the untouched caption if the swap would overflow: losing the hook to fit a CTA
 * costs far more than one night of the experiment.
 */
export function withFollowCta(caption: string): string {
  if (!config.followCta) return caption;
  // Prefix match, not equality: a caption cached in case.json before the 2026-09-05 emoji move
  // still reads "Quick diagnosis challenge 🩻". An exact match would silently fail to find it and
  // leave a SEVEN-line caption with the follow line bolted on -- the exact shape the owner
  // rejected. Matching the prefix means a future emoji tweak cannot resurrect that bug either.
  const lines = caption.split("\n\n").filter((l) => !l.trim().startsWith(CHALLENGE_LABEL_LINE));
  lines.push(FOLLOW_CTA_LINE);
  const out = lines.join("\n\n");
  return out.length > config.captionMaxChars ? caption : out;
}

/**
 * HOOK-FRAMING experiment (built 2026-09-05, dormant until the answer-delay experiment ends).
 *
 * Rewrites the opening symptom line to FOREGROUND the tension the case already contains, and
 * returns the full alternative caption — or "" when the case genuinely has no tension to surface.
 * An empty result is a legitimate outcome, not a failure: analyse intent-to-treat and record how
 * many B nights actually got a foregrounded line.
 *
 * Why this shape. The audit's original "specific beats vague" reading did not survive testing
 * (Spearman rho -0.10 on symptom length; "hip pain" is the best over-performer). What survived is
 * narrower and weak — setups stating an explicit contradiction run median 1.23 vs 0.99, AUC 0.631,
 * permutation p = 0.084 at n=11. And a contradiction is a PROPERTY OF THE CASE, not an assignable
 * treatment: you cannot add "the bullet was nowhere near the entry point" to a case where that is
 * not the finding. So the randomisable variable is foreground-vs-plain WORDING of a tension the
 * case genuinely has — same medicine, different emphasis.
 *
 * Adds NO new clinical facts. This is a medical account: an invented symptom is a far worse
 * outcome than a lost experiment night, so the prompt forbids anything not already in
 * symptom + hook, and every failure path falls back to the plain caption.
 */
export async function draftForegroundedCaption(c: Case): Promise<string> {
  const system =
    "You rewrite ONE line of a caption for @mdnoteslab, a daily 'guess the weird X-ray diagnosis' account. " +
    "You are given a patient's presenting symptom and a description of what the X-ray showed. Rewrite the " +
    "SYMPTOM line so how ORDINARY the presentation was becomes explicit — routine or painless or easily " +
    "dismissed or barely worth a visit. " +
    "ABSOLUTE RULES: (1) Describe ONLY what the patient presented with. NEVER describe, hint at, or allude to " +
    "anything visible on the X-ray. The X-ray description is given to you ONLY so you know what the " +
    "presentation is quietly contrasting with — the reader sees it in the NEXT line and stating it here " +
    "destroys the entire guess. (2) Invent NOTHING. Use only facts already in the presenting symptom. Never " +
    "add a new sign, duration, age, or measurement. (3) NEVER name, spell, abbreviate or hint at the diagnosis " +
    "or its category. (4) Do NOT use commas (write short clauses or join with 'and'). (5) It must read " +
    "naturally after 'A patient came in with '. (6) Under 120 characters. (7) If the presentation is ALREADY " +
    "obviously strange, or there is nothing ordinary about it to lean on, return null rather than forcing one. " +
    "Respond ONLY with a JSON object: {\"foregrounded\": string or null}";

  const user =
    `Diagnosis (NEVER reveal or hint): ${c.diagnosis}\n` +
    `Presenting symptom: ${c.symptom}\n` +
    `What the X-ray showed: ${c.hook}`;

  try {
    const p = parseJsonObject(await ask(system, user, 250));
    const raw = p.foregrounded;
    if (raw == null || typeof raw !== "string" || raw.trim() === "" || raw.trim().toLowerCase() === "null") return "";
    const alt = cleanPunct(str(raw)).replace(/^["']+|["']+$/g, "").replace(/\.\s*$/, "").trim();
    // A model that leaked the diagnosis, or ignored the no-commas rule, is not trusted for this
    // line at all — fall back rather than post it.
    if (!alt || alt.length > 130 || alt.includes(",")) return "";
    if (new RegExp(`\\b${c.diagnosis.split(/\s+/)[0].replace(/[^a-z]/gi, "")}`, "i").test(alt)) return "";
    // REVEAL-LEAK GUARD. The first draft of this prompt produced "a surgically placed hearing
    // device and nothing more - yet something was coiling deep inside the inner ear like a watch
    // spring" — the X-ray finding, moved into the line that runs BEFORE "Then the X-ray loaded".
    // That destroys the guess, so trust the prompt for phrasing but never for this: any word the
    // HOOK uses that the original symptom does not is reveal-specific and must not appear.
    const symWords = new Set(c.symptom.toLowerCase().match(/[a-z]{5,}/g) ?? []);
    const lower = alt.toLowerCase();
    const leaked = (c.hook.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !symWords.has(w) && lower.includes(w));
    if (leaked.length > 0) return "";
    const out = generateThreadsCaption({ ...c, symptom: alt });
    // A model that echoed the symptom back unchanged (seen on 00142) yields a B night textually
    // IDENTICAL to A -- silent non-compliance that would count as a treated night and dilute the
    // estimate toward zero. Treat it as "no variant" so the analysis can see it.
    return out === generateThreadsCaption(c) ? "" : out;
  } catch {
    return ""; // never let a drafting failure block a publish
  }
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
  // Treatment (Tx last, body on the very next line — no blank line under its label). The DROP order is decoupled from the
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
      ? [{ display: 2, keep: 2, text: `💊 Treatment:\n${clamp(treatment, 170)}` }]
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

// The LAST line of each CTA is the bare domain — the CTA stage derives the full https:// URL from
// it for the Threads link_attachment (preview card). The arrow line + link sit on adjacent lines
// (single \n) so the 👇🏼 points straight at the link; everything else is blank-line separated.
const CTA_TEXT: Record<CtaKey, string> = {
  // Free lead magnet (email capture at Gumroad $0+ checkout) — the top of the funnel. Weighted
  // heavily in the rotation below: a free pack pulls far more downloads (= emails) than a paid PDF,
  // and the email list is what durably sells the paid collection.
  hopital: `If these weird X-rays keep pulling you in.

I put 5 of the strangest into a free pack.

Guess hopital then flip for what each one really is.

Grab it free 👇🏼
free.mednoteslab.com`,

  collection: `If you cannot get enough of these weird X-rays.

I bundled every collection into one library.

✅ Volume 1

✅ Volume 2

✅ Volume 3

✅ The Rarest Findings

✅ Hopital Field Edition

✅ Could You Spot It?

Over 140 strange real X-rays with all the answers.
mednoteslab.gumroad.com/l/collection`,

  spotit: `If these weird X-rays keep pulling you in.

I put 50 of the strangest ones ever into a book.

Take your guess then flip for the answer and the true story behind each one.

Grab it here 👇🏼
spot.mednoteslab.com`,

  rare: `Some of these X-rays are so rare most doctors will never see them in person.

I collected 10 of the rarest findings in radiology into one PDF.

Look then guess then flip for a simple breakdown.

If the weird ones hooked you then these are the next level 👇🏼
rare.mednoteslab.com`,

  vol1: `If these weird X-rays have made you learn something or laugh or question reality for a few seconds 😭

I put 20 of the most bizarre cases into one PDF.

Look then guess then flip for a simple breakdown of each.

Grab it here 👇🏼
xray.mednoteslab.com`,

  vol2: `If the weird ones keep pulling you in.

I put 20 brand-new cases into a second PDF.

None repeated from Volume 1.

Grab it here 👇🏼
xray2.mednoteslab.com`,

  vol3: `If you have been through Volume 1 and 2 and still want more.

I put 20 fresh cases into Volume 3.

All new and none repeated from the first two.

Grab it here 👇🏼
xray3.mednoteslab.com`,

  field: `If the hopital meme lives in your head rent free.

I put the wildest cases into the Hopital Field Edition.

Guess hopital then flip for the real diagnosis every time.

Grab it here 👇🏼
hopital.mednoteslab.com`,

  anxiety: `If you have ever been told it is just anxiety.

I turned medical gaslighting into a card game.

Real conditions waved off as nothing until the card flips to the diagnosis.

Grab it here 👇🏼
anxiety.mednoteslab.com`,

  viral10: `These are the 10 cases that broke the internet.

Combined they crossed 20 million views right here on Threads.

I bundled the 10 highest viewed guesses into one pack.

Look then guess then flip for the answer and the story behind it.

Grab it here 👇🏼
viral.mednoteslab.com`,

  ctvol1: `If you like guessing what is wrong on an X-ray wait until you see it on a CT scan.

I put 10 real CT cases into Weird CT Case Files: Volume 1.

Look then guess then flip for the breakdown.

Grab it here 👇🏼
ctvol1.mednoteslab.com`,
};

// 13-slot rotation covering EVERY product. Free pack (hopital) is still the most frequent slot
// (top-of-funnel email capture) but never back-to-back; the collection appears twice; each paid
// product gets one slot. Assigned by case number in pickCta below. Owner can pin a specific CTA
// per case via c.cta, or reorder this list.
// Pruned to PRODUCTS THAT HAVE ACTUALLY SOLD (all-time Gumroad, owner, 2026-09-05). Five keys
// were dropped for zero lifetime sales despite carrying slots for months: spotit, rare, vol3,
// field, viral10. They were consuming 5 of 14 nights -- over a third of the rotation -- pitching
// products with no demonstrated demand to the account's highest-traffic surface.
//
// Slots are now weighted by sales, hopital still most frequent (free lead magnet, 29 downloads,
// top-of-funnel email capture) and never back-to-back including across the wrap:
//   hopital 29 sales -> 3 | anxiety 7 -> 2 | vol1 7 -> 2 | collection 5 -> 2 | ctvol1 1 -> 1 | vol2 1 -> 1
//
// The dropped keys are intentionally KEPT in CtaKey and CTA_TEXT: several already-posted cases
// pin them via c.cta, and removing them would break those. They simply no longer rotate. Restore
// one by adding its key back here.
//
// NOT in the rotation and worth a look: "Support the Lab" has 3 sales / $128.26 -- the second
// highest revenue of anything on the store -- but no CtaKey or CTA_TEXT entry exists for it.
const CTA_ROTATION: CtaKey[] = [
  "hopital", "collection", "anxiety",
  "hopital", "vol1", "ctvol1",
  "hopital", "anxiety", "collection",
  "vol1", "vol2",
];

export function pickCta(c: Case, seq?: number): { key: CtaKey; text: string } {
  if (c.cta) {
    return { key: c.cta, text: CTA_TEXT[c.cta] };
  }
  // Rotate by POSTING ORDER when the caller can supply it (`seq` = how many cases have
  // already published). Keying the rotation off c.number instead makes it effectively
  // arbitrary, because cases publish far out of numeric order: any two case numbers that
  // differ by the rotation length land the SAME CTA, which is how n=35 and n=49 both drew
  // vol2 two days apart (2026-07-18 and 07-20). Falls back to the case number when no
  // sequence is available (one-off scripts, backfills).
  const idx = seq ?? (c.number ?? 1) - 1;
  const len = CTA_ROTATION.length;
  const key = CTA_ROTATION[((idx % len) + len) % len];
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
