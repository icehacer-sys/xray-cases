# Runtime configuration

Generated from tracked source. This does not read or print credentials, local .env values, or GitHub secrets. Workflow overrides take precedence over defaults. Shell assignments are listed as source expressions, not evaluated values.

## Configuration declarations

```ts
model: process.env.BOT_MODEL ?? "claude-sonnet-4-6",
answerDelayMin: num("BOT_ANSWER_DELAY_MIN", 45),
ctaDelayMin: num("BOT_CTA_DELAY_MIN", 100),
caseNumberOffset: num("BOT_CASE_NUMBER_OFFSET", 0),
seedComment: (process.env.BOT_SEED_COMMENT ?? "off").toLowerCase() === "on",
answerMaxChars: num("BOT_ANSWER_MAX_CHARS", 500),
followCta: (process.env.BOT_FOLLOW_CTA ?? "off").toLowerCase() === "on",
hookAlt: (process.env.BOT_HOOK_ALT ?? "off").toLowerCase() === "on",
captionMaxChars: num("BOT_CAPTION_MAX_CHARS", 500),
activeTz: process.env.BOT_ACTIVE_TZ ?? "Africa/Cairo",
instagram: (process.env.BOT_INSTAGRAM ?? "on").toLowerCase() !== "off",
facebook: (process.env.BOT_FACEBOOK ?? "off").toLowerCase() === "on",
fbLeadMin: num("BOT_FB_LEAD_MIN", 10),
fbBackfillHours: num("BOT_FB_BACKFILL_HOURS", 12),
fbAnswer: (process.env.BOT_FB_ANSWER ?? "on").toLowerCase() !== "off",
ctaReply: (process.env.BOT_CTA_REPLY ?? "off").toLowerCase() === "on",
topicTag: (process.env.BOT_TOPIC_TAG ?? "Med Threads").trim(),
topicTagGraceMin: num("BOT_TOPIC_TAG_GRACE_MIN", 60),
imageModel: process.env.BOT_IMAGE_MODEL ?? "gpt-image-2",
imageSize: process.env.BOT_IMAGE_SIZE ?? "1024x1024",
imageQuality: process.env.BOT_IMAGE_QUALITY ?? "medium",
conditionsFile: process.env.BOT_CONDITIONS_FILE ?? "./data/conditions.json",
queueTarget: num("BOT_QUEUE_TARGET", 7),
postHourUtc: num("BOT_POST_HOUR_UTC", 19),
postHourLocal: num("BOT_POST_HOUR_LOCAL", 22), // converts each date using Cairo DST
autoApprove: (process.env.BOT_AUTO_APPROVE ?? "off").toLowerCase() === "on",
xrayVerify: (process.env.BOT_XRAY_VERIFY ?? "on").toLowerCase() !== "off",
xrayVerifyModel: process.env.BOT_XRAY_VERIFY_MODEL ?? process.env.BOT_MODEL ?? "claude-sonnet-4-6",
xrayMaxAttempts: num("BOT_XRAY_MAX_ATTEMPTS", 3),
censorGenitals: (process.env.BOT_CENSOR_GENITALS ?? "on").toLowerCase() !== "off",
slideSize: num("BOT_SLIDE_SIZE", 1080),
casesDir: process.env.BOT_CASES_DIR ?? "./cases",
stateFile: process.env.BOT_STATE_FILE ?? "./state.json",
confirmLive: (process.env.BOT_CONFIRM_LIVE ?? "").toLowerCase() === "yes",
`BOT_CTA_DELAY_MIN (${config.ctaDelayMin}) must be greater than ` +
`BOT_ANSWER_DELAY_MIN (${config.answerDelayMin}).`,
```

## publish.yml

```text
- cron: "*/30 * * * *" # heartbeat to (re)start the polling loop; the loop does the 15-min cadence
BOT_CONFIRM_LIVE: "yes"
BOT_INSTAGRAM: "off" # IG discontinued -- Threads only (owner, 2026-06-29)
BOT_FACEBOOK: "off" # FB dropped — Threads only (owner deleted the Page over the "AI info" label, 2026-07-03). Off also disables the FB answer-comment (that stage requires BOT_FACEBOOK). Flip to "on" to restore.
BOT_FB_LEAD_MIN: "10" # Facebook gets the challenge ~10 min before Threads (early access for FB followers)
BOT_AUTO_APPROVE: "on" # owner trusts gpt-image-2: generated cases post without manual review
BOT_IMAGE_QUALITY: "high" # realism: high renders far more convincing film texture and age-appropriate bone detail than medium (~4x cost per image, still cents)
BOT_XRAY_VERIFY: "on" # Claude vision checks each generated X-ray for AI anatomy defects; failures are regenerated or held for review
BOT_CENSOR_GENITALS: "on" # blur external genitalia on the X-ray + slides so Threads/IG don't flag the post as sensitive
BOT_TOPIC_TAG: "Med Threads" # topic tag added to every challenge post (files it under the community)
BOT_TOPIC_TAG_GRACE_MIN: "60" # keep retrying for the tag this long past postAt before accepting an untagged post
BOT_POST_HOUR_LOCAL: "22" # local Cairo time; each date is converted with IANA DST rules
BOT_ANSWER_DELAY_MIN: "20" # answer posts 20 min after the challenge (reverted from 45 on 2026-07-04)
BOT_CTA_DELAY_MIN: "75" # CTA 55 min after the answer (75 after the challenge)
BOT_SEED_COMMENT: "off" # 60-sec author seed comment DISABLED (owner, 2026-07-04 — did not help; classic style only)
BOT_CASE_NUMBER_OFFSET: "39" # unused now that the caption reverted to the classic format (no "Case #N"); kept for reference only
BOT_CTA_REPLY: "on" # auto-post the CTA under the pinned answer WITH a working link-preview card (verified 2026-07-07: link_attachment renders on a reply). The CTA stage passes link_attachment so the Gumroad cover shows.
BOT_MODEL: "claude-sonnet-4-6"
echo "rebase failed (attempt $attempt/3), retrying in 3s"; sleep 3; continue
echo "push failed (attempt $attempt/3), retrying in 3s"; sleep 3
export BOT_ANSWER_DELAY_MIN=20 BOT_CTA_DELAY_MIN=75; arm=A
export BOT_ANSWER_DELAY_MIN=90 BOT_CTA_DELAY_MIN=145; arm=B
export BOT_FOLLOW_CTA=off; fcta=A
export BOT_FOLLOW_CTA=on; fcta=B
sleep 300
```

## token-health.yml

```text
- cron: "0 6 * * *" # daily 06:00 UTC, well before the 19:00 posting window
```
