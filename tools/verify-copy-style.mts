import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.BOT_USAGE_LOG = "off";
globalThis.fetch = async () => { throw new Error("Unexpected network request in copy-style checks"); };
const { SERIAL_COMMA_RULE, serialCommaProblems, assertSerialCommas } = await import("../src/copy-style.js");
const { generateThreadsCaption, generateThreadsAnswer, pickCta } = await import("../src/captions.js");
const { copyProblems, contentProblem } = await import("../src/readiness.js");
const fixture: any = { diagnosis: "Kienbock disease", aliases: [], symptom: "persistent wrist pain, stiffness, and a weakening grip", hook: "lunate changes", teaser: "And suddenly the symptom made a lot more sense", whatYouSee: "A dense and flattened lunate.", whyItMatters: "Collapse can affect wrist mechanics.", treatment: "Care depends on stage.", takeaway: "Seek assessment." };
const caption = generateThreadsCaption(fixture);
assert.equal(caption.split("\n\n")[0], "A patient with persistent wrist pain, stiffness, and a weakening grip.");
assert.match(SERIAL_COMMA_RULE, /three or more/);
for (const text of [
  "A patient with persistent wrist pain, stiffness and a weakening grip.",
  "Urgent CT, tissue diagnosis and staging.",
  "Offloading, footwear changes and activity modification first.",
  "Activity modification, stretching and symptom relief.",
  "Options include support, observation or surgery.",
  "Pain, numbness, stiffness and swelling.",
  "Pain, stiffness and weakness. See https://example.com",
]) {
  assert.equal(serialCommaProblems(text).length, 1, text);
  assert.throws(() => assertSerialCommas(text), /Missing Oxford comma/);
}
for (const text of [
  caption,
  "Pain and stiffness.", "CT or MRI.",
  "A patient with pain, which improves with rest and worsens with movement.",
  "The arm hurts, but the wrist and hand are normal.",
  "I reviewed the scan, and no fracture was found.",
  "Pain, followed by stiffness and swelling.",
  "In children, pain and swelling.", "For wrist pain, rest and ice.",
  "At presentation, stiffness and a weakening grip.", "Pain, in the wrist and hand.",
  "Initially, pain and swelling.", "Typically, rest and ice.",
  "A patient with pain, especially stiffness and swelling.",
  "Pain, mainly stiffness and swelling.", "Pain, along with stiffness and swelling.",
  "The calcification is near the tendon, in the rotator-cuff region.",
  "https://example.com/pain,stiffness-and-weakness?and=or",
  "Pain, stiffness, and weakness.", "Support, observation, or surgery.",
]) assert.deepEqual(serialCommaProblems(text), [], text);
assert.throws(() => generateThreadsCaption({ ...fixture, symptom: "persistent wrist pain, stiffness and a weakening grip" }), /Missing Oxford comma/);
// Ambiguous grammar is not rewritten or merged by a punctuation guess.
for (const symptom of ["pain, swelling and weakness that worsens", "pain, which improves with rest and worsens with movement"])
  assert.equal(generateThreadsCaption({ ...fixture, symptom }).split("\n\n")[0], `A patient with ${symptom}.`);
const answer = await generateThreadsAnswer(fixture);
const good = { ...fixture, generated: { threadsCaption: caption, threadsCaptionAlt: "", threadsAnswer: answer, igCaption: "", ctaText: "Pain and stiffness.\nfree.mednoteslab.com" } };
assert.deepEqual(copyProblems(good), []);
for (const field of ["threadsCaption", "threadsCaptionAlt", "threadsAnswer", "ctaText"])
  assert.ok(copyProblems({ ...good, generated: { ...good.generated, [field]: "Pain, stiffness and weakness." } }).some(p => p.startsWith("Missing Oxford comma")), field);
await assert.rejects(generateThreadsAnswer({ ...fixture, treatment: "Offloading, footwear changes and activity modification first." }), /Missing Oxford comma/);
// The explicit-only offer must never leak into default rotation.
// This test performs no queue writes or API calls.
const challengeCta = pickCta({ ...fixture, cta: "challenge" });
assert.equal(challengeCta.key, "challenge");
assert.ok(challengeCta.text.length <= 500);
assert.deepEqual(serialCommaProblems(challengeCta.text), []);
const lastLine = challengeCta.text.trim().split("\n").at(-1)!;
assert.match(lastLine, /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i);
assert.equal(`https://${lastLine}`, "https://challenge.mednoteslab.com");
for (let seq = 0; seq < 52; seq++) {
  const automatic = pickCta(fixture, seq);
  assert.notEqual(automatic.key, "challenge");
  assert.ok(!automatic.text.includes("challenge.mednoteslab.com"));
}
const cardCta = pickCta({ ...fixture, cta: "anxiety" });
assert.equal(cardCta.key, "anxiety");
assert.ok(cardCta.text.includes("Match the patient’s prompt with the most absurd reply."));
assert.ok(!cardCta.text.includes("flip"));
assert.deepEqual(copyProblems({ ...good, generated: { ...good.generated, ctaText: challengeCta.text } }), []);
const pinnedWeek = [
  ["00180-kienbock", "2026-10-01", "anxiety"],
  ["00181-pancoast", "2026-10-02", "challenge"],
  ["00182-compound-odontoma", "2026-10-03", "anxiety"],
  ["00183-freiberg", "2026-10-04", "challenge"],
  ["00184-osgood-schlatter", "2026-10-05", "anxiety"],
  ["00185-calcific-tendinopathy", "2026-10-06", "challenge"],
  ["00186-osteochondritis-dissecans", "2026-10-07", "anxiety"],
];
for (const [folder, date, key] of pinnedWeek) {
  const c = JSON.parse(readFileSync(new URL(`../cases/${folder}/case.json`, import.meta.url), "utf8"));
  assert.equal(c.postAt, `${date}T19:00:00Z`, folder);
  assert.equal(c.cta, key, folder);
  assert.equal(c.generated.ctaText, pickCta(c).text, `${folder}: cached CTA matches pin`);
  assert.equal(contentProblem(c), null, `${folder}: current copy review`);
}
console.log("PASS copy style, corrected card mechanics, explicit Challenge pins on October 2/4/6, matching cached copy/reviews, and no automatic Challenge rotation; zero network calls");
