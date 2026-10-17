// Caption-to-facts consistency (reply audit 2026-10-17).
//
// The reply bot only knows what the case facts say: whatYouSee, whyItMatters, treatment and the
// clueFacts below (threads-bot src/xray.ts). Case 00199 (traumatic pneumocephalus) opened with "a
// headache and a runny nose that would not dry up" but no fact mentioned the nose or CSF, so the
// bot improvised "the leak let the air in" on about 11 replies and said "the case doesn't say" on 3.
// A clinician also objected that the answer said "traumatic" while the caption gave no injury.
//
// Two deterministic rules, checked at generation (hold) and before a challenge publishes:
//   1. Every clinical clue in the public story (caption symptom and teaser) is backed by a fact
//      sentence the bot reads. Some telltale clues also need their mechanism in that sentence.
//   2. A history qualifier in the answer label (traumatic, congenital, post-surgical, acute,
//      chronic...) has a matching hint in the public story and is backed by the facts.
//
// `clueFacts` is its own field: contentHash() does not cover it, so facts can be added to a queued
// case without touching its reviewed caption or image approvals. New reviews bind it separately
// (contentReview.clueFactsSha256). This is a lint, not a clinical parser. It cannot prove a fact is
// true, only that a clue is not left without one.

import { createHash } from "node:crypto";
import type { Case, ClueFact } from "./types.js";
import { serialCommaProblems } from "./copy-style.js";

type StoryCase = Pick<Case, "diagnosis" | "symptom" | "captionSymptom" | "teaser" | "whatYouSee" | "whyItMatters" | "treatment" | "clueFacts">;

const story = (c: Pick<Case, "symptom" | "captionSymptom">) => c.captionSymptom?.trim() || c.symptom || "";

/** Fact text the reply bot reads, as sentences. The takeaway is excluded on purpose: the bot does not read it. */
export function factSentences(c: Pick<Case, "whatYouSee" | "whyItMatters" | "treatment" | "clueFacts">): string[] {
  return [c.whatYouSee, c.whyItMatters, c.treatment, ...(c.clueFacts ?? []).map((f) => f.fact)]
    .filter((s): s is string => !!s?.trim())
    .flatMap((s) => s.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export const clueFactsHash = (facts: ClueFact[] | undefined) => createHash("sha256").update(JSON.stringify(facts ?? [])).digest("hex");

// --- clue extraction ------------------------------------------------------------------------

// Words that carry no clinical clue on their own.
const STOP = new Set((
  "a an the and or of in on at to by for from into over under up down out off that this these those which who whose " +
  "it its they them their there he him his she her hers you your we our i my me one ones side sides both left right " +
  "new old older young very really quite so too just only still even ever never always again more most less least much " +
  "many lot lots bit little some any all every each would could should will can may might must not no nor did does do " +
  "doing done was were is are be been being had has have having got get gets getting kept keep keeps keeping made make " +
  "makes feel feels felt feeling seem seems seemed look looks looked looking lately recently suddenly slowly gradually " +
  "now later soon then once twice day days week weeks month months year years hour hours time times first second last few " +
  "several hard worse better bigger smaller larger wrong strange odd weird something nothing anything thing things way " +
  "patient person people anyone everyone someone nobody what when where why how like as than because while about around " +
  "through across between behind beside without within until since put two three four five six seven eight nine ten " +
  "whole tiny huge big small long short slight mild"
).split(" "));

// Story phrases that only narrate who dismissed the symptom. They are suspense, not clinical clues.
const DISMISSAL = /\b(?:that\s+(?:\w+\s+){0,2})?(?:blamed on|put down to|brushed off as|chalked up to|written off as|mistaken for|dismissed as)\b.*?(?=\s+and\s+|$)/g;
const IDIOMS: [RegExp, string][] = [
  [/\bcomes and goes\b|\bon and off\b|\boff and on\b|\bcame and went\b/g, "intermittent"],
  [/\bshort of breath\b|\bout of breath\b/g, "breathless"],
];

/** The clue phrases of a public symptom line. */
export function cluePhrases(symptom: string): string[] {
  let s = symptom.toLowerCase().replace(/[‘’]/g, "'");
  for (const [re, to] of IDIOMS) s = s.replace(re, to);
  s = s.replace(DISMISSAL, " ");
  return s.split(/\s*(?:[,;]|\band\b|\bwith\b|\bplus\b|\bafter\b|\bthen\b|\bbut\b)\s*/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => contentWords(p).length > 0);
}

const SUFFIXES = ["ingly", "edly", "ness", "ings", "ful", "ing", "ers", "ies", "ied", "er", "es", "ed", "ly", "s", "y", "e"];
function stem(w: string): string {
  w = w.toLowerCase().replace(/'s$/, "");
  for (const suf of SUFFIXES) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  return w;
}
function contentWords(phrase: string): string[] {
  return (phrase.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).map((w) => w.replace(/'s$/, "")).filter((w) => w.length >= 3 && !STOP.has(w));
}
const sameStem = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

// Plain-language clue -> how the facts usually phrase it. Only widens a match, never narrows one.
const CONCEPTS: { story: RegExp; fact: RegExp }[] = [
  { story: /\b(?:runny|dripping|drippy|streaming) nose\b|\bnose (?:that )?(?:runs|drips)\b|\bclear fluid\b/, fact: /rhinorrh|otorrh|nasal|\bnose\b|cerebrospinal|\bcsf\b/i },
  { story: /\bheadaches?\b/, fact: /headache|head pain|intracranial pressure/i },
  { story: /\bback\b|\bbackache\b/, fact: /\bback\b|lumbar|spin(?:e|al)|vertebr/i },
  { story: /\b(?:tummy|belly|stomach)\b|\babdom/, fact: /abdom|belly|stomach|tummy|epigastr|bowel/i },
  { story: /\bchest\b/, fact: /chest|thora|angina/i },
  { story: /\bbreathless|\bpuffed\b|\bwinded\b|\bstairs\b/, fact: /breath|dyspn|exertion/i },
  { story: /\bloose stools?\b|\bdiarrh|\bthe runs\b/, fact: /diarrh|stool|bowel/i },
  { story: /\bburps?\b|\bbelch/, fact: /burp|belch|eructat/i },
  { story: /\blooser\b|\bweight\b|\bclothes\b|\bjeans\b|\bbelt\b/, fact: /weight|cachex|wasting/i },
  { story: /\bupsetting\b|\bstress|\bgrief\b|\bbereave|\bheartbreak|\bargument\b|\bshock\b/, fact: /stress|emotion|grief|bereave/i },
  { story: /\bswell|\bswollen\b|\blump\b|\bbulge\b|\bpuffs? up\b|\bpuffed up\b/, fact: /swell|swollen|mass|lump|bulg|enlarg|\bsac\b|dilat/i },
  { story: /\bfevers?\b|\btemperature\b|\bsweats?\b/, fact: /fever|pyrex|febrile|sweat/i },
  { story: /\bthroat\b|\bswallow/, fact: /throat|swallow|dysphag/i },
  { story: /\bintermittent\b/, fact: /colic|intermittent|episod|recurr|comes and goes|on and off/i },
  { story: /\bfull\b|\bfullness\b|\bbloat/, fact: /\bfull|satiet|distend|dilat|bloat|stretch/i },
  { story: /\blimp|\bwalk/, fact: /limp|gait|walk/i },
  { story: /\bfall\b|\bfell\b|\binjur|\bknock|\baccident\b|\bcrash|\bhit\b|\bstruck\b/, fact: /trauma|injur|fractur|\bfall|accident|impact/i },
  { story: /\bblow(?:ing|s)?\b|\bstrain|\btrumpet\b/, fact: /blow|strain|valsalva|pressure|cough/i },
  { story: /\bburning\b|\bheartburn\b/, fact: /reflux|heartburn|acid|burn/i },
  { story: /\bmeals?\b|\beating\b|\bfood\b|\bdinner\b|\blunch\b/, fact: /meal|\beat|food|postprandial|feed/i },
  { story: /\bno (?:complaints|symptoms)\b|\broutine\b|\bcheck-?up\b|\bscreening\b/, fact: /asymptomatic|incidental|routine|no symptoms|by chance|screening/i },
  { story: /\bdrool|\brefus\w* to (?:eat|feed)\b/, fact: /drool|saliva|swallow|dysphag|feed|\beat/i },
  { story: /\bknee(?:cap)?s?\b/, fact: /knee|patell/i },
  { story: /\bbreastbone\b/, fact: /stern|breastbone|retrostern/i },
  { story: /\bwrist\b/, fact: /wrist|carp|lunate|scaphoid/i },
  { story: /\bforefoot\b/, fact: /forefoot|metatars/i },
  { story: /\bjaw\b/, fact: /jaw|mandib|maxill/i },
  { story: /\bpee\b|\burin|\bbathroom\b|\bstream\b/, fact: /urin|bladder|prostat|void|nocturia|outflow/i },
];

// Telltale clues the bot cannot explain without a mechanism. The covering sentence must name one.
export const MECHANISM_CLUES: { story: RegExp; fact: RegExp; need: string }[] = [
  {
    story: /\b(?:runny|dripping|drippy|streaming) nose\b|\bnose (?:that )?(?:runs|drips)\b|\bclear fluid\b|\bsalty drip\b/,
    fact: /cerebrospinal|\bcsf\b|rhinorrh|otorrh|mucus|sinus|rhinitis|allerg|infect|polyp/i,
    need: "what the fluid is (for example a cerebrospinal fluid leak)",
  },
  {
    story: /\b(?:puffs?|swells?|grows?|bulges?)(?: up)? (?:with|when|on)\b.*\b(?:blow|strain|cough|sneez)/,
    fact: /blow|strain|valsalva|cough|pressure|air/i,
    need: "why it changes with blowing or straining",
  },
  {
    story: /\bbruis\w* (?:around|under|behind) (?:the |both )?(?:eyes?|ears?)\b|\bpanda eyes\b|\braccoon eyes\b/,
    fact: /fractur|skull base|bleed|haemat|hemat/i,
    need: "what causes the bruising",
  },
];

function covered(phrase: string, sentences: string[]): { ok: boolean; sentence?: string } {
  const words = contentWords(phrase).map(stem);
  for (const s of sentences) {
    const factStems = contentWords(s).map(stem);
    if (words.some((w) => factStems.some((f) => sameStem(w, f)))) return { ok: true, sentence: s };
    if (CONCEPTS.some((k) => k.story.test(phrase) && k.fact.test(s))) return { ok: true, sentence: s };
  }
  return { ok: false };
}

// --- answer-label qualifiers ------------------------------------------------------------------

export const QUALIFIERS: { label: RegExp; name: string; story: RegExp; facts: RegExp; hint: string }[] = [
  {
    name: "traumatic", label: /\b(?:post-?)?traumatic\b/i,
    story: /\b(?:fall|fell|falling|injur\w*|accident\w*|crash\w*|collision|hit|struck|blow to|knock\w*|assault\w*|punch\w*|kick\w*|trauma\w*|tackle\w*|fight|smash\w*|thrown)\b/i,
    facts: /\b(?:trauma\w*|injur\w*|fractur\w*|accident\w*|fall|blow|impact)\b/i,
    hint: "an injury such as a fall, a crash or a blow",
  },
  {
    name: "congenital", label: /\bcongenital\b/i,
    story: /\b(?:birth|born|newborn|neonat\w*|infant\w*|baby|babies|since (?:early )?childhood|always had|lifelong)\b/i,
    facts: /\b(?:congenital\w*|birth|born|developmental|inherit\w*|genetic|newborn|embryo\w*|f(?:o)?etal|present from)\b/i,
    hint: "a problem present since birth",
  },
  {
    name: "post-surgical", label: /\b(?:post-?(?:operative|surgical)|iatrogenic)\b/i,
    story: /\b(?:surgery|operation|operated|procedure|stitches|theatre|surgical|op)\b/i,
    facts: /\b(?:surg\w*|operat\w*|procedure|iatrogenic)\b/i,
    hint: "an earlier operation or procedure",
  },
  {
    name: "neonatal", label: /\b(?:neonatal|infantile)\b/i,
    story: /\b(?:newborn|baby|babies|infant\w*|neonat\w*|born|toddler|weeks? old|months? old)\b/i,
    facts: /\b(?:newborn|baby|infant\w*|neonat\w*|birth|children|child)\b/i,
    hint: "a baby or infant",
  },
  {
    name: "radiation-induced", label: /\b(?:radiation-induced|post-?radiation|radiation)\b/i,
    story: /\b(?:radiotherapy|radiation|cancer treatment|treated for cancer)\b/i,
    facts: /\b(?:radiotherapy|radiation|irradiat\w*)\b/i,
    hint: "earlier radiotherapy",
  },
  {
    name: "acute", label: /\bacute\b/i,
    story: /\b(?:sudden\w*|abrupt\w*|overnight|hours?|this morning|tonight|out of nowhere|rapid\w*|quickly|fast|all at once|within a day)\b/i,
    facts: /\b(?:acute\w*|sudden\w*|rapid\w*|emergenc\w*|hours?|urgent\w*)\b/i,
    hint: "a sudden onset",
  },
  {
    name: "chronic", label: /\bchronic\b/i,
    story: /\b(?:months?|years?|long-?standing|for ages|kept|keeps|recurr\w*|again and again|grumbling|ongoing|persistent|never (?:settled|went away)|would not (?:settle|go away|clear)|coming back)\b/i,
    facts: /\b(?:chronic\w*|long-?standing|months?|years?|recurr\w*|progressive\w*|repeated)\b/i,
    hint: "a long or repeated history",
  },
];

// --- the checks -------------------------------------------------------------------------------

/** Deterministic problems with clueFacts themselves: these are read by the reply bot, never posted. */
export function clueFactFormatProblems(facts: ClueFact[] | undefined): string[] {
  const problems: string[] = [];
  for (const f of facts ?? []) {
    const fact = f?.fact?.trim() ?? "";
    if (!f?.clue?.trim() || !fact) { problems.push("clue fact is missing its clue or fact"); continue; }
    if (fact.length > 240) problems.push(`clue fact is too long: ${fact.slice(0, 60)}`);
    if (/[—–]/.test(fact)) problems.push(`clue fact contains a dash: ${fact.slice(0, 60)}`);
    if (serialCommaProblems(fact).length) problems.push(`clue fact misses an Oxford comma: ${fact.slice(0, 60)}`);
    // Facts teach the condition. They never invent this patient's work-up or outcome.
    if (/\b(?:this patient|the patient (?:was|had|underwent|recovered|went on)|was treated|were treated|recovered fully|biopsy (?:showed|confirmed)|scan (?:showed|confirmed))\b/i.test(fact)) problems.push(`clue fact narrates the patient instead of teaching: ${fact.slice(0, 60)}`);
  }
  return problems;
}

/** Every reason the public story and the facts the bot reads disagree. [] = consistent. */
export function clueProblems(c: StoryCase): string[] {
  const problems: string[] = [];
  const sentences = factSentences(c);
  const facts = sentences.join(" ");
  const symptom = story(c);
  const teaser = c.teaser?.trim() ?? "";
  // Rule 1: every clue phrase of the caption symptom is backed by a fact sentence.
  for (const phrase of cluePhrases(symptom)) {
    const hit = covered(phrase, sentences);
    if (!hit.ok) { problems.push(`caption clue "${phrase}" has no matching fact`); continue; }
    for (const m of MECHANISM_CLUES) {
      if (m.story.test(phrase) && !sentences.some((s) => covered(phrase, [s]).ok && m.fact.test(s))) problems.push(`caption clue "${phrase}" needs a fact explaining ${m.need}`);
    }
  }
  // The suspense line is not a symptom list, but a telltale clue there still needs its mechanism.
  for (const m of MECHANISM_CLUES) {
    if (m.story.test(teaser.toLowerCase()) && !sentences.some((s) => m.fact.test(s))) problems.push(`teaser clue needs a fact explaining ${m.need}`);
  }
  // Rule 2: a history qualifier in the answer label needs a story hint and a fact behind it.
  const publicStory = `${symptom} ${teaser}`;
  for (const q of QUALIFIERS) {
    if (!q.label.test(c.diagnosis)) continue;
    if (!q.story.test(publicStory)) problems.push(`answer qualifier "${q.name}" has no matching hint in the caption story (needs ${q.hint})`);
    if (!q.facts.test(facts)) problems.push(`answer qualifier "${q.name}" is not backed by the facts`);
  }
  problems.push(...clueFactFormatProblems(c.clueFacts));
  return [...new Set(problems)];
}

/** The pre-publication gate: consistency plus the clue-fact review binding when one was recorded. */
export function clueReadinessProblem(c: Case): string | null {
  const problems = clueProblems(c);
  const bound = c.contentReview?.clueFactsSha256;
  if (bound && bound !== clueFactsHash(c.clueFacts)) problems.push("clue facts changed after review");
  return problems.length ? `caption/facts mismatch: ${problems.join("; ")}` : null;
}

/** The qualifier rule alone, for the generation step that may add a story hint. */
export function missingQualifierHints(c: Pick<Case, "diagnosis" | "symptom" | "captionSymptom" | "teaser">): typeof QUALIFIERS {
  const publicStory = `${story(c)} ${c.teaser?.trim() ?? ""}`;
  return QUALIFIERS.filter((q) => q.label.test(c.diagnosis) && !q.story.test(publicStory));
}
