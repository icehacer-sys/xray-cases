// Central config. Loads ../.env regardless of cwd. Secrets are read lazily via
// requireEnv() so --prompt mode (which only needs the Anthropic key) works without
// the Threads/Instagram tokens.

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  model: process.env.BOT_MODEL ?? "claude-sonnet-4-6",

  // API hosts (pinned versions)
  threadsBase: "https://graph.threads.net/v1.0",
  igBase: process.env.IG_GRAPH_BASE ?? "https://graph.instagram.com/v21.0",
  fbBase: process.env.FB_GRAPH_BASE ?? "https://graph.facebook.com/v21.0",
  threadsUserId: process.env.THREADS_USER_ID ?? "me",

  // Public base for image URLs (see .env.example). Trailing slash trimmed.
  githubRawBase: (process.env.GITHUB_RAW_BASE ?? "").replace(/\/+$/, ""),

  // Scheduling: minutes after the challenge post to publish the answer / CTA.
  // Answer 45 min after the challenge (moved from 20 on 2026-07-03: a 20-min reveal closed the
  // guessing game inside the ~first-hour window Threads uses to judge reach; 45 keeps the whole
  // window a live game and the answer reply itself re-bumps the thread late in the window).
  answerDelayMin: num("BOT_ANSWER_DELAY_MIN", 45),
  ctaDelayMin: num("BOT_CTA_DELAY_MIN", 100),

  // Public case number = case.number + this offset, so "Case #N" reflects the account's true
  // cumulative post count (the folder numbers are pipeline-internal and far lower). Set via
  // BOT_CASE_NUMBER_OFFSET once the owner's real running total is known.
  caseNumberOffset: num("BOT_CASE_NUMBER_OFFSET", 0),

  // Auto-post the author's first reply (a non-spoiling hint) seconds after the challenge posts,
  // to manufacture the early-window reply velocity Threads ranks on. Off by default; the workflow
  // sets BOT_SEED_COMMENT=on. Substantive hints only (never "comment below" — Meta demotes bait).
  seedComment: (process.env.BOT_SEED_COMMENT ?? "off").toLowerCase() === "on",

  // Threads caps each post/reply at 500 characters. The answer is built to fit ONE reply,
  // dropping lower-priority sections in order (Tx before Why) rather than splitting into a chain.
  answerMaxChars: num("BOT_ANSWER_MAX_CHARS", 500),

  activeTz: process.env.BOT_ACTIVE_TZ ?? "Africa/Cairo",

  // Cross-post to Instagram too (Threads always posts).
  instagram: (process.env.BOT_INSTAGRAM ?? "on").toLowerCase() !== "off",

  // Cross-post the daily challenge photo to the Facebook Page too. Off until a Page token
  // is configured (FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN); flip BOT_FACEBOOK=on to enable.
  facebook: (process.env.BOT_FACEBOOK ?? "off").toLowerCase() === "on",

  // Post the challenge to Facebook this many minutes BEFORE Threads, giving the FB page
  // genuine early access (a real reason to follow it). 0 = post at the same time as Threads.
  fbLeadMin: num("BOT_FB_LEAD_MIN", 10),

  // Only Facebook-post cases whose challenge posted within this many hours. Without this the
  // Stage-1c retry backfills the ENTIRE historical catalog onto a newly-connected Page in one
  // burst (every past Threads case has challengePostedAt set but no fbPostedAt). 12h keeps it
  // to just today's case going forward.
  fbBackfillHours: num("BOT_FB_BACKFILL_HOURS", 12),

  // Comment the answer on the Facebook challenge post ~answerDelayMin after the FB PHOTO
  // posted (the FB mirror of the Threads pinned answer). FB has no spoiler formatting, so a
  // lead-in line hides the diagnosis from the feed's top-comment snippet. On by default; only
  // effective while BOT_FACEBOOK=on. Set BOT_FB_ANSWER=off to disable.
  fbAnswer: (process.env.BOT_FB_ANSWER ?? "on").toLowerCase() !== "off",

  // Auto-post the CTA as a reply under the pinned answer. Off by default: the owner posts
  // the CTA manually so the Gumroad link renders its cover-image preview (a bot sub-reply
  // does not show the preview). Stage 3 is skipped entirely when this is off.
  ctaReply: (process.env.BOT_CTA_REPLY ?? "off").toLowerCase() === "on",

  // Topic tag added to the Threads challenge post (one per post; the account always
  // tags posts with this). Empty = no tag. Periods and ampersands are not allowed.
  topicTag: (process.env.BOT_TOPIC_TAG ?? "Med Threads").trim(),

  // --- auto-generator ---
  // OpenAI image model for the X-ray (the only AI-generated image; slides are rendered).
  imageModel: process.env.BOT_IMAGE_MODEL ?? "gpt-image-2",
  imageSize: process.env.BOT_IMAGE_SIZE ?? "1024x1024",
  // Image quality: low | medium | high | auto. medium is the cost/quality sweet spot
  // (~3-4 cents per X-ray); high is ~4x that. Drives most of the per-image cost.
  imageQuality: process.env.BOT_IMAGE_QUALITY ?? "medium",
  // The vetted condition pool the generator draws from.
  conditionsFile: process.env.BOT_CONDITIONS_FILE ?? "./data/conditions.json",
  // Keep this many approved-or-pending cases queued ahead.
  queueTarget: num("BOT_QUEUE_TARGET", 7),
  // Daily slot (UTC hour) the generator schedules new cases at.
  // 19:00 UTC = 10 PM Cairo (UTC+3), matching the reply bot's 22-10 active window. (Changed from
  // 9 PM to 10 PM on 2026-07-01 by owner request.)
  postHourUtc: num("BOT_POST_HOUR_UTC", 19),
  // Skip the human review gate and post generated cases automatically. Off by default
  // (generated medical images should be eyeballed before they publish).
  autoApprove: (process.env.BOT_AUTO_APPROVE ?? "off").toLowerCase() === "on",

  // X-ray anatomy QA. Before a generated case is queued, a Claude vision pass checks the
  // gpt-image-2 X-ray for AI artifacts (duplicated/extra bones, wrong body part, melted
  // bone). A failed X-ray is regenerated up to xrayMaxAttempts; if it still fails it is
  // queued with needsReview so it NEVER auto-posts. Motivated by the duplicated-scapula
  // Sprengel incident. Set BOT_XRAY_VERIFY=off to disable (not recommended).
  xrayVerify: (process.env.BOT_XRAY_VERIFY ?? "on").toLowerCase() !== "off",
  xrayVerifyModel: process.env.BOT_XRAY_VERIFY_MODEL ?? process.env.BOT_MODEL ?? "claude-sonnet-4-6",
  xrayMaxAttempts: num("BOT_XRAY_MAX_ATTEMPTS", 3),

  // Blur external genitalia on generated images (X-ray + composited slides) so Threads/IG
  // do not flag the post as sensitive/adult. A Claude vision pass locates the region; fails
  // open if nothing is found. Set BOT_CENSOR_GENITALS=off to disable.
  censorGenitals: (process.env.BOT_CENSOR_GENITALS ?? "on").toLowerCase() !== "off",
  // 1080x1080 slide canvas.
  slideSize: num("BOT_SLIDE_SIZE", 1080),

  // Local queue + state
  casesDir: process.env.BOT_CASES_DIR ?? "./cases",
  stateFile: process.env.BOT_STATE_FILE ?? "./state.json",

  // Live posting safety latch
  confirmLive: (process.env.BOT_CONFIRM_LIVE ?? "").toLowerCase() === "yes",
};

// Stage 3 (CTA) is gated on challengePostedAt + ctaDelayMin and Stage 2 (answer) on
// challengePostedAt + answerDelayMin. If ctaDelayMin <= answerDelayMin the CTA becomes
// eligible no later than the answer, collapsing them into adjacent ~15-min loops. Fail
// fast on a reversed/equal config instead of silently posting answer + CTA back-to-back.
if (config.ctaReply && config.ctaDelayMin <= config.answerDelayMin) {
  throw new Error(
    `BOT_CTA_DELAY_MIN (${config.ctaDelayMin}) must be greater than ` +
      `BOT_ANSWER_DELAY_MIN (${config.answerDelayMin}).`,
  );
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return v;
}
