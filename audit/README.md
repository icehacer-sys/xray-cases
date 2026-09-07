# Audit package — everything the pipeline generates

Three briefs, each self-contained. Paste ONE at a time into ChatGPT (they are large).
Bring the replies back and we decide together what to adopt.

| Brief | Covers | Model call it governs |
|---|---|---|
| `01-IMAGE-GENERATION.md` | The X-ray prompt + the QA gate that judges the result | gpt-image-2, then Claude vision |
| `02-CASE-CONTENT.md` | The clinical vignette, the caption, the pinned answer | Claude (text) |
| `03-REPLY-VOICE.md` | The comment-reply persona | Claude (text), every comment |

## How the whole system runs

```
data/conditions.json   owner-vetted case pool (diagnosis, symptom, hook, view,
                       keyFindings, 4-section breakdown, igOptions, ageBand)
        |
        v
generate.ts            picks an unused condition
        |-- buildXrayPrompt() ------> gpt-image-2 ------> xray.png
        |-- verifyXray() -----------> Claude vision -----> pass / retry / hold
        |-- captions.ts ------------> Claude -----------> caption + pinned answer
        v
cases/NNNNN-slug/      case.json + xray.png, scheduled one per night
        |
        v
index.ts               posts challenge 22:00 Cairo, pinned answer +20 min, CTA later
        |
        v
threads-bot reply.ts   reads every comment, replies in the account voice
```

## Rules that apply to EVERYTHING here

- **No commas** except inside a genuine list of three or more items. Join clauses with
  and / so / but, or split into two sentences.
- **No em or en dashes.**
- Only these seven emoji, and only in replies: 🤣 😭 🤍 🫡 ✅ 💯 👏🏼
- **Never reveal the diagnosis before the pinned answer posts.**
- One case per night. The image must read as "what the hell is that" within one second
  to a non-medical person scrolling.
