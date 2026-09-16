// Offline checks for the suspense line and the answer-title readiness guard (2026-09-16). No network.
// Run: npx tsx tools/verify-teaser.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateThreadsCaption, generateThreadsAnswer, teaserProblem, fallbackTeaser, TEASER_FALLBACKS } from "../src/captions.js";
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
console.log("PASS suspense line never describes the finding; untitled answers are held");
