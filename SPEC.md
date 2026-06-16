# xray-case-poster — build spec

Daily X-ray **case publisher** for @mdnoteslab. Separate from the reply bots. It takes a
queued case (a real diagnosis + the user's AI-generated images, hosted as GitHub raw URLs),
auto-writes the captions in the account's exact voice, posts the challenge, then schedules the
pinned answer and the CTA, and cross-posts a carousel to Instagram.

Project root: `D:\Projects\xray-poster`. Language: TypeScript ESM, run via `tsx`. Read
`src/types.ts` (the `Case` contract) and `src/config.ts` before implementing anything.

The images are **AI-generated illustrations** the user creates in ChatGPT — this tool never
renders images. It only assembles text + schedules + posts the user's supplied images.

---

## Modules to implement (exact exports)

### src/threads.ts — Threads publishing client
- `postImage(imageUrl: string, text: string): Promise<string>` — two-step: `POST {threadsBase}/{threadsUserId}/threads` with `{ media_type: "IMAGE", image_url, text }` → `{id}` (creation id); then `POST .../threads_publish` with `{ creation_id }` → returns the published post id. The publish step can 400 with "media not found" briefly — sleep ~2s then retry up to 4×.
- `reply(replyToId: string, text: string): Promise<string>` — same two-step with `{ media_type: "TEXT", text, reply_to_id: replyToId }`. Returns the reply's id.
- Auth: `Authorization: Bearer ${requireEnv("THREADS_ACCESS_TOKEN")}`. Body is form-encoded.

### src/instagram.ts — Instagram publishing client
- `publishCarousel(imageUrls: string[], caption: string): Promise<string>` — for each url: `POST {igBase}/me/media` with `{ image_url, is_carousel_item: "true" }` → item id. Then `POST {igBase}/me/media` with `{ media_type: "CAROUSEL", children: <ids.join(",")>, caption }` → container id. Poll `GET {igBase}/{containerId}?fields=status_code` until `FINISHED` (max ~5 tries, 2s apart). Then `POST {igBase}/me/media_publish` with `{ creation_id: containerId }` → published media id.
- `publishImage(imageUrl: string, caption: string): Promise<string>` — single image variant (no carousel).
- Auth: `Authorization: Bearer ${requireEnv("IG_ACCESS_TOKEN")}`. JSON or form body is fine; be consistent.
- IG content publishing to your OWN account may or may not work in development mode. Wrap calls so a failure throws a clear Error (the orchestrator catches it and still posts to Threads).

### src/cases.ts — queue loader
- `loadCases(): Case[]` — read every `cases/*/case.json`, set `.folder` to the directory name, sort by `postAt` ascending. Assign `.number` from the folder's leading digits (e.g. `00007-foo` → 7) or sequential order.
- `imageUrl(folder: string, filename: string): string` — `${config.githubRawBase}/cases/${folder}/${filename}`.
- `saveCase(c: Case): void` — write the case back to `cases/${c.folder}/case.json` (pretty JSON), so `generated` drafts persist for the user to review/edit.

### src/state.ts — central run state
- A `State` class backed by `config.stateFile` (JSON). Tracks per-case `stages` (see `Case.stages`) so a restart never double-posts. Methods: `getStages(folder)`, `setStages(folder, partial)`, plus a daily/total counter if useful. Mirror the simple style of the reply bots' state.ts.

### src/captions.ts — text generation (Anthropic SDK + deterministic templates)
- `generateThreadsCaption(c: Case): string` — DETERMINISTIC, exact format (see below).
- `generateThreadsAnswer(c: Case): Promise<string>` — uses `c.whatYouSee/whyItMatters/treatment/takeaway` if present; otherwise drafts each from `c.diagnosis` with one Claude call (model `config.model`), then formats EXACTLY as below. Keep each line tight and accurate; never invent specifics beyond well-known facts about the named condition.
- `generateIgCaption(c: Case): Promise<string>` — drafts a 2–3 line case hook from the diagnosis with Claude, then assembles the exact IG format below (with `c.number`).
- `pickCta(c: Case): { key: CtaKey; text: string }` — returns `c.cta` if set, else rotate by `c.number` over [vol2, rare, vol1]. Text is verbatim from the CTA list below.
- `imagePrompt(c: Case): string` — returns the filled ChatGPT X-ray image-prompt (template below) for the user to paste into ChatGPT. Pure string assembly; no image generation.

### src/index.ts — orchestrator + CLI
Modes: `--dry-run` (generate + print, write drafts to case.json, post NOTHING), `--live` (post; requires `config.confirmLive`), `--prompt [folder]` (print `imagePrompt` for that case / the next undrafted case).
Per run, `now = new Date()`:
1. For each case with `postAt <= now` and no `stages.challengePostedAt`: ensure `generated` exists (draft + `saveCase`), then `postImage(imageUrl(folder, threadsImage), generated.threadsCaption)`, record `threadsPostId`+`challengePostedAt`. If `config.instagram`: try `publishCarousel(igSlides.map(url), generated.igCaption)`, record `igMediaId`+`igPostedAt` (catch+log on failure, do not abort).
2. For each case challenge-posted and `now >= challengePostedAt + answerDelayMin` and no `answerPostedAt`: `reply(threadsPostId, generated.threadsAnswer)`, record `answerCommentId`+`answerPostedAt`, and log "Now pin the answer in the app."
3. For each case answer-posted and `now >= challengePostedAt + ctaDelayMin` and no `ctaPostedAt`: `reply(answerCommentId, generated.ctaText)`, record `ctaPostedAt`.
Also: a case whose `postAt` is in the future but within ~24h should get its `generated` drafts written now (so the user can review/edit before it posts). Persist stages in `state.ts`; persist `generated` in case.json via `saveCase`.

---

## EXACT FORMATS (reproduce verbatim; only the {fields} vary)

### Threads challenge caption (deterministic)
```
A patient came in with {symptom}.
Then the X-ray loaded 😭
And {hook}.
Quick diagnosis challenge 🩻
What's the most likely diagnosis?
Wild guesses are welcome 👀
```

### Threads pinned answer
```
Answer: {diagnosis}
👀 What you see:
{whatYouSee}
🦴 Why it matters:
{whyItMatters}
💊 Treatment:
{treatment}
📝 Takeaway:
{takeaway}
```

### Instagram caption
```
Case File {number:02d}. 🩻

{igHook — 2-3 short, punchy lines drafted from the diagnosis}

A real condition most people have never seen.

So before you swipe: A, B, or C? 👉

Swipe for the answer then tell me if you got it. 👇

New weird X-ray case every single day.

Follow along and you'll read scans like a doctor. 🧠

Want the free 5-case starter pack?

Comment SAMPLE and I'll send it.

Educational entertainment only. Not medical advice.

#radiology #xray #spotthediagnosis #medicalmystery #medstudent
```

### CTAs (verbatim — pick one for the sub-reply under the pinned answer)
- `vol2`:
```
If these weird X-rays made you learn something, laugh, or question reality for a second.
I put 20 brand-new cases into a PDF.
None repeated from Volume 1.
Support the page if you'd like, I'd appreciate it 🙏
xray2.mednoteslab.com
```
- `rare`:
```
Some of these X-rays are so rare most doctors will never see them in person.
I collected 10 of the rarest findings in radiology into one PDF.
Look, guess, then flip for a simple breakdown.
If the weird ones hooked you, these are the next level 🙏
rare.mednoteslab.com
```
- `vol1`:
```
If these weird X-rays have made you learn something, laugh, or question reality for a few seconds 😭
I put 20 of the most bizarre cases into a digital PDF.
And if you'd like to support the page, I'd genuinely appreciate it 🙏
xray.mednoteslab.com
```

### ChatGPT X-ray image-prompt template (for --prompt; user pastes into ChatGPT)
Generalize the user's proven structure. Fill {diagnosis}, {view} (e.g. "AP chest"), and
{keyFindings} (the classic radiographic signs of the condition):
```
Create a realistic, de-identified {view} X-ray for a medical diagnosis challenge.

Show classic {diagnosis}: {keyFindings}.

Prioritize clinical realism over symmetry. Make it look like a genuine accessory/abnormal
finding, not a perfect textbook diagram.

Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.

Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray
grain, no cinematic glow, no artificial sharpening, no labels, arrows, or annotations.

High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.
No watermark. Add a small "AI-generated illustration" tag in a corner.
```

---

## GitHub Actions — .github/workflows/publish.yml
Mirror the reply bots' perpetual-chain pattern (it's reliable; GitHub cron throttles). A run
loops every ~15 min calling `npm run live`, commits `state.json` and any updated `case.json`
back, and near the 6h job limit dispatches the next run. Env: `ANTHROPIC_API_KEY`,
`THREADS_ACCESS_TOKEN`, `IG_ACCESS_TOKEN` from secrets; `GITHUB_RAW_BASE`, `BOT_CONFIRM_LIVE=yes`,
`BOT_INSTAGRAM=on`, `BOT_MODEL`. `permissions: contents: write, actions: write`. Concurrency group
`xray-poster`. NOTE: this repo must be **public** so the raw image URLs are fetchable by Meta.

## README.md
Explain: the workflow, the per-case `case.json` schema, where images go (`cases/<folder>/`),
that the repo is public for raw URLs, the AI-generated-illustration labeling recommendation,
how to run dry/live/prompt, and the one-time secret setup.

## cases/00001-example/case.json
A complete sample case (use "Giant Gallstone": symptom "abdominal discomfort", hook
"it looked like someone had hidden a giant pearl inside the abdomen", images
threadsImage "xray.jpg", igSlides ["question.jpg","answer.jpg","cta.jpg"], a postAt, and the
four breakdown fields filled). Add a NOTE in the folder that real image files go here.
