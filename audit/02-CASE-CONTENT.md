# Brief 2 — case vignette, challenge caption and pinned answer

You are auditing the TEXT side of a daily "guess the X-ray diagnosis" account on Threads.
Mixed medical and lay audience. One case per night at 22:00 Cairo. The challenge posts
first; the pinned answer posts 20 minutes later.

## The three things to audit

1. **The vignette fields** — hand-written per case, stored in a pool, used verbatim.
2. **The challenge caption** — a fixed six-line template. Only two fields vary.
3. **The pinned answer** — a fixed layout with four short teaching sections.

## What I want from you

- The **caption template** is the highest-leverage text in the whole system: ~5.3M people
  see it and most never open the thread. Is the shape right? Does it earn the tap?
- The **hook line** carries the intrigue. Are there stronger patterns for that one line?
- The **answer sections** teach. Are they the right four? Is the order right?
- What makes a vignette land vs. fall flat, given the reader has one second while scrolling?
- Anything here that reads as AI-written rather than a person writing about their own case.

Rewrite the lines you think are weak. Give me alternatives, not adjectives.

## Hard rules

- **No commas** except in a genuine list of 3+ items. Join with and / so / but.
- **No em or en dashes.** No hashtags, no links, no @-mentions.
- The caption must stay under 500 characters (Threads limit). The answer under 500 too.
- The caption must NEVER hint at the diagnosis. The whole product is the guess.
- Medical facts must be standard and verifiable. Never invent measurements or studies.

## Already tried and REJECTED — do not re-suggest

- **Adding a case number, a difficulty rating, and a "reveal at X" line to the caption.**
  Ran in July, those posts underperformed, reverted to the six-line shape.
- **Appending a seventh "follow me" line.** Read long and salesy. When a follow ask is
  tested now it SWAPS the challenge label rather than adding a line.
- **Foregrounding how ordinary the presentation was**, as an A/B variant. Still running,
  inconclusive, and it repeatedly leaked the X-ray finding into the symptom line.

## The fixed caption template

```
A patient came in with {symptom}.

Then the X-ray loaded 😭

And {hook}.

Quick diagnosis challenge 🔍

What's the most likely diagnosis?

Wild guesses are welcome 👀
```

`{symptom}` clamped to 130 chars, `{hook}` to 190. Both come VERBATIM from the pool and
never pass through a model.

## The fixed answer layout

```
Answer: {diagnosis}

👀 What you see:
{whatYouSee}

💊 Treatment:
{treatment}
```

The pool also holds `whyItMatters` and `takeaway`, which feed the product PDFs and the
member archive rather than the nightly post.

## A real pool entry (data/conditions.json)

```json
{
  "diagnosis": "Ochronosis",
  "aliases": [
    "alkaptonuria",
    "ochronotic spondylosis",
    "black bone disease"
  ],
  "symptom": "a stiff painful back in a patient whose urine turned black on standing",
  "hook": "every disc in the spine had turned into a dense white wafer",
  "view": "lateral lumbar spine cropped above the hip joints with no pelvis or groin in frame",
  "ageBand": "older",
  "keyFindings": "dense calcification of multiple intervertebral discs with marked disc space narrowing and vacuum phenomena and osteoporotic vertebral bodies giving a stack of white wafers",
  "whatYouSee": "The discs between the vertebrae have calcified into dense white wafers and the spaces between the bones have collapsed.",
  "whyItMatters": "A missing enzyme lets homogentisic acid build up and stain cartilage black and that pigment destroys discs and joints over decades.",
  "treatment": "Nitisinone can lower the acid and the rest is pain control and joint replacement for the badly damaged large joints.",
  "takeaway": "Calcified discs stacked like white wafers is ochronosis from alkaptonuria.",
  "igTitle": "THE BLACK BONE DISEASE",
  "igOptions": [
    "Ankylosing spondylitis",
    "Ochronosis",
    "DISH"
  ],
  "igCorrect": "B",
  "used": true
}
```

## What it renders as — the posted challenge caption

```
A patient came in with a stiff painful back in a patient whose urine turned black on standing.

Then the X-ray loaded 😭

And every disc in the spine had turned into a dense white wafer.

Quick diagnosis challenge 🔍

What's the most likely diagnosis?

Wild guesses are welcome 👀
```

## And the pinned answer posted 20 minutes later

```
Answer: Ochronosis

👀 What you see:
The discs between the vertebrae have calcified into dense white wafers and the spaces between the bones have collapsed.

🦴 Why it matters:
A missing enzyme lets homogentisic acid build up and stain cartilage black and that pigment destroys discs and joints over decades.

💊 Treatment:
Nitisinone can lower the acid and the rest is pain control and joint replacement for the badly damaged large joints.
```

## The drafting prompt used when a case has no hand-written breakdown

System:
```
You are a radiologist writing a short, accurate breakdown for a social-media X-ray
diagnosis challenge. Be tight and factual. Use only well-known, established facts about
the named condition — never invent specific measurements, patient details, or studies.
Each field is ONE short line (a sentence or two). No emojis, no labels, no markdown.
Do NOT use commas: write short sentences or join clauses with words like 'and' or 'with'.
A comma is allowed ONLY when listing three or more items.
Respond ONLY with a JSON object using exactly these keys:
whatYouSee, whyItMatters, treatment, takeaway.
```

User:
```
Diagnosis: {diagnosis}
Presenting symptom: {symptom}
What the image looks like: {hook}

Write the four breakdown lines:
- whatYouSee: the classic radiographic finding(s) a viewer would notice on this X-ray.
- whyItMatters: the clinical significance — why this finding is important.
- treatment: the standard management/treatment approach.
- takeaway: one memorable, plain-language lesson.
```

## The engagement drafting prompt (runs before the caption)

System:
```
You write engagement copy for @mdnoteslab, a daily 'guess the weird X-ray diagnosis'
account. Voice: punchy, curious, plain-spoken. CRITICAL RULES: do NOT use commas anywhere
(write short sentences or join clauses with 'and'); a comma is allowed ONLY inside a list
of three or more items. NEVER name, spell, abbreviate, or give away the diagnosis or its
specific category — these run BEFORE the answer is revealed. No emojis, no hashtags, no
quotation marks, no labels.
Respond ONLY with a JSON object using exactly these keys: difficulty, laypersonQuestion,
seedHint.
```

Produces a 1-5 difficulty, a layperson question, and a `seedHint` posted as the author's
own first comment seconds after the challenge, to start the thread without spoiling.

**Specific question:** the seed comment is the only lever on early-window engagement, which
is what Threads uses to decide reach. Is "point at what to notice without revealing" the
right job for it, or is there a better first-comment move?
