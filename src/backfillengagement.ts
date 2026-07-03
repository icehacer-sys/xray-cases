// One-off: backfill the durable reach upgrades onto every UNPOSTED case — draft the
// engagement fields (difficulty / layperson question / seed hint) where missing, then
// re-render generated.threadsCaption into the new format. Already-posted cases are skipped.
// Run with the SAME env production uses so the baked "Answer in N min" + "Case #N" match:
//   BOT_CASE_NUMBER_OFFSET=<n> BOT_ANSWER_DELAY_MIN=45 npx tsx src/backfillengagement.ts
import { loadCases, saveCase } from "./cases.js";
import { State } from "./state.js";
import { generateThreadsCaption, generateThreadsAnswer, draftEngagement, pickCta } from "./captions.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  const state = new State();
  const cases = loadCases();
  // Only unposted cases (no challenge recorded) — never rewrite a live post's caption.
  const targets = cases.filter((c) => !state.getStages(c.folder).challengePostedAt);
  console.log(
    `backfill engagement: ${targets.length}/${cases.length} unposted case(s) ` +
      `(caseNumberOffset ${config.caseNumberOffset}, answerDelay ${config.answerDelayMin}m)\n`,
  );

  let over = 0;
  for (const c of targets) {
    if (c.difficulty == null || c.laypersonQuestion == null || c.seedHint == null) {
      const e = await draftEngagement(c);
      c.difficulty ??= e.difficulty;
      c.laypersonQuestion ??= e.laypersonQuestion;
      c.seedHint ??= e.seedHint;
    }
    const caption = generateThreadsCaption(c);
    const answer = await generateThreadsAnswer(c); // re-render with the new section order (no re-draft: fields present)
    const ctaText = pickCta(c).text; // pick up the new free-pack-weighted rotation
    c.generated = { ...(c.generated ?? {}), threadsCaption: caption, threadsAnswer: answer, ctaText };
    saveCase(c);

    const len = caption.length;
    if (len > config.answerMaxChars || answer.length > config.answerMaxChars) over++;
    const pub = (c.number ?? 1) + config.caseNumberOffset;
    console.log(`Case #${pub}  ${c.folder}  [caption ${len} / answer ${answer.length} chars${len > config.answerMaxChars || answer.length > config.answerMaxChars ? " ⚠ OVER" : ""}]  difficulty ${c.difficulty}/5`);
    console.log(`  seed -> ${c.seedHint}`);
    console.log(caption.replace(/^/gm, "  | "));
    console.log("");
  }

  console.log(
    `done — ${targets.length} backfilled` +
      (over ? `, ${over} OVER ${config.answerMaxChars} chars (tighten clamps)` : `, all under ${config.answerMaxChars}`),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
