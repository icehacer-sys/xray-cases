// Offline checks for the caption-to-facts consistency gate (reply audit 2026-10-17). No network.
// Run: npm run clues:verify
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.BOT_USAGE_LOG = "off";
globalThis.fetch = async () => { throw new Error("Unexpected network request in clue-fact checks"); };
const { clueProblems, clueReadinessProblem, clueFactsHash, cluePhrases } = await import("../src/clue-facts.js");
const { applyClueDraft, ensureClueFacts, storyHintProblem, generateThreadsCaption } = await import("../src/captions.js");
const { contentHash, contentProblem, readinessProblem } = await import("../src/readiness.js");
import type { Case } from "../src/types.js";

const load = (folder: string) => JSON.parse(readFileSync(new URL(`../cases/${folder}/case.json`, import.meta.url), "utf8")) as Case;
const has = (problems: string[], re: RegExp) => problems.some((p) => re.test(p));

// --- 00199 pattern: a runny nose in the caption and no CSF fact ------------------------------
const pneumo = load("00199-traumatic-pneumocephalus");
assert.deepEqual(cluePhrases(pneumo.symptom), ["a headache", "a runny nose that would not dry up"]);
const before = clueProblems(pneumo);
assert.ok(has(before, /caption clue "a runny nose that would not dry up" has no matching fact/), "the posted 00199 facts never explain the nose");
assert.ok(has(before, /caption clue "a headache" has no matching fact/));
assert.ok(has(before, /answer qualifier "traumatic" has no matching hint/), "the caption gave no injury history");
assert.ok(!has(before, /"traumatic" is not backed/), "whyItMatters already names the skull base fracture");

// A fact that mentions the nose without saying what the fluid is still fails the mechanism rule.
const vague = clueProblems({ ...pneumo, clueFacts: [{ clue: "a runny nose", fact: "A runny nose can follow a head injury." }] });
assert.ok(!has(vague, /"a runny nose that would not dry up" has no matching fact/));
assert.ok(has(vague, /"a runny nose that would not dry up" needs a fact explaining what the fluid is/));

// With the CSF fact the nose clue passes.
const csf = { clue: "a runny nose that would not dry up", fact: "A runny nose that will not dry up after a head injury can be clear cerebrospinal fluid leaking through a torn dura and the same tear can let air into the skull." };
const headache = { clue: "a headache", fact: "Air inside the skull and the underlying injury commonly cause a headache." };
const withFacts = clueProblems({ ...pneumo, clueFacts: [csf, headache] });
assert.ok(!has(withFacts, /runny nose/), JSON.stringify(withFacts));
assert.ok(!has(withFacts, /headache/));
// ...but the qualifier rule still wants the story to hint at the injury.
assert.deepEqual(withFacts, ['answer qualifier "traumatic" has no matching hint in the caption story (needs an injury such as a fall, a crash or a blow)']);
const hinted = { ...pneumo, captionSymptom: "a headache and a runny nose that would not dry up after a fall onto the face", clueFacts: [csf, headache] };
assert.deepEqual(clueProblems(hinted), []);
assert.match(generateThreadsCaption(hinted), /^A patient with a headache and a runny nose that would not dry up after a fall onto the face\.\n\n/);

// --- the traumatic qualifier pattern ---------------------------------------------------------
const trauma: any = { diagnosis: "Traumatic fixture", symptom: "a sore wrist", whatYouSee: "A broken wrist bone.", whyItMatters: "A wrist fracture follows a fall on the outstretched hand.", treatment: "Treatment may include a cast." };
assert.ok(has(clueProblems(trauma), /"traumatic" has no matching hint/));
assert.deepEqual(clueProblems({ ...trauma, symptom: "a sore wrist after a fall" }), []);
assert.deepEqual(clueProblems({ ...trauma, symptom: "a sore wrist", teaser: "And the fall was only the beginning" }), [], "a teaser hint counts as story");
assert.ok(has(clueProblems({ ...trauma, symptom: "a sore wrist after a fall", whyItMatters: "Wrist pain is common." }), /"traumatic" is not backed by the facts/));
// Other qualifiers use the same rule.
const congenital: any = { diagnosis: "Congenital fixture", symptom: "a stiff elbow", whatYouSee: "Fused elbow bones.", whyItMatters: "This congenital fusion is present from birth.", treatment: "" };
assert.ok(has(clueProblems(congenital), /"congenital" has no matching hint/));
assert.deepEqual(clueProblems({ ...congenital, symptom: "a stiff elbow since birth" }), []);
const acute: any = { diagnosis: "Acute fixture", symptom: "breathlessness that got worse over three months", whatYouSee: "Fluid in both lungs.", whyItMatters: "Acute fluid build-up causes breathlessness.", treatment: "" };
assert.ok(has(clueProblems(acute), /"acute" has no matching hint/), "an 'acute' label with a three-month story is the 00193 mismatch");

// Dismissal narration is suspense, not a clue the facts must explain.
assert.deepEqual(cluePhrases("a dull lower back ache blamed on an old mattress"), ["a dull lower back ache"]);
assert.deepEqual(cluePhrases("a tummy ache that comes and goes and jeans that feel looser lately"), ["a tummy ache that intermittent", "jeans that feel looser lately"]);

// --- the generation step: validated drafts only ---------------------------------------------
const draftCase = (): Case => ({ ...pneumo, folder: "fixture", clueFacts: undefined, captionSymptom: undefined, stages: undefined });
const c1 = draftCase();
applyClueDraft(c1, { clueFacts: [csf, headache, { clue: "x", fact: "This patient recovered fully after surgery." }, { clue: "y", fact: "Pain, swelling and bruising." }], captionSymptom: "A patient with a headache and a runny nose that would not dry up after a fall onto the face." });
assert.deepEqual(c1.clueFacts, [csf, headache], "patient narration and a missing Oxford comma are dropped");
assert.equal(c1.captionSymptom, "a headache and a runny nose that would not dry up after a fall onto the face");
assert.deepEqual(clueProblems(c1), []);
// A story hint may only add history. It may not name the answer, drop wording or leak the finding.
assert.match(storyHintProblem(draftCase(), "a headache and a runny nose that would not dry up after a traumatic fall")!, /names the answer/);
assert.match(storyHintProblem(draftCase(), "a headache after a fall")!, /drops original wording/);
assert.match(storyHintProblem(draftCase(), "a headache and a runny nose that would not dry up after a fall, a crash, and a bubble")!, /commas/);
assert.match(storyHintProblem(draftCase(), "a headache and a runny nose that would not dry up and some screen protector worries")!, /finding's wording|qualifier/);
assert.equal(storyHintProblem(draftCase(), "a headache and a runny nose that would not dry up after a car crash"), null);
const c2 = draftCase();
applyClueDraft(c2, { clueFacts: [], captionSymptom: "a headache after a fall" });
assert.equal(c2.captionSymptom, undefined, "a rejected hint leaves the public line untouched");

// ensureClueFacts: a gap gets one draft; a failed draft is a hold, never a throw.
let calls = 0;
const fixed = draftCase();
const left = await ensureClueFacts(fixed, async (_c, problems) => { calls++; assert.ok(problems.length > 0); return { clueFacts: [csf, headache], captionSymptom: "a headache and a runny nose that would not dry up after a fall onto the face" }; });
assert.deepEqual(left, []);
assert.equal(calls, 1);
const held = await ensureClueFacts(draftCase(), async () => { throw new Error("provider down"); });
assert.ok(has(held, /runny nose/), "a drafting failure leaves the gap for the generator to hold");
calls = 0;
const vetted = { ...draftCase(), captionSymptom: hinted.captionSymptom, condition: { ...pneumo.condition!, clueFacts: [csf, headache] } };
assert.deepEqual(await ensureClueFacts(vetted, async () => { calls++; return {}; }), []);
assert.equal(calls, 0, "owner-vetted condition clue facts need no draft");
assert.deepEqual(vetted.clueFacts, [csf, headache]);

// --- the gates: clueFacts never touch the copy hash, and a recorded binding is enforced -------
assert.equal(contentHash({ ...pneumo, clueFacts: [csf] }), contentHash(pneumo), "clueFacts stay outside contentHash");
const bound = { ...hinted, source: "generated" as const, contentReview: { sha256: "x", reviewedAt: "", reviewer: "", clueFactsSha256: clueFactsHash(hinted.clueFacts) } };
assert.equal(clueReadinessProblem(bound), null);
assert.match(clueReadinessProblem({ ...bound, clueFacts: [csf] })!, /clue facts changed after review/);

// --- the queued cases backfilled on 2026-10-17 -----------------------------------------------
// clueFacts were added without touching captions, answers, images or reviews, so every copy
// review and image approval still holds and each case passes the new pre-challenge gate.
const queued = [
  "00202-laryngocele",
  "00203-gastric-outlet-obstruction-scarred-pyloric-ulcer",
  "00204-osteoblastic-bone-metastases-from-prostate-cancer",
  "00205-ileocolic-intussusception-with-a-polypoid-lead-point",
  "00206-annular-colorectal-carcinoma-apple-core-lesion",
  "00207-takotsubo-cardiomyopathy",
  "00208-ulcerative-colitis-with-lead-pipe-colon",
];
for (const folder of queued) {
  const c = load(folder);
  assert.deepEqual(clueProblems(c), [], folder);
  assert.equal(contentProblem(c), null, `${folder}: copy review still matches`);
  assert.equal(clueReadinessProblem(c), null, `${folder}: passes the pre-challenge clue gate`);
}
// The shared readiness definition (publish, queue check, top-up) carries the gate. forceRepeat only
// skips the already-published check so this stays true after the case posts.
const tako = { ...load("00207-takotsubo-cardiomyopathy"), forceRepeat: true };
assert.equal(readinessProblem(tako), null);
assert.match(readinessProblem({ ...tako, clueFacts: undefined })!, /caption\/facts mismatch: caption clue "a really upsetting week" has no matching fact/);
// Without the added facts the two clear gaps would have been held.
for (const folder of ["00207-takotsubo-cardiomyopathy", "00208-ulcerative-colitis-with-lead-pipe-colon"]) {
  const c = load(folder);
  assert.ok(clueProblems({ ...c, clueFacts: undefined }).length > 0, folder);
  assert.match(clueReadinessProblem({ ...c, clueFacts: undefined })!, /caption\/facts mismatch/, folder);
}

console.log("PASS caption clues need facts (00199 runny nose and CSF), qualifiers need a story hint (traumatic, congenital, acute), drafts are validated, gaps hold without a re-render, clueFacts stay outside contentHash, queued backfill ready; zero network calls");
