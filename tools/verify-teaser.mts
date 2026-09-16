// Offline checks for the suspense line and the answer-title readiness guard (2026-09-16). No network.
// Run: npx tsx tools/verify-teaser.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateThreadsCaption, generateThreadsAnswer, teaserProblem, fallbackTeaser, TEASER_FALLBACKS, symptomGiveaway, publicSymptom } from "../src/captions.js";
import { copyProblems } from "../src/readiness.js";
import type { Case } from "../src/types.js";

const worm = JSON.parse(readFileSync("cases/00148-dracunculiasis/case.json", "utf8")) as Case;

// The caption no longer carries the hook's description of the finding.
const caption = generateThreadsCaption({ ...worm, teaser: "And nobody expected what was hiding in that calf" });
assert.doesNotMatch(caption, /calcification|curling|soft tissues/i);
assert.match(caption, /^A patient came in with .+\.\n\nThen the X-ray loaded 😭\n\nAnd nobody expected what was hiding in that calf\.\n\n/);
// No teaser -> a fixed line that describes nothing, never the hook.
const plain = generateThreadsCaption({ ...worm, teaser: undefined });
assert.ok(TEASER_FALLBACKS.some((t) => plain.includes(`${t}.`)));
assert.doesNotMatch(plain, /calcification/i);
assert.equal(fallbackTeaser(worm), fallbackTeaser(worm), "stable per case");

// Guard: describing the film, reusing its wording, naming the answer, or house-style breaches.
for (const bad of [
  "And a long white line was curled up in there",
  "And something curling ran beside the bones",
  "And there was a Guinea worm in there",
  "And then, everything changed",
  "And the calf held a secret 😭",
  "And then we saw why the calf hurt",
  "And his calf had been hiding it for thirty years",
  "And her calf told the story",
  "And that firm lump from the remote stay said everything",
]) assert.ok(teaserProblem(bad, worm), bad);
for (const ok of ["And no one expected what was hiding in that calf", "And nobody expected what was hiding in that calf", "And the calf had a secret nobody saw coming"]) assert.equal(teaserProblem(ok, worm), null, ok);

// Answer titles: a rendered answer passes; the hand-written untitled one that posted on 2026-09-15 fails.
const rendered = { ...worm, generated: { ...worm.generated!, threadsAnswer: await generateThreadsAnswer(worm) } };
assert.ok(rendered.generated.threadsAnswer.includes("👀 What you see:\n"));
assert.ok(!copyProblems(rendered).includes("answer sections are missing their titles"));
assert.ok(copyProblems(worm).includes("answer sections are missing their titles"), "the posted untitled answer must be flagged");

// Opening lines that name the cause or exposure (real queued/pool symptoms from 2026-09-16).
for (const clue of [
  "upper abdominal discomfort after swallowing an object",
  "a firm lump in the calf after a remote stay in an endemic area",
  "decades of worsening breathlessness in a retired stone quarry worker",
  "a hugely swollen foot with discharging sinuses in a barefoot farm worker",
  "years of stiffness and bone pain in an adult from a village with high fluoride in the well water",
  "a penetrating chest injury after a fall at a construction site",
]) assert.ok(symptomGiveaway(clue), clue);
for (const fine of ["years of trouble getting food down", "a hot swollen knee", "bilious vomiting soon after the first feed", "a chest injury after a fall at a construction site"]) assert.equal(symptomGiveaway(fine), null, fine);
// The caption uses the public symptom; the clinical one stays for image verification.
const spoon = { ...worm, symptom: "upper abdominal discomfort after swallowing an object", captionSymptom: "upper abdominal discomfort" };
assert.equal(publicSymptom(spoon), "upper abdominal discomfort");
assert.match(generateThreadsCaption(spoon), /^A patient came in with upper abdominal discomfort\.\n/);
const leaky = { ...spoon, captionSymptom: undefined };
leaky.generated = { ...worm.generated!, threadsCaption: generateThreadsCaption(leaky) };
assert.ok(copyProblems(leaky).some((p) => p.startsWith("opening line gives away the answer")));
console.log("PASS suspense line never describes the finding; untitled answers and giveaway symptoms are held");
