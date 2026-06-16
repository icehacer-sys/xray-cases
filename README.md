# xray-case-poster

Daily X-ray **case publisher** for @mdnoteslab, with a fully automatic case generator. It draws
the next condition from a vetted pool, AI-generates **only the X-ray**, **renders** the three
Instagram slides from a template, drafts the captions in the account's exact voice, then (after a
light human review) posts the challenge to Threads, schedules the pinned answer and the CTA, and
cross-posts a carousel to Instagram — all on a cloud schedule, no PC required.

Only the X-ray is AI-generated; the slides are deterministically rendered (image models garble
slide text).

---

## How it works

A single case moves through a few timed stages. One run (`npm run live`) processes whatever is due
right now, records what it did in `state.json`, and exits. Re-running is safe — recorded stages are
never re-posted.

1. **Challenge** — for each case whose `postAt` has passed and that hasn't been posted yet, the tool
   makes sure the `generated` captions exist (drafting and saving them if needed), posts the Threads
   image challenge, and (if Instagram is enabled) cross-posts the carousel. An Instagram failure is
   logged but never aborts the Threads post.
2. **Answer** — `BOT_ANSWER_DELAY_MIN` minutes after the challenge (default 60), the tool replies to
   the challenge post with the pinned-answer breakdown and logs a reminder to **pin the answer in the
   app** (pinning is manual).
3. **CTA** — `BOT_CTA_DELAY_MIN` minutes after the challenge (default 90), the tool replies under the
   answer with the rotating CTA.

Cases whose `postAt` is in the future but within ~24h get their `generated` drafts written ahead of
time, so you can review and hand-edit the wording in `case.json` before it goes live.

In the cloud, a GitHub Actions workflow tops up the queue once per chain run, then loops
`npm run live` every ~15 minutes, commits the updated `state.json` and any updated `case.json` back
to the repo, and dispatches a fresh run before the job time limit.

---

## Full-auto flow (generate → review → auto-post)

The bot keeps itself stocked from a **vetted condition pool** with no manual image work:

1. **Generate** — `npm run generate` (run with `--topup` on the schedule) picks the next unused
   condition from the pool, builds the X-ray image prompt from its `view` + `keyFindings`,
   **AI-generates the X-ray** (OpenAI image model), **renders** the three IG slides
   (question/answer/CTA) from a template, drafts the captions, and writes a new `cases/<folder>/`
   with `case.json`, `xray.png`, and the three slide PNGs. The new case is queued as
   **`approved: false`** and scheduled for the next open daily slot.
2. **Review** — a human eyeballs the generated X-ray and the vetted facts, then approves the case
   (see the review gate below). This is the only manual step, and it can be skipped entirely with
   `BOT_AUTO_APPROVE=on`.
3. **Auto-post** — once approved, the normal publisher (`npm run live`) posts the challenge at
   `postAt`, then the answer and CTA on their delays, and cross-posts the IG carousel — exactly as
   for a hand-made case.

### The condition pool

The pool lives at **`data/conditions.json`** (override with `BOT_CONDITIONS_FILE`): a JSON array of
`Condition` entries (see `src/types.ts`). Each entry is the **medical source of truth** for one
case — a real, classic "weird but recognizable" imaging diagnosis with accurate radiographic
findings, the four breakdown facts (`whatYouSee`, `whyItMatters`, `treatment`, `takeaway`), the
image-prompt inputs (`view`, `keyFindings`), and the IG question slide content (`igTitle`,
`igOptions`, `igCorrect`). The generator marks an entry `used: true` once it has produced a case
from it, so conditions are never reused.

**To add or vet conditions:** append entries to `data/conditions.json`. Keep the breakdown lines
tight and factual (no invented statistics), make `igOptions` the correct answer plus two
plausible-but-wrong distractors, and point `igCorrect` at the right letter. Because these facts are
fact-checked at review time, accuracy here is what keeps the account trustworthy.

### The review gate

A **generated** case must be approved before the publisher will post its challenge. Until then,
`npm run live` logs `awaiting approval: <folder>` and skips the case without advancing any stage, so
a later run picks it up the moment it's approved. Approve a case either way:

- **Per case** — set `"approved": true` in that case's `case.json`, or
- **Globally** — set `BOT_AUTO_APPROVE=on` (the publisher then posts generated cases without review;
  off by default because AI-generated medical images should be eyeballed first).

Hand-made cases (`source` other than `"generated"`) are unaffected unless you choose to gate them.

---

## Cases and images

Each case is a folder under `cases/` containing a `case.json` and the image files it references:

```
cases/
  00001-giant-gallstone/
    case.json
    xray.png        # the Threads challenge X-ray (AI-generated)
    question.png    # IG carousel slide A (rendered)
    answer.png      # IG carousel slide B (rendered)
    cta.png         # IG carousel slide C (rendered)
```

Generated cases write `.png`; hand-made cases may use any image format the publish APIs accept.

The folder's leading digits set the case number (`00007-foo` becomes Case File 07). Cases are
processed in `postAt` order.

### Image URLs require a public repo

Meta's Threads and Instagram publishing APIs fetch your images by URL, so the image files must be
reachable as **GitHub raw URLs** — which means **this repo must be public**. Each filename in a case
resolves to:

```
<GITHUB_RAW_BASE>/cases/<folder>/<filename>
```

`GITHUB_RAW_BASE` looks like `https://raw.githubusercontent.com/<user>/<repo>/<branch>` (set it in
`.env`; see `.env.example`).

### Illustrations and disclaimer

**Only the X-ray is AI-generated** — it is an illustration, not a real patient scan. The three IG
slides are **rendered** from a template (deterministic text — image models garble slide text), and
they embed the X-ray. The Instagram caption ends with **"Educational entertainment only. Not medical
advice."** Keep that disclaimer in place.

---

## `case.json` schema

You fill the author block; the tool fills `generated` (drafted captions) and `stages` (posting
progress). See `src/types.ts` for the authoritative `Case` contract.

```jsonc
{
  // --- author inputs ---
  "diagnosis": "Giant Gallstone",          // the real answer, e.g. "Giant Gallstone"
  "aliases": ["Cholelithiasis"],            // optional: other acceptable phrasings
  "symptom": "abdominal discomfort",        // "A patient came in with <symptom>."
  "hook": "it looked like someone had hidden a giant pearl inside the abdomen",

  // optional owner-written breakdown facts; if absent the tool drafts them with Claude
  // (review before postAt). All four feed the pinned answer.
  "whatYouSee": "...",
  "whyItMatters": "...",
  "treatment": "...",
  "takeaway": "...",
  "igOptions": ["A. ...", "B. ...", "C. ..."], // optional: the A/B/C shown on your slide image

  // --- images (filenames inside this case folder) ---
  "threadsImage": "xray.png",                          // the Threads challenge X-ray
  "igSlides": ["question.png", "answer.png", "cta.png"], // ordered IG carousel images

  // --- scheduling ---
  "postAt": "2026-06-20T18:00:00Z",         // ISO datetime to publish the challenge
  "cta": "vol2",                            // optional: which CTA to use; rotates if absent

  // --- review gate (set by the auto-generator) ---
  "approved": false,                        // a generated case won't post until this is true
  "source": "generated"                     // "generated" (auto) or "manual" (hand-made)
}
```

`cta` is one of `vol2`, `rare`, `vol1`. If you omit it, the tool rotates through them by case number.

The tool adds two blocks you don't write by hand (but may hand-edit `generated` before `postAt`):

- `generated` — `threadsCaption`, `threadsAnswer`, `igCaption`, `ctaText`.
- `stages` — `challengePostedAt`, `threadsPostId`, `answerPostedAt`, `answerCommentId`,
  `ctaPostedAt`, `igPostedAt`, `igMediaId`.

A complete sample lives at `cases/00001-example/case.json`.

---

## Running it

Requires Node `>=18.17`. Install once:

```bash
npm install
```

Then:

```bash
npm run generate          # auto-generate ONE new case (AI X-ray + rendered slides), approved:false
npm run generate -- --topup    # generate until the queue reaches BOT_QUEUE_TARGET (no-op if full)
npm run generate -- --count N  # generate N cases this run (default 1)
npm run generate -- --mock     # skip the OpenAI call; write a placeholder X-ray (no API key needed)
npm run prompt            # print the X-ray image prompt for the next undrafted case
npm run prompt -- <folder> # print the image prompt for a specific case folder
npm run dry               # generate + print captions, save drafts to case.json, post NOTHING
npm run live              # actually post approved due cases (requires BOT_CONFIRM_LIVE=yes)
npm run typecheck         # tsc --noEmit
```

- **`generate`** draws the next unused condition from `data/conditions.json`, AI-generates the
  X-ray (needs `OPENAI_API_KEY`), renders the three IG slides, drafts captions, and writes a new
  `cases/<folder>/` queued as `approved: false`. Flags:
  - `--topup` keeps `BOT_QUEUE_TARGET` (default 7) approved-or-pending cases queued ahead; this is
    what the cloud schedule runs. It no-ops when the queue is already full.
  - `--count N` generates N cases in one run (default 1).
  - `--mock` writes a placeholder gray X-ray instead of calling OpenAI, so you can test the
    pipeline + slide rendering with no API key.
  After generating, **review** each case and set `"approved": true` (or run the publisher with
  `BOT_AUTO_APPROVE=on`).
- **`prompt`** assembles the X-ray image prompt for a case (the same prompt the generator feeds the
  image model). No API tokens needed beyond the Anthropic key.
- **`dry`** drafts and prints every due/upcoming case's captions and writes them into `case.json` so
  you can review and edit, but posts nothing.
- **`live`** posts for real. It honors the review gate (skips unapproved generated cases, logging
  `awaiting approval: <folder>`) and is gated by the `BOT_CONFIRM_LIVE=yes` safety latch — without
  it, live mode refuses to post.

---

## One-time setup

1. **Make the repo public** so the raw image URLs are fetchable by Meta.
2. **Local `.env`** — copy `.env.example` to `.env` and fill it in (`.env` is gitignored; never commit
   real tokens):
   - `ANTHROPIC_API_KEY` — for caption drafting.
   - `OPENAI_API_KEY` — for AI-generating the X-ray in the auto-generator. Only needed to run
     `npm run generate` for real; `--mock` and the publisher don't use it. Cost is roughly
     **$0.02–$0.04 per X-ray** (one `gpt-image-1` 1024×1024 image per case, set via `BOT_IMAGE_MODEL`
     / `BOT_IMAGE_SIZE`), i.e. only a few cents per day at one case/day.
   - `THREADS_ACCESS_TOKEN` — long-lived Threads token for @mdnoteslab (reuse the one from the
     Threads reply bot).
   - `IG_ACCESS_TOKEN` — long-lived Instagram token for @mdnoteslab (reuse the one from the IG bot).
   - `GITHUB_RAW_BASE` — `https://raw.githubusercontent.com/<user>/<repo>/<branch>` for this repo.
   - Optional tuning: `BOT_MODEL`, `BOT_ANSWER_DELAY_MIN`, `BOT_CTA_DELAY_MIN`, `BOT_ACTIVE_TZ`,
     `BOT_INSTAGRAM`, and `BOT_CONFIRM_LIVE` (must equal `yes` to post live).
3. **GitHub Actions secrets** (for the cloud schedule, under repo Settings → Secrets and variables →
   Actions):
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY` — for the per-run queue top-up (`npm run generate -- --topup`).
   - `THREADS_ACCESS_TOKEN`
   - `IG_ACCESS_TOKEN`

   The workflow (`.github/workflows/publish.yml`) supplies the rest as plain env:
   `GITHUB_RAW_BASE`, `BOT_CONFIRM_LIVE=yes`, `BOT_INSTAGRAM=on`, and `BOT_MODEL`. It leaves
   `BOT_AUTO_APPROVE` unset, so the review gate stays on (generated cases wait for a human to set
   `"approved": true`). Once per chain run it runs the top-up before the publish loop and commits any
   new `cases/**` + `data/conditions.json`. It needs `permissions: contents: write, actions: write`
   so it can commit `state.json` / `case.json` / new cases and dispatch the next run.

### Instagram publishing in development mode

Publishing a carousel to **your own** professional account works in **development mode** with
**Standard Access** — no App Review required. Per Meta's current docs, Standard Access is the
default level granted automatically to every app, and it works self-serve for any account whose
user has a **role on the app** (admin, developer, or tester). The content-publishing endpoints need
the `instagram_business_basic` and `instagram_business_content_publish` permissions, and both list
Standard Access as a valid access level. App Review and **Advanced Access** are only required to
publish on behalf of accounts you do **not** own or manage (i.e. real third-party users without a
role on your app).

What to expect when you run live: as long as @mdnoteslab's professional account is the one tied to
the app (and the account has a role on it), carousels publish fine without submitting for review.
The usual gotchas are the prerequisites, not the access level — the account must be an Instagram
**Professional** (Business or Creator) account, the image URLs must be publicly fetchable (the
public-repo raw URLs above), and you're capped at **100 API-published posts per rolling 24 hours**
(a carousel counts as one). If Instagram rejects a carousel for any reason, the case still posts to
Threads — the failure is logged and the run continues.

Sources: [Overview of the Instagram API](https://developers.facebook.com/docs/instagram-platform/overview/),
[Publish Content using the Instagram Platform](https://developers.facebook.com/docs/instagram-platform/content-publishing/).

---

## Project layout

```
src/
  config.ts      # central config + env loading (requireEnv)
  types.ts       # the Case contract — read this first
  threads.ts     # Threads publishing client (postImage, reply)
  instagram.ts   # Instagram publishing client (publishCarousel, publishImage)
  cases.ts       # queue loader (loadCases, imageUrl, saveCase)
  state.ts       # run state, persisted to state.json
  captions.ts    # caption + answer + IG + CTA + image-prompt generation
  openai.ts      # AI X-ray image generation (generateXray)
  slides.ts      # renders the 3 IG slides from a template (renderSlides)
  generate.ts    # auto-generator orchestrator + CLI (--count / --mock / --topup)
  index.ts       # orchestrator + CLI (--dry-run / --live / --prompt)
data/
  conditions.json # vetted condition pool the generator draws from (source of truth)
cases/           # one folder per case: case.json + image files
state.json       # posting progress (committed by CI)
```
