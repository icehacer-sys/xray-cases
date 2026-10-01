# Publisher operations

The active pipeline publishes one educational X-ray challenge per Cairo night at 22:00 local time, then its answer and optional CTA. Cairo daylight saving changes the UTC slot. The workflow polls about every five minutes, plus processing time. Instagram and Facebook are disabled in the active workflow.

## Check the next cases

Run `npm run queue:check`. This reads local case files, state and approval hashes without API calls or publication. It prints every unposted case, date and hold reason. Pull main first when comparing with production. A local report cannot prove the public GitHub asset has propagated; the publisher separately verifies the public image bytes before creating a post.

Generated cases need an image verdict matching the final bytes and diagnostic inputs, a copy review matching the current content, and no `needsReview` hold. The first image read receives neither the answer nor the clinical vignette. The second assessment receives the vignette so it can judge the most likely answer in context. New approvals hash that vignette too, so changing it requires renewed review. Earlier image-only approvals remain valid because their assessments did not use this added context. Auto-approval never bypasses these checks. Legacy manual cases retain their explicit manual workflow and are not certified by these generated-case gates.

## Repair a hold

1. Inspect the final image and all case copy. Update the case's condition sources and review date after checking relevant references. Correct unsupported claims, visible anatomy, spoilers and grammar.
2. Image regeneration invalidates approval before changing the asset. Inspect the candidate. The required observations must describe visible evidence, including counts and declared anatomical exceptions.
3. Run `npm run queue:review -- --case=CASE_FOLDER` to send the final image and copy to the configured Anthropic API. This bills API usage and writes either approvals or an explicit hold. It does not publish.
4. Run `npm run queue:check`, commit the reviewed image and case together, and push main. Never clear a hold flag alone to bypass a failed review.

`npm run prompt` prints the canonical prompt for the next unposted case. Draft/dry modes can call paid APIs and write drafts. `generate -- --topup --threads-only` also bills image/caption/QA calls and writes files. Only source-reviewed, unused conditions are selected. A failed condition is not retried repeatedly in the same invocation. The unused condition pool was source-checked on 2026-09-10; generated outputs still need their own final QA.

## Recover publishing

The publisher persists a container receipt and checkpoints state to Git before publishing. If persistence fails it exits with code 4 and stops new writes. Other stage errors return nonzero after independent work is handled. Git sync must succeed before a normal runner handoff.

Preserve pending receipts. After an uncertain response, reuse or reconcile the existing container. A confirmed public post whose media ID cannot be recovered remains held. Do not delete a receipt or create a replacement until its remote outcome has been established. Changed copy, image or parent cannot reuse an unpublished container. Consult the failed run's recovery artifact if local state did not reach Git.

Ready cases are compacted into consecutive free nightly slots. Held cases do not consume a slot. An uncertain container reserves its slot; overdue cases cannot all become new challenges in one night. Answers and CTAs remain tied to their actual challenge publication and saved delay assignment.

## Costs, tokens and experiments

`data/usage.jsonl` records provider usage for image, caption and QA stages separately from the reply bot. It contains usage metadata, not prompts, images or credentials. Raw provider usage is not a dollar invoice or a system-wide spending ceiling. Provider billing remains the source of actual charges.

The token watchdog validates identity and expiry, refreshes when due, and must store the replacement in both repositories. Missing expiry, missing permissions, insufficient lifetime, or a failed secret write fails the job. Check both repository secrets after a partial update; do not paste tokens into logs. No health check can guarantee that credentials will never expire.

Challenge state saves the experiment assignment, model/prompt version, actual caption and intended delays. `npm run metrics` reads post insights and saves timestamped exposure samples, at most once per case every six hours. The publisher workflow runs it before handoff. Metrics may be unavailable; account-wide follower deltas do not establish case-level causation or gross follows.

## Configuration and verification

See [runtime-config.md](docs/runtime-config.md), generated from tracked declarations and workflow overrides. Regenerate using `npm run runtime:summary -- --write` when changing settings. It does not reveal local or GitHub secrets. The workflow's date-based answer/follow assignments are frozen when a challenge is first prepared.

Offline checks: `npm run typecheck`, `npm run publishing:verify`, `npm run audit:verify`, and `node tools/verify-token-health.mjs`. Fixtures mock external calls. A passing vision model review is not a radiologist sign-off and cannot guarantee every generated detail is correct.

Companion service: [threads-bot](https://github.com/icehacer-sys/threads-bot).

## Public-copy punctuation (owner, 2026-09-30)

Use an Oxford comma in genuine lists of three or more items: "A patient with persistent wrist pain, stiffness, and a weakening grip." Keep two-item pairs and ordinary clauses unchanged. Do not insert commas into URLs. The established challenge, titled spoiler answer, and separate verbatim CTA format remains; case openings use neutral "A patient with" vignettes rather than claiming an actual encounter.

The offline serial-list check reports clear short phrase lists for a local rewrite; it never edits copy automatically. Complex or ambiguous grammar still needs local Codex/Claude review. A guard failure must not trigger a paid redraft or review without owner authorization. Run `npm run copy:verify`. Existing cached public copy also goes through the readiness check. No historical case, queue hold, receipt, image or provider is changed by this rule.

## Active Hopital Challenge CTA pins (owner, 2026-10-01)

The `challenge` CTA key is separate from `hopital` (the older free pack). The Challenge product, public destination, checkout, and look/guess/reveal mechanics were confirmed live on October 1. The owner authorized activation: the unposted October 2, 4, and 6 cases are pinned to Challenge; October 1, 3, 5, and 7 retain the corrected card-game CTA. Challenge stays excluded from automatic rotation.

Before any later CTA change, check exact fresh case/state receipts for the target. Stop on a created or uncertain CTA receipt; never overwrite its recorded parameters or replay a published CTA. Update `cta`, cached `generated.ctaText` and the hash-bound local content review together. Preserve images, image approvals, descriptions, answers, times, historical holds and state. The CTA remains a separate TEXT reply with a last-line bare domain for `link_attachment`; preview display is best-effort.
