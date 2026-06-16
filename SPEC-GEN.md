# xray-case-poster — auto-generator spec (phase 2)

Adds fully-automatic case generation on top of the publisher (see SPEC.md). The bot picks the
next vetted condition, AI-generates ONLY the X-ray, RENDERS the 3 IG slides from a template
(deterministic text — image models garble slide text), assembles a Case, and queues it as
`approved: false` for a light human review before the publisher posts it.

Read `src/types.ts` (`Condition`, `Case`) and `src/config.ts` first. Reuse existing modules
(cases.ts, captions.ts, state.ts). New deps already in package.json: `@resvg/resvg-js`.

## New modules (exact exports)

### src/openai.ts — X-ray image generation
- `generateXray(prompt: string): Promise<Buffer>` — `POST https://api.openai.com/v1/images/generations` with `{ model: config.imageModel, prompt, size: config.imageSize, n: 1 }`, `Authorization: Bearer ${requireEnv("OPENAI_API_KEY")}`. gpt-image-1 returns `data[0].b64_json`; decode to a PNG Buffer. Throw a clear Error on non-200.

### src/slides.ts — render the 3 IG slides from a template
- `renderSlides(c: Case, cond: Condition, xrayPng: Buffer): { question: Buffer; answer: Buffer; cta: Buffer }` — build each slide as an 1080x1080 SVG and rasterize with `@resvg/resvg-js` (`new Resvg(svg, { fitTo: { mode: "width", value: config.slideSize }, font: { loadSystemFonts: true } }).render().asPng()`). Embed `xrayPng` via a `data:image/png;base64,...` `<image>` href. Match the account's look: near-black navy `#070b16` background, faint grid feel, cyan (`#22d3ee`) rounded scanner frame with corner brackets, orange (`#f59e0b`) tags/pills, clean sans-serif white text.
  - **question slide**: small orange "CASE FILE {NN}" tag; bold white title = `cond.igTitle`; the X-ray in the cyan frame; cyan "WHAT IS THE DIAGNOSIS?"; the three options each with an orange circled letter (`A {igOptions[0]}` / `B ...` / `C ...`); bottom orange pill "SWIPE TO REVEAL".
  - **answer slide**: white "WEIRD X-RAY CASE FILES" wordmark + cyan "ANSWER" tab; the X-ray (tighter); a box "Correct answer: {igCorrect}. {diagnosis}"; cyan "WHAT YOU SEE" + `cond.whatYouSee`; orange "WHY IT MATTERS" + `cond.whyItMatters`; cyan "WHAT DOCTORS LOOK FOR" + a short line; orange "SIMPLE TAKEAWAY" + `cond.takeaway`; grey footer "Educational entertainment only. Not medical advice."
  - **cta slide** (no X-ray): centered "WEIRD X-RAY CASE FILES" wordmark; bold "A NEW CASE EVERY DAY"; orange pill "FOLLOW FOR MORE"; "Can you think like a doctor?"; grey footer disclaimer.
  - Keep text within margins; wrap long option/description text. Add a tiny grey "AI-generated illustration" tag on the question + answer slides.

### src/generate.ts — generator orchestrator + CLI
- Loads `config.conditionsFile` (array of `Condition`). CLI flags: `--count N` (default 1), `--mock` (skip the OpenAI call; write a placeholder gray 1024x1024 PNG so the pipeline + slides can be tested with no API key), `--topup` (generate until pending+approved unposted cases reach `config.queueTarget`).
- For each generation: pick the first `used !== true` condition. Compute the next case number = max existing case number + 1; folder = `NNNNN-<slug of diagnosis>`. Build the X-ray prompt from `cond.view` + `cond.keyFindings` via `captions.imagePrompt`-style assembly (include the "AI-generated illustration" tag). `generateXray()` (or placeholder if --mock) → write `cases/<folder>/xray.png`. `renderSlides()` → write `question.png`, `answer.png`, `cta.png`. Build the `Case` (diagnosis, aliases, symptom, hook, the four breakdown fields, `igOptions`, `threadsImage: "xray.png"`, `igSlides: ["question.png","answer.png","cta.png"]`, `postAt` = the day after the latest queued case's postAt at `config.postHourUtc` (or tomorrow if none), `approved: false`, `source: "generated"`). Pre-draft captions via captions.ts and `saveCase`. Mark `cond.used = true` and persist `conditions.json`.
- Print a summary: which conditions were generated, folders, postAt, and "review + set approved:true (or run with BOT_AUTO_APPROVE=on)".

## Edit src/index.ts — enforce the review gate
In the challenge-posting stage (stage 1), only post a case when `c.approved === true || config.autoApprove`. Otherwise log `awaiting approval: <folder>` and skip that case (do not advance its stages). Everything else unchanged.

## data/conditions.json — vetted starter pool (generate ~24 entries)
A JSON array of `Condition`. Use REAL, classic "weird but recognizable" X-ray/imaging conditions
with ACCURATE radiographic findings and breakdowns (these are the medical source of truth, so
correctness matters — a reviewer will fact-check them). Vary body regions. Each `igOptions` must
contain the correct answer plus two plausible-but-wrong distractors, with `igCorrect` pointing to
the right letter. Examples of suitable conditions: Maffucci syndrome, Sprengel deformity, giant
gallstone, Eagle syndrome, osteopoikilosis, melorheostosis, lithopedion, gossypiboma, situs
inversus, achalasia (bird-beak), sigmoid volvulus (coffee-bean), pneumoperitoneum, cannonball
metastases, rhinolith, fibrodysplasia ossificans progressiva, staghorn calculus, etc. Do NOT
duplicate a diagnosis. Keep breakdown lines tight and factual; no invented statistics.

## Edit .github/workflows/publish.yml
Add `OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}` to env. Once per chain run, before the publish
loop, run `npm run generate -- --topup` to keep `queueTarget` cases queued (it no-ops if full).
Commit any new `cases/**` (images + case.json) and updated `data/conditions.json` back alongside
state.json. Keep `BOT_AUTO_APPROVE` unset (review gate on) by default.

## Edit README.md
Document: the condition pool + how to add/vet conditions; full-auto flow (generate → review →
auto-post); the review gate (set `approved: true` in a case.json, or `BOT_AUTO_APPROVE=on`); the
new `OPENAI_API_KEY` secret + ~cost; `npm run generate [-- --mock|--count N|--topup]`; that only the
X-ray is AI-generated (slides are rendered) and carries an "AI-generated illustration" tag.
