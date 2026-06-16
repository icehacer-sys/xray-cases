// Orchestrator + CLI for xray-case-poster.
//
// Modes:
//   --dry-run   generate captions + write `generated` drafts to case.json, print, post NOTHING
//   --live      actually post to Threads (+ Instagram if enabled); requires config.confirmLive
//   --prompt    print the ChatGPT image prompt for a given folder (or the next undrafted case)
//
// Per-run staging (now = new Date()):
//   1. challenge -> postImage, record threadsPostId + challengePostedAt; best-effort IG carousel
//   2. answer    -> reply(threadsPostId) after answerDelayMin, record answerCommentId + answerPostedAt
//   3. cta       -> reply(answerCommentId) after ctaDelayMin, record ctaPostedAt
// Draft-ahead: cases due within ~24h get their `generated` text written now for review/edit.

import { config } from "./config.js";
import { loadCases, imageUrl, saveCase, loadUsedDiagnoses, isUsedDiagnosis, addUsedDiagnosis } from "./cases.js";
import { State } from "./state.js";
import {
  generateThreadsCaption,
  generateThreadsAnswer,
  generateIgCaption,
  pickCta,
  imagePrompt,
} from "./captions.js";
import { postImage, reply } from "./threads.js";
import { publishCarousel } from "./instagram.js";
import type { Case } from "./types.js";

const MINUTE_MS = 60_000;
const DRAFT_AHEAD_MS = 24 * 60 * MINUTE_MS; // draft cases due within ~24h

type Mode = "dry-run" | "live" | "prompt";

interface Cli {
  mode: Mode;
  folder?: string; // optional positional for --prompt
}

function parseArgs(argv: string[]): Cli {
  const args = argv.slice(2);
  let mode: Mode | undefined;
  let folder: string | undefined;

  for (const a of args) {
    if (a === "--dry-run") mode = "dry-run";
    else if (a === "--live") mode = "live";
    else if (a === "--prompt") mode = "prompt";
    else if (!a.startsWith("-")) folder = a; // positional (e.g. --prompt <folder>)
  }

  if (!mode) {
    throw new Error("Usage: tsx src/index.ts [--dry-run | --live | --prompt [folder]]");
  }
  return { mode, folder };
}

function log(...parts: unknown[]): void {
  console.log(...parts);
}

/** Ensure c.generated is fully populated (caption/answer/ig/cta), persist via saveCase. */
async function ensureGenerated(c: Case, state: State): Promise<NonNullable<Case["generated"]>> {
  const existing = c.generated ?? {};
  const need =
    existing.threadsCaption == null ||
    existing.threadsAnswer == null ||
    existing.igCaption == null ||
    existing.ctaText == null;

  if (!need) return existing as NonNullable<Case["generated"]>;

  const threadsCaption = existing.threadsCaption ?? generateThreadsCaption(c);
  const threadsAnswer = existing.threadsAnswer ?? (await generateThreadsAnswer(c));
  const igCaption = existing.igCaption ?? (await generateIgCaption(c));
  const ctaText = existing.ctaText ?? pickCta(c).text;

  c.generated = { threadsCaption, threadsAnswer, igCaption, ctaText };
  // keep stages in case.json in sync with central state for at-a-glance review
  c.stages = state.getStages(c.folder);
  saveCase(c);
  log(`  drafted captions for ${c.folder} (saved to case.json)`);
  return c.generated;
}

async function runPrompt(cli: Cli): Promise<void> {
  const cases = loadCases();
  if (cases.length === 0) {
    log("No cases found.");
    return;
  }

  let target: Case | undefined;
  if (cli.folder) {
    target = cases.find((c) => c.folder === cli.folder);
    if (!target) throw new Error(`No case with folder "${cli.folder}".`);
  } else {
    // next case without a drafted caption, else the earliest case
    target = cases.find((c) => !c.generated?.threadsCaption) ?? cases[0];
  }

  log(imagePrompt(target));
}

async function runPublish(cli: Cli): Promise<void> {
  const live = cli.mode === "live";
  if (live && !config.confirmLive) {
    throw new Error(
      "Refusing to post: --live requires BOT_CONFIRM_LIVE=yes in the environment.",
    );
  }

  const now = new Date();
  const state = new State();
  const cases = loadCases();

  log(`xray-poster ${cli.mode} @ ${now.toISOString()} — ${cases.length} case(s)`);

  for (const c of cases) {
    const postAt = new Date(c.postAt);
    const dueNow = postAt.getTime() <= now.getTime();
    // Dry-run is a preview tool: draft (and show) captions for any upcoming case,
    // regardless of how far out postAt is. Live mode only drafts within ~24h.
    const draftAhead =
      !dueNow &&
      (cli.mode === "dry-run" || postAt.getTime() - now.getTime() <= DRAFT_AHEAD_MS);
    const stages = state.getStages(c.folder);

    // --- Draft-ahead: case is upcoming (within the draft window) but not yet due --------
    if (draftAhead && !stages.challengePostedAt) {
      const generated = await ensureGenerated(c, state);
      if (cli.mode === "dry-run") {
        log(`\n[dry-run] upcoming CHALLENGE for ${c.folder} (postAt ${c.postAt}):`);
        log(`  image: ${imageUrl(c.folder, c.threadsImage)}`);
        log(generated.threadsCaption);
      }
      continue;
    }

    if (!dueNow) continue; // further out than the draft window — leave alone

    // --- Stage 1: challenge -------------------------------------------------------------
    if (!stages.challengePostedAt) {
      // Review gate: a GENERATED case must be approved before the publisher posts it
      // (unless BOT_AUTO_APPROVE is on). Hand-made cases (source !== "generated") are
      // exempt, matching the documented manual workflow. Skip without advancing any
      // stage so a later run picks it up once approved.
      if (c.source === "generated" && !(c.approved === true || config.autoApprove)) {
        log(`awaiting approval: ${c.folder}`);
        continue;
      }

      // Never repeat a diagnosis we've already posted (history seed + earlier cases).
      if (isUsedDiagnosis(loadUsedDiagnoses(), c.diagnosis, c.aliases ?? [])) {
        log(`duplicate diagnosis, skipping ${c.folder} ("${c.diagnosis}" already used)`);
        continue;
      }

      const generated = await ensureGenerated(c, state);

      if (cli.mode === "dry-run") {
        log(`\n[dry-run] would post CHALLENGE for ${c.folder}:`);
        log(`  image: ${imageUrl(c.folder, c.threadsImage)}`);
        log(generated.threadsCaption);
      } else {
        const threadsPostId = await postImage(
          imageUrl(c.folder, c.threadsImage),
          generated.threadsCaption!,
        );
        state.setStages(c.folder, {
          threadsPostId,
          challengePostedAt: new Date().toISOString(),
        });
        log(`posted CHALLENGE for ${c.folder} -> ${threadsPostId}`);
        addUsedDiagnosis(c.diagnosis, c.aliases ?? []); // lock this diagnosis so it never repeats

        // Best-effort Instagram carousel. Never aborts the Threads flow. A failure
        // here is NOT terminal: because the carousel is keyed off the unset
        // `igPostedAt` (see the dedicated stage below), a later run retries it
        // independently of the now-completed challenge stage.
        if (config.instagram) {
          await tryPublishCarousel(c, generated.igCaption!, state);
        }

        // mirror stages into case.json for review
        c.stages = state.getStages(c.folder);
        saveCase(c);
      }
      continue; // one stage per case per run
    }

    // From here on the case has a challenge posted; refresh the local view.
    const challengePostedAt = new Date(stages.challengePostedAt);
    const generated = c.generated ?? {};

    // --- Stage 1b: retry the Instagram carousel ----------------------------------------
    // The carousel in Stage 1 is best-effort and that stage never re-runs once
    // `challengePostedAt` is set, so a transient IG outage would otherwise drop the
    // carousel forever. Retry here on subsequent runs while IG is enabled and not yet
    // posted; gated independently of the (already-completed) challenge stage.
    // IMPORTANT: do NOT block the answer/CTA stages on IG. A retry only consumes the
    // one-stage-per-run budget (`continue`) when it actually publishes this run; on a
    // failed retry (or in dry-run) we fall through so the answer/CTA still proceed.
    if (cli.mode !== "dry-run" && config.instagram && !stages.igPostedAt) {
      await tryPublishCarousel(c, generated.igCaption ?? (await generateIgCaption(c)), state);
      if (state.getStages(c.folder).igPostedAt) {
        c.stages = state.getStages(c.folder);
        saveCase(c);
        continue; // published this run — that's this case's stage for the run
      }
      // else: IG still failing; fall through so the answer/CTA aren't held hostage.
    }

    // --- Stage 2: pinned answer ---------------------------------------------------------
    const answerDue =
      now.getTime() >= challengePostedAt.getTime() + config.answerDelayMin * MINUTE_MS;

    if (answerDue && !stages.answerPostedAt) {
      const answerText = generated.threadsAnswer ?? (await generateThreadsAnswer(c));

      if (cli.mode === "dry-run") {
        log(`\n[dry-run] would post ANSWER reply for ${c.folder}:`);
        log(answerText);
        log("  Now pin the answer in the app.");
      } else {
        if (!stages.threadsPostId) {
          log(`  skip ANSWER for ${c.folder}: missing threadsPostId in state`);
          continue;
        }
        const answerCommentId = await reply(stages.threadsPostId, answerText);
        state.setStages(c.folder, {
          answerCommentId,
          answerPostedAt: new Date().toISOString(),
        });
        c.stages = state.getStages(c.folder);
        saveCase(c);
        log(`posted ANSWER for ${c.folder} -> ${answerCommentId}`);
        log("  Now pin the answer in the app.");
      }
      continue;
    }

    // --- Stage 3: CTA sub-reply ---------------------------------------------------------
    const ctaDue =
      now.getTime() >= challengePostedAt.getTime() + config.ctaDelayMin * MINUTE_MS;

    if (ctaDue && stages.answerPostedAt && !stages.ctaPostedAt) {
      const ctaText = generated.ctaText ?? pickCta(c).text;

      if (cli.mode === "dry-run") {
        log(`\n[dry-run] would post CTA reply for ${c.folder}:`);
        log(ctaText);
      } else {
        if (!stages.answerCommentId) {
          log(`  skip CTA for ${c.folder}: missing answerCommentId in state`);
          continue;
        }
        await reply(stages.answerCommentId, ctaText);
        state.setStages(c.folder, { ctaPostedAt: new Date().toISOString() });
        c.stages = state.getStages(c.folder);
        saveCase(c);
        log(`posted CTA for ${c.folder}`);
      }
    }
  }

  log("done.");
}

/**
 * Best-effort IG carousel publish. On success records igMediaId + igPostedAt; on
 * failure logs and returns without throwing, leaving igPostedAt unset so a later run
 * retries (see Stage 1b). Never aborts the Threads flow.
 */
async function tryPublishCarousel(c: Case, igCaption: string, state: State): Promise<void> {
  try {
    const igMediaId = await publishCarousel(
      c.igSlides.map((f) => imageUrl(c.folder, f)),
      igCaption,
    );
    state.setStages(c.folder, {
      igMediaId,
      igPostedAt: new Date().toISOString(),
    });
    log(`  cross-posted IG carousel for ${c.folder} -> ${igMediaId}`);
  } catch (err) {
    log(`  IG carousel failed for ${c.folder} (will retry next run): ${errMsg(err)}`);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv);
  if (cli.mode === "prompt") {
    await runPrompt(cli);
  } else {
    await runPublish(cli);
  }
}

main().catch((err) => {
  console.error(errMsg(err));
  process.exit(1);
});
