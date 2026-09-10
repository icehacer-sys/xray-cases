// No publishing endpoints. --review bills image/copy QA and saves approvals or explicit holds.
import { loadCases, saveCase } from "../src/cases.js";
import { State } from "../src/state.js";
import { verifyXray } from "../src/verify.js";
import { imageApproval, finalImage } from "../src/image-approval.js";
import { readinessProblem, reviewContent } from "../src/readiness.js";
const state = new State();
const review = process.argv.includes("--review");
const only = process.argv.find(a => a.startsWith("--case="))?.slice(7);
let held = 0;
for (const c of loadCases()) {
  if (state.getStages(c.folder).challengePostedAt || c.stages?.challengePostedAt || (only && c.folder !== only)) continue;
  if (review) {
    c.approved = false; c.needsReview = true; delete c.contentReview;
    c.verifyDefects = ["Final review in progress"]; saveCase(c);
    try {
      if (!c.condition) throw new Error("Missing condition");
      const png = finalImage(c), verdict = await verifyXray(png, c.condition);
      c.imageApproval = imageApproval(png, c.condition, verdict);
      c.verifyDefects = verdict.defects;
      console.log(JSON.stringify({ case: c.folder, image: verdict.ok, observations: verdict.observations, defects: verdict.defects }));
      await reviewContent(c);
      if (!verdict.ok) throw new Error(verdict.defects.join("; "));
      c.needsReview = false; c.approved = true; c.verifyDefects = [];
    } catch (err) { c.verifyDefects = [...new Set([...(c.verifyDefects ?? []), String(err)])]; }
    saveCase(c);
  }
  const problem = readinessProblem(c);
  if (problem) held++;
  console.log(JSON.stringify({ case: c.folder, postAt: c.postAt, ready: !problem, problem }));
}
if (held) { console.error(`${held} case(s) held; nothing was published.`); process.exitCode = 1; }
