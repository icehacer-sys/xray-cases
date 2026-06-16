# xray-case-poster

Daily X-ray **case publisher** for @mdnoteslab. It takes a queued case (a real diagnosis plus
the AI-generated illustrations you create in ChatGPT, hosted as GitHub raw URLs), auto-writes the
captions in the account's exact voice, posts the challenge to Threads, schedules the pinned answer
and the CTA, and cross-posts a carousel to Instagram.

This tool never renders images. It only assembles text, schedules, and posts the images you supply.

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

In the cloud, a GitHub Actions workflow loops `npm run live` every ~15 minutes, commits the updated
`state.json` and any updated `case.json` back to the repo, and dispatches a fresh run before the job
time limit.

---

## Cases and images

Each case is a folder under `cases/` containing a `case.json` and the image files it references:

```
cases/
  00001-giant-gallstone/
    case.json
    xray.jpg        # the Threads challenge X-ray
    question.jpg    # IG carousel slide A
    answer.jpg      # IG carousel slide B
    cta.jpg         # IG carousel slide C
```

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

### AI-generated illustrations — label them

The X-rays are **AI-generated illustrations** you create in ChatGPT, not real patient scans. The
image prompt (`npm run prompt`) asks ChatGPT to add a small **"AI-generated illustration"** tag in a
corner, and the Instagram caption ends with **"Educational entertainment only. Not medical advice."**
Keep both — label the images as AI-generated and keep the not-medical-advice disclaimer in place.

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
  "threadsImage": "xray.jpg",                          // the Threads challenge X-ray
  "igSlides": ["question.jpg", "answer.jpg", "cta.jpg"], // ordered IG carousel images

  // --- scheduling ---
  "postAt": "2026-06-20T18:00:00Z",         // ISO datetime to publish the challenge
  "cta": "vol2"                             // optional: which CTA to use; rotates if absent
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
npm run prompt            # print the ChatGPT X-ray image prompt for the next undrafted case
npm run prompt -- <folder> # print the image prompt for a specific case folder
npm run dry               # generate + print captions, save drafts to case.json, post NOTHING
npm run live              # actually post (requires BOT_CONFIRM_LIVE=yes)
npm run typecheck         # tsc --noEmit
```

- **`prompt`** assembles the ChatGPT image prompt for a case so you can paste it into ChatGPT,
  generate the illustration, and drop the file into the case folder. No API tokens needed beyond the
  Anthropic key.
- **`dry`** drafts and prints every due/upcoming case's captions and writes them into `case.json` so
  you can review and edit, but posts nothing.
- **`live`** posts for real. It is gated by the `BOT_CONFIRM_LIVE=yes` safety latch — without it,
  live mode refuses to post.

---

## One-time setup

1. **Make the repo public** so the raw image URLs are fetchable by Meta.
2. **Local `.env`** — copy `.env.example` to `.env` and fill it in (`.env` is gitignored; never commit
   real tokens):
   - `ANTHROPIC_API_KEY` — for caption drafting.
   - `THREADS_ACCESS_TOKEN` — long-lived Threads token for @mdnoteslab (reuse the one from the
     Threads reply bot).
   - `IG_ACCESS_TOKEN` — long-lived Instagram token for @mdnoteslab (reuse the one from the IG bot).
   - `GITHUB_RAW_BASE` — `https://raw.githubusercontent.com/<user>/<repo>/<branch>` for this repo.
   - Optional tuning: `BOT_MODEL`, `BOT_ANSWER_DELAY_MIN`, `BOT_CTA_DELAY_MIN`, `BOT_ACTIVE_TZ`,
     `BOT_INSTAGRAM`, and `BOT_CONFIRM_LIVE` (must equal `yes` to post live).
3. **GitHub Actions secrets** (for the cloud schedule, under repo Settings → Secrets and variables →
   Actions):
   - `ANTHROPIC_API_KEY`
   - `THREADS_ACCESS_TOKEN`
   - `IG_ACCESS_TOKEN`

   The workflow (`.github/workflows/publish.yml`) supplies the rest as plain env:
   `GITHUB_RAW_BASE`, `BOT_CONFIRM_LIVE=yes`, `BOT_INSTAGRAM=on`, and `BOT_MODEL`. It needs
   `permissions: contents: write, actions: write` so it can commit `state.json` / `case.json` and
   dispatch the next run.

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
  index.ts       # orchestrator + CLI (--dry-run / --live / --prompt)
cases/           # one folder per case: case.json + image files
state.json       # posting progress (committed by CI)
```
