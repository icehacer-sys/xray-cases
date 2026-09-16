// One-off migration (2026-09-16): swap the finding-describing third line of every QUEUED caption
// for a drafted suspense line. Only that line changes, so hand edits elsewhere survive.
// A case that was content-reviewed is re-reviewed; if the review fails the old caption is kept,
// so this can never hold a case that was ready to post.
//   npx tsx tools/redraft-teasers.mts            dry run: drafts and prints, saves nothing
//   npx tsx tools/redraft-teasers.mts --write    saves passing cases (add --case=a,b to limit)
import "dotenv/config";
import { loadCases, saveCase } from "../src/cases.js";
import { State } from "../src/state.js";
import { draftTeaser, generateThreadsCaption } from "../src/captions.js";
import { contentHash, readinessProblem, reviewContent } from "../src/readiness.js";

const write = process.argv.includes("--write");
const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
const state = new State();
for (const c of loadCases()) {
  if (state.getStages(c.folder).challengePostedAt || c.stages?.challengePostedAt || c.retired || !c.generated?.threadsCaption || (only && !only.split(",").includes(c.folder))) continue;
  const snapshot = JSON.stringify({ teaser: c.teaser, generated: c.generated, contentReview: c.contentReview });
  const wasReviewed = c.source !== "generated" || c.contentReview?.sha256 === contentHash(c);
  const oldLine = c.generated.threadsCaption.split("\n\n")[2];
  c.teaser = await draftTeaser(c);
  const newLine = generateThreadsCaption(c).split("\n\n")[2];
  c.generated.threadsCaption = c.generated.threadsCaption.replace(oldLine, newLine);
  if (c.generated.threadsCaptionAlt) c.generated.threadsCaptionAlt = c.generated.threadsCaptionAlt.replace(oldLine, newLine);
  console.log(`${c.folder}\n  was: ${oldLine}\n  now: ${newLine}`);
  if (!write) continue;
  if (wasReviewed && c.source === "generated" && !c.needsReview) {
    try {
      await reviewContent(c);
    } catch (err) {
      console.log(`  review failed, kept the old caption: ${String(err).slice(0, 200)}`);
      continue; // nothing saved
    }
  }
  saveCase(c);
  console.log(`  saved; readiness: ${readinessProblem(c) ?? "ready"}`);
  void snapshot;
}
