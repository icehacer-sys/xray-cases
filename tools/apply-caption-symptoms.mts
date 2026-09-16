// One-off migration (2026-09-16): give QUEUED cases the pool's public `captionSymptom`, so the
// opening line stops naming the cause ("after swallowing an object"). Only the caption changes.
// The clinical `symptom` is untouched, so image approval stays valid. A reviewed case is
// re-reviewed and keeps its old copy if the review fails.
//   npx tsx tools/apply-caption-symptoms.mts            dry run
//   npx tsx tools/apply-caption-symptoms.mts --write    saves passing cases
import "dotenv/config";
import { readFileSync } from "node:fs";
import { loadCases, saveCase } from "../src/cases.js";
import { State } from "../src/state.js";
import { draftForegroundedCaption, draftTeaser, generateThreadsCaption, symptomGiveaway, teaserProblem } from "../src/captions.js";
import { contentHash, copyProblems, readinessProblem, reviewContent } from "../src/readiness.js";
import type { Condition } from "../src/types.js";

const write = process.argv.includes("--write");
const pool = JSON.parse(readFileSync("data/conditions.json", "utf8")) as Condition[];
const state = new State();
for (const c of loadCases()) {
  if (state.getStages(c.folder).challengePostedAt || c.stages?.challengePostedAt || c.retired || !c.generated?.threadsCaption) continue;
  const g = c.generated;
  const opening = g.threadsCaption!.split("\n\n")[0];
  const pooled = pool.find((p) => p.diagnosis === c.diagnosis)?.captionSymptom;
  if (!pooled || c.captionSymptom === pooled) {
    if (symptomGiveaway(opening)) console.log(`${c.folder}: STILL GIVES IT AWAY with no pool captionSymptom: ${opening}`);
    continue;
  }
  const wasReviewed = c.source !== "generated" || c.contentReview?.sha256 === contentHash(c);
  c.captionSymptom = pooled;
  const lines = g.threadsCaption!.split("\n\n");
  lines[0] = generateThreadsCaption(c).split("\n\n")[0];
  if (teaserProblem(lines[2].replace(/\.$/, ""), c)) {
    c.teaser = await draftTeaser(c);
    lines[2] = generateThreadsCaption(c).split("\n\n")[2];
  }
  console.log(`${c.folder}\n  was: ${opening}\n  now: ${lines[0]}\n  line 3: ${lines[2]}`);
  if (!write) continue;
  g.threadsCaption = lines.join("\n\n");
  if (g.threadsCaptionAlt) {
    // The dormant hook experiment's variant. "" is its documented "no usable variant" value, so a
    // draft that fails the copy checks is dropped rather than allowed to hold the case.
    g.threadsCaptionAlt = await draftForegroundedCaption(c);
    if (copyProblems(c).some((p) => /symptom insertion|gives away|reveals|alternate/.test(p))) g.threadsCaptionAlt = "";
  }
  if (wasReviewed && c.source === "generated" && !c.needsReview) {
    try {
      await reviewContent(c);
    } catch (err) {
      console.log(`  review failed, nothing saved: ${String(err).slice(0, 200)}`);
      continue;
    }
  }
  saveCase(c);
  console.log(`  saved; readiness: ${readinessProblem(c) ?? "ready"}`);
}
