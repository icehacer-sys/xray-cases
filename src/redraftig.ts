// Re-draft the Instagram caption for every queued (not-yet-posted) case so changes to
// generateIgCaption (e.g. the new emojis) apply to the existing queue, not just future
// cases. Leaves the Threads caption/answer/CTA untouched. Run locally (needs ANTHROPIC_API_KEY).
//   npx tsx src/redraftig.ts
import { loadCases, saveCase } from "./cases.js";
import { generateIgCaption } from "./captions.js";
import { State } from "./state.js";

const state = new State();
let n = 0;
for (const c of loadCases()) {
  if (state.getStages(c.folder).challengePostedAt) continue; // skip already-posted cases
  const igCaption = await generateIgCaption(c);
  c.generated = { ...(c.generated ?? {}), igCaption };
  saveCase(c);
  n += 1;
  console.log(`redrafted IG caption for ${c.folder} (${c.diagnosis})`);
}
console.log(`\nredrafted ${n} queued IG caption(s).`);
