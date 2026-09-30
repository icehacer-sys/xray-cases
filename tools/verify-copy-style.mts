import assert from "node:assert/strict";
process.env.BOT_USAGE_LOG = "off";
globalThis.fetch = async () => { throw new Error("Unexpected network request in copy-style checks"); };
const { SERIAL_COMMA_RULE, serialCommaProblems, assertSerialCommas } = await import("../src/copy-style.js");
const { generateThreadsCaption, generateThreadsAnswer } = await import("../src/captions.js");
const { copyProblems } = await import("../src/readiness.js");
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
console.log("PASS exact owner vignette, flat serial-list guard, cached-copy gate, pairs, clauses and URLs; zero network calls");
