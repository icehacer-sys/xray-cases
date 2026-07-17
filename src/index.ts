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
  generateSeedComment,
  draftEngagement,
  pickCta,
  imagePrompt,
} from "./captions.js";
import { postImage, reply, getReplies, getMyUsername, type SpoilerEntity } from "./threads.js";
import { publishCarousel } from "./instagram.js";
import { postPhoto, postComment } from "./facebook.js";
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

  // Draft the engagement fields (difficulty / layperson question / seed hint) before rendering
  // the caption, so numbering, the layperson line, and the first-comment seed are all populated
  // together. Skipped when they already exist (backfilled + generator-drafted cases carry them).
  if (c.difficulty == null || c.laypersonQuestion == null || c.seedHint == null) {
    const e = await draftEngagement(c);
    c.difficulty ??= e.difficulty;
    c.laypersonQuestion ??= e.laypersonQuestion;
    c.seedHint ??= e.seedHint;
  }

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
    // Per-case isolation: one poisoned case (a deleted post, a 404 image URL, an owner-edited
    // answer over 500 chars) must NEVER abort the whole run — otherwise it crash-loops every
    // poll and today's due case never posts. Log it and carry on to the next case.
    try {
    const postAt = new Date(c.postAt);
    const dueNow = postAt.getTime() <= now.getTime();
    // Dry-run is a preview tool: draft (and show) captions for any upcoming case,
    // regardless of how far out postAt is. Live mode only drafts within ~24h.
    const draftAhead =
      !dueNow &&
      (cli.mode === "dry-run" || postAt.getTime() - now.getTime() <= DRAFT_AHEAD_MS);
    let stages = state.getStages(c.folder);

    // Reconcile ORPHANED state: if the case's own case.json records a posted challenge but central
    // state.json has no entry for this folder, trust the case file and backfill central state
    // instead of treating the case as brand-new. This happens when a case FOLDER IS RENAMED (its
    // state key is keyed by folder name, so the rename orphans the old entry) — which caused the
    // 00013->00059 mediastinal-teratoma REPOST on 2026-07-15 after a numbering-fix rename. Guard:
    // never in dry-run (keep it a pure preview), and only backfill, never re-post.
    if (cli.mode !== "dry-run" && c.stages?.challengePostedAt && !stages.challengePostedAt) {
      log(
        `  reconciled orphaned state for ${c.folder}: case.json shows it already posted ` +
          `(${c.stages.challengePostedAt}) but central state was empty — backfilling, NOT reposting`,
      );
      stages = state.setStages(c.folder, c.stages);
    }

    // --- Draft-ahead: case is upcoming (within the draft window) but not yet due --------
    if (draftAhead && !stages.challengePostedAt) {
      const generated = await ensureGenerated(c, state);
      if (cli.mode === "dry-run") {
        log(`\n[dry-run] upcoming CHALLENGE for ${c.folder} (postAt ${c.postAt}):`);
        log(`  image: ${imageUrl(c.folder, c.threadsImage)}`);
        log(generated.threadsCaption);
      }

      // Facebook gets the challenge a few minutes BEFORE Threads (early access for FB
      // followers). Fires once, in the window [postAt - fbLeadMin, postAt), and only after
      // passing the same review/approval/dedup gates as Threads. It does NOT lock the
      // diagnosis — Threads still owns that when it posts the challenge at postAt.
      if (
        cli.mode !== "dry-run" &&
        config.facebook &&
        config.fbLeadMin > 0 &&
        !stages.fbPostedAt &&
        now.getTime() >= postAt.getTime() - config.fbLeadMin * MINUTE_MS &&
        !challengeBlockReason(c)
      ) {
        await tryPostFacebook(c, generated.threadsCaption!, state);
        c.stages = state.getStages(c.folder);
        saveCase(c);
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
      // Hard block: a generated X-ray that failed anatomy QA must NOT auto-post, even with
      // BOT_AUTO_APPROVE on. The owner regenerates the image and clears needsReview.
      // Review + approval + dedup gates, shared with the early Facebook cross-post (see
      // challengeBlockReason) so FB never publishes something Threads wouldn't.
      const block = challengeBlockReason(c);
      if (block) {
        log(block);
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
        if (config.instagram && c.igSlides?.length) {
          await tryPublishCarousel(c, generated.igCaption!, state);
        }

        // Best-effort Facebook Page photo — unless it already went out early (fbLeadMin).
        // Same non-blocking contract as IG: keyed off the unset `fbPostedAt`, a failure
        // here is retried by the dedicated stage below.
        if (config.facebook && !stages.fbPostedAt) {
          await tryPostFacebook(c, generated.threadsCaption!, state);
        }

        // mirror stages into case.json for review
        c.stages = state.getStages(c.folder);
        saveCase(c);

        // Instant seed comment: the author's first reply, dropped seconds after the case posts,
        // to manufacture the early-window reply velocity Threads uses to decide reach and to break
        // the empty-thread freeze (nobody wants to be the first guesser). Best-effort and posted
        // ONCE in this same run — seeding only helps in the first minutes, so a failure is not
        // retried late. A substantive hint (not "comment below") stays clear of Meta's bait demotion.
        if (config.seedComment && !state.getStages(c.folder).seedPostedAt) {
          const seedText = generateSeedComment(c);
          if (seedText) {
            try {
              const seedCommentId = await reply(threadsPostId, seedText);
              state.setStages(c.folder, { seedCommentId, seedPostedAt: new Date().toISOString() });
              c.stages = state.getStages(c.folder);
              saveCase(c);
              log(`  seeded first comment for ${c.folder} -> ${seedCommentId}`);
            } catch (err) {
              log(`  seed comment failed for ${c.folder} (skipped — seeding is early-window only): ${errMsg(err)}`);
            }
          }
        }
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
    if (cli.mode !== "dry-run" && config.instagram && c.igSlides?.length && !stages.igPostedAt) {
      await tryPublishCarousel(c, generated.igCaption ?? (await generateIgCaption(c)), state);
      if (state.getStages(c.folder).igPostedAt) {
        c.stages = state.getStages(c.folder);
        saveCase(c);
        continue; // published this run — that's this case's stage for the run
      }
      // else: IG still failing; fall through so the answer/CTA aren't held hostage.
    }

    // --- Stage 1c: retry the Facebook photo --------------------------------------------
    // Same rationale as Stage 1b: the Stage-1 FB post is best-effort and never re-runs, so
    // retry here while enabled and not yet posted. Never blocks the answer/CTA stages.
    if (
      cli.mode !== "dry-run" &&
      config.facebook &&
      !stages.fbPostedAt &&
      now.getTime() - challengePostedAt.getTime() < config.fbBackfillHours * 3_600_000
    ) {
      // Fall back to a freshly-built caption if the drafted one is missing (mirrors the IG retry),
      // so a lost case.json `generated` block doesn't silently drop the FB post forever.
      await tryPostFacebook(c, generated.threadsCaption ?? generateThreadsCaption(c), state);
      if (state.getStages(c.folder).fbPostedAt) {
        c.stages = state.getStages(c.folder);
        saveCase(c);
        continue; // published this run — that's this case's stage for the run
      }
    }

    // --- Stage 1d: Facebook answer comment ----------------------------------------------
    // The FB mirror of the Threads pinned answer: ~answerDelayMin after the FB PHOTO posted
    // (fbPostedAt, NOT challengePostedAt — with fbLeadMin the photo goes out early, so FB
    // followers get the early reveal too). Best-effort like 1b/1c but it NEVER consumes the
    // one-stage-per-run budget (no `continue`): with fbLeadMin=0 this and the Threads answer
    // come due in the same run, and the Threads answer must not slip a poll. fbBackfillHours
    // guards the historical catalog from getting an answer comment burst on first deploy.
    if (
      cli.mode !== "dry-run" &&
      config.facebook &&
      config.fbAnswer &&
      stages.fbPostedAt &&
      stages.fbPostId &&
      !stages.fbAnswerPostedAt &&
      now.getTime() >= new Date(stages.fbPostedAt).getTime() + config.answerDelayMin * MINUTE_MS &&
      now.getTime() - new Date(stages.fbPostedAt).getTime() < config.fbBackfillHours * 3_600_000
    ) {
      await tryPostFacebookAnswer(c, state);
      // fall through — Stage 2 (Threads answer) may be due in this same run
    }

    // --- Stage 2: pinned answer ---------------------------------------------------------
    const answerDue =
      now.getTime() >= challengePostedAt.getTime() + config.answerDelayMin * MINUTE_MS;

    if (answerDue && !stages.answerPostedAt) {
      const answerText = generated.threadsAnswer ?? (await generateThreadsAnswer(c));

      if (cli.mode === "dry-run") {
        log(`\n[dry-run] would post ANSWER reply (${answerText.length} chars) for ${c.folder}:`);
        log(answerText);
        log("  Now pin the answer in the app.");
      } else {
        if (!stages.threadsPostId) {
          log(`  skip ANSWER for ${c.folder}: missing threadsPostId in state`);
          continue;
        }
        // ONE reply (<=500 chars), with the diagnosis + breakdown blurred as a spoiler.
        const answerCommentId = await reply(stages.threadsPostId, answerText, answerSpoiler(answerText));
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

    if (config.ctaReply && ctaDue && stages.answerPostedAt && !stages.ctaPostedAt) {
      const ctaText = generated.ctaText ?? pickCta(c).text;

      if (cli.mode === "dry-run") {
        log(`\n[dry-run] would post CTA reply for ${c.folder}:`);
        log(ctaText);
      } else {
        // Thread the CTA under the LIVE "Answer:" comment. The owner may have deleted the
        // bot's answer and posted/pinned their own, so prefer the answer comment currently
        // on the post; then the stored answer id; and if neither can be found (owner rewrote
        // the answer without the "Answer:" prefix, or it was deleted) fall back to the
        // challenge post itself so a CTA STILL lands every night rather than silently skipping.
        const liveAnswerId = stages.threadsPostId ? await findOwnerAnswerComment(stages.threadsPostId) : null;
        const target = liveAnswerId ?? stages.answerCommentId ?? stages.threadsPostId;
        if (!target) {
          log(`  skip CTA for ${c.folder}: no challenge post to thread under`);
          continue;
        }
        const targetKind = liveAnswerId
          ? "live answer"
          : target === stages.answerCommentId
            ? "stored answer"
            : "challenge post (no answer comment found)";
        // Derive the full https:// URL from the bare domain on the CTA's last line so Threads
        // renders a link-preview card (link_attachment). The URL also stays in the text as a
        // fallback auto-preview if link_attachment is ignored on a reply.
        const domain = ctaText.trim().split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
        const linkAttachment = /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(domain) ? `https://${domain}` : undefined;
        await reply(target, ctaText, undefined, linkAttachment);
        state.setStages(c.folder, { ctaPostedAt: new Date().toISOString() });
        c.stages = state.getStages(c.folder);
        saveCase(c);
        log(`posted CTA for ${c.folder} under ${target} (${targetKind})`);
      }
    }
    } catch (err) {
      log(`  ⚠ case ${c.folder} failed this run (isolated — will retry next run): ${errMsg(err)}`);
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

/**
 * Reasons a challenge must NOT publish yet: failed X-ray QA (needsReview), a generated
 * case awaiting approval, or a diagnosis already used. Returns a ready-to-log message, or
 * null if it's clear to post. Shared by the Threads challenge (Stage 1) and the early
 * Facebook cross-post so Facebook never bypasses these gates.
 */
function challengeBlockReason(c: Case): string | null {
  if (c.needsReview === true) {
    return `needs manual review (failed X-ray QA): ${c.folder} — ${(c.verifyDefects ?? []).join("; ")}`;
  }
  if (c.source === "generated" && !(c.approved === true || config.autoApprove)) {
    return `awaiting approval: ${c.folder}`;
  }
  // forceRepeat: an explicit owner override for a deliberate one-off (e.g. a diagnosis already
  // covered once, now paired with a brand-new product promo) — never set by the auto-generator.
  if (!c.forceRepeat && isUsedDiagnosis(loadUsedDiagnoses(), c.diagnosis, c.aliases ?? [])) {
    return `duplicate diagnosis, skipping ${c.folder} ("${c.diagnosis}" already used)`;
  }
  return null;
}

/**
 * Best-effort Facebook Page photo. On success records fbPostId + fbPostedAt; on failure
 * logs and returns without throwing, leaving fbPostedAt unset so a later run retries
 * (see Stage 1c). Never aborts the Threads flow.
 */
async function tryPostFacebook(c: Case, caption: string, state: State): Promise<void> {
  try {
    const fbPostId = await postPhoto(imageUrl(c.folder, c.threadsImage), caption);
    state.setStages(c.folder, {
      fbPostId,
      fbPostedAt: new Date().toISOString(),
    });
    log(`  cross-posted Facebook photo for ${c.folder} -> ${fbPostId}`);
  } catch (err) {
    log(`  Facebook post failed for ${c.folder} (will retry next run): ${errMsg(err)}`);
  }
}

// Lead-in above the FB answer so the diagnosis never shows in the feed's top-comment snippet
// (FB has no spoiler entity; the reveal lives one tap away on the post page).
const FB_ANSWER_LEAD = "ANSWER below 👇 no peeking if you're still guessing 👀";

/**
 * Best-effort Facebook answer comment — the FB mirror of the Threads pinned answer (Stage 2),
 * reusing the SAME generated.threadsAnswer text. On success records fbAnswerCommentId +
 * fbAnswerPostedAt; on failure logs and returns without throwing, leaving fbAnswerPostedAt
 * unset so a later run retries (see Stage 1d). Never aborts the Threads flow.
 */
async function tryPostFacebookAnswer(c: Case, state: State): Promise<void> {
  const stages = state.getStages(c.folder);
  if (!stages.fbPostId) return; // photo id never recorded — nothing to comment on
  try {
    const answerText = c.generated?.threadsAnswer ?? (await generateThreadsAnswer(c));
    const fbAnswerCommentId = await postComment(stages.fbPostId, `${FB_ANSWER_LEAD}\n\n${answerText}`);
    state.setStages(c.folder, {
      fbAnswerCommentId,
      fbAnswerPostedAt: new Date().toISOString(),
    });
    c.stages = state.getStages(c.folder);
    saveCase(c);
    log(`  commented Facebook ANSWER for ${c.folder} -> ${fbAnswerCommentId}`);
  } catch (err) {
    log(`  Facebook answer comment failed for ${c.folder} (will retry next run): ${errMsg(err)}`);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Blur everything after the "Answer:" label so the diagnosis + breakdown are a spoiler.
function answerSpoiler(text: string): SpoilerEntity[] {
  const m = text.match(/^\s*answer\s*:\s*/i);
  const offset = m ? m[0].length : 0;
  const length = text.length - offset;
  return length > 0 ? [{ entity_type: "SPOILER", offset, length }] : [];
}

// Find the LIVE "Answer:" comment on a post (the owner may have deleted the bot's answer
// and posted/pinned their own). Best-effort; returns null on any failure.
async function findOwnerAnswerComment(postId: string): Promise<string | null> {
  try {
    const me = await getMyUsername();
    const replies = await getReplies(postId);
    const ans = replies.find((r) => (!me || r.username === me) && /^\s*answer\s*:/i.test(r.text ?? ""));
    return ans?.id ?? null;
  } catch {
    return null;
  }
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
