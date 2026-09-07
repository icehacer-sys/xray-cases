# Brief 1 — X-ray image generation and its QA gate

You are auditing a production prompt system. It drives **gpt-image-2** to render a fake but
medically believable plain radiograph, then a **Claude vision** pass judges the result and
either accepts it, triggers a regeneration, or holds it for a human.

Audience: a large mixed medical + lay following on Threads. One case posts per night. The
image must look like a genuine scanned radiograph, must be anatomically possible, and must
show ONE obvious abnormality that a non-medical person notices in about one second.

## What I want from you

1. Where is this prompt **working against itself** — instructions that conflict, or that
   an image model will average into mush?
2. What is **missing** that would reliably improve realism or anatomical correctness?
3. What is **dead weight** — text that costs tokens and changes nothing?
4. Is the **ordering** right? Early instructions get more weight.
5. Same three questions for the QA gate, plus: what real failures would it currently miss?

Be specific and concrete. Rewrite the lines you think are weak rather than describing them.

## Constraints you must respect

- gpt-image-2, text-to-image, 1024x1024, quality `high`. No inpainting, no reference image,
  no control net, no multi-pass compositing.
- The prompt is assembled from a fixed skeleton plus per-case blocks. Everything below is
  the LIVE assembled output for two real cases.
- Findings are chosen to be ADDITIVE or EXPANSILE (calcification, dense objects, gas,
  expansile lesions) because the model reliably fails at absent or vanishing bone.
- Every generated image is judged by the QA gate before it can post.

## Already tried and REJECTED — do not re-suggest

- **A lead L/R side marker.** Added, then removed. A malformed letter is the single most
  obvious "AI generated" tell, and it read as clutter. The prompt now forbids ALL lettering.
- **Negative framing for crops** ("with the pelvis and groin out of frame"). The model
  ignored it for a newborn, because the whole baby fits the frame anyway. Positive framing
  ("show only from the nipples to the navel") works and is now used.
- **Region rules keyed on naive substring matching.** "pelvis" inside the phrase "no pelvis
  in frame" fired the pelvis rule into chest prompts. Now stripped before matching.
- **Letting a device rule fire on any keyword.** "barium swallow" and "growth plate"
  triggered a hardware-coherence block on films with no hardware.

## Known live failure modes

- Duplicated paired structures (two scapulae on one side is the incident that started the QA gate).
- Garbled or floating teeth on panoramic views.
- A device rendered as disconnected parts (a cochlear implant split across both sides of the
  skull with its lead ending in mid-air, which PASSED the gate and had to be caught by eye).
- The skeleton defaulting to a young pristine adult regardless of the stated patient age.

---

# THE LIVE PROMPT — case A: "Ochronosis", age band `older`, lateral lumbar spine

```
Create a realistic, de-identified lateral lumbar spine cropped above the hip joints with no pelvis or groin in frame X-ray for a medical diagnosis challenge.

Show classic Ochronosis: dense calcification of multiple intervertebral discs with marked disc space narrowing and vacuum phenomena and osteoporotic vertebral bodies giving a stack of white wafers.

PATIENT: an older adult over 60 years old. Render the skeleton and soft tissues of a patient of this age.
This skeleton is OLD and must look it. Generalised osteopenia with thinned cortices and coarse prominent
trabeculae. The spine is degenerate with narrowed discs, sclerotic endplates and bridging osteophytes.
Facet arthrosis. The costal cartilage and the aorta are calcified. There may be mild vertebral height
loss. Joint spaces are narrowed. NOTHING about this skeleton looks young or pristine.

Render exactly ONE primary abnormality — the finding above. Everything else on the film is
unremarkable for a patient of this age, normal anatomy. Do not scatter extra lesions, densities, or
incidental abnormalities. Age-appropriate degeneration is NOT an extra lesion and is expected.

ANATOMY MUST BE CORRECT. Render a real human body with the NORMAL number of bones and organs.
Do NOT duplicate, mirror, or add any extra bone, organ, or structure. Exactly one of each paired
structure (one scapula and one clavicle per side, one femoral head per hip, 12 rib pairs, five
digits per hand/foot, one continuous spine, two orbits) unless the pathology itself only changes a
structure's position, shape, or density. Represent the pathology as a change to a SINGLE structure,
never as an added duplicate. No melted, smeared, doubled, or garbled bone.

The PATHOLOGY may be irregular or asymmetric — that is expected. But every NON-pathological paired
structure (both forearm bones, both sides of the jaw and dental arch, the ribs, the orbits) must stay
bilaterally consistent, correctly counted, and cleanly superimposed where structures overlap. Make it
look like a genuine abnormal finding, not a perfect textbook diagram.

SPINE: a SINGLE vertebral column of stacked, sequentially-sized vertebrae in one continuous line — each
vertebra with one body and symmetric paired pedicles. Do not duplicate the column, insert a stray or
floating vertebra, or let the count wander. Curvature/wedging from the pathology is fine but the column
stays a single coherent chain.

ACQUISITION REALISM. This must look like a real radiograph exposed on real equipment and scanned, not a
clean synthetic render.
- Collimation: the exposed field is a rectangle with straight unexposed borders along at least two edges
  where the beam was coned down.
- Exposure is not perfectly even. A gentle density gradient crosses the film and thicker body parts read
  darker and less penetrated than thin ones.
- Scatter softens the soft tissues into a smooth grey haze rather than a clean cutout.
- Positioning is very slightly imperfect. The patient sits a degree or two rotated or off centre the way a
  real person does. Do not centre it perfectly.
- Real overlying shadows cross the anatomy: skin folds, breast or pectoral soft tissue, bowel gas, hair or
  a clothing edge, exactly as they do on a genuine film.
- Fine even film grain over the whole image including the black background.
- NO lettering anywhere on the film. No lead side marker, no L or R, no letters, numbers, dates,
  names or any other text or annotation of any kind.
All of the above is NORMAL IMAGING PHYSICS. None of it may look like digital damage: no smearing, no melted
anatomy, no repeated texture patches, no uniform stippled noise standing in for tissue, and the primary
finding stays clearly visible through all of it.

Where the stated pathology changes any of the above, the PATHOLOGY WINS.

Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.

Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray
grain, no cinematic glow, no artificial sharpening, no labels, arrows, or annotations.

High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.
No watermark.

Avoid these AI artifacts: duplicated or mirrored bones, a floating bone or tooth detached from the
skeleton, merged or melted cortical bone, teeth outside the arch, an extra scapula/clavicle/rib, the
wrong number of fingers or toes, a single fused forearm bone, and uniform stippled noise standing in for
real tissue texture.```

# THE LIVE PROMPT — case B: "Infantile scurvy", age band `infant`, both knees

Only the PATIENT block and the region block differ. Included so you can judge whether the
age system actually changes the instruction meaningfully.

```
PATIENT: an infant under 2 years old. Render the skeleton and soft tissues of a patient of this age.
The epiphyses are still largely cartilaginous and not yet ossified so the joint spaces look very wide.
Fontanelles are open and the cranial sutures are wide. Cortices are thin. Only deciduous tooth buds sit
in the jaws. Soft tissues are rounded and chubby.

Render exactly ONE primary abnormality — the finding above. Everything else on the film is
...
PAIRED BONES: two parallel long bones (radius and ulna, or tibia and fibula) separated by an
interosseous space — never a single fused bone and never a third parallel bone.
JOINT: the two (or few) bones forming the joint articulate cleanly with normal spacing — surfaces meet
once, not doubled or interpenetrating. Sesamoids/patella are singular and correctly placed. No extra
phantom bone crowding the joint.

ACQUISITION REALISM. This must look like a real radiograph exposed on real equipment and scanned, not a
```

# THE QA GATE

## System prompt (sent with every verification)

```
You are a radiologist doing strict QA on an AI-GENERATED X-ray before it is posted publicly to a 
large audience. gpt-image-2 frequently makes anatomical IMPOSSIBILITIES: duplicated or extra 
bones/organs, missing or merged structures, the wrong number of fingers/ribs/limbs/vertebrae, 
mirrored or doubled anatomy, melted/garbled bone, wrong laterality, impossible joints, or the wrong 
body part. Genuine pathology (deformity, fracture, fragmentation, a medical device) is EXPECTED and 
must NOT be flagged — only flag AI artifacts. A real defect that slipped through once: a Sprengel 
deformity X-ray that drew TWO scapulae on one side (a normal one PLUS an extra elevated one) 
instead of a single high scapula. A CORRECT primary lesion does NOT rescue an image whose 
surrounding NON-pathological anatomy is impossible — judge the WHOLE film. Flag critical if 
EITHER the primary finding is wrong or absent, OR any non-pathological structure has an AI 
impossibility (a floating or duplicated bone or tooth, a garbled or incoherent dental arch, a fused 
paired bone, the wrong digit count). These images are deliberately generated to look like REAL 
SCANNED RADIOGRAPHS, so normal acquisition characteristics are intended and must NEVER be reported 
as defects: collimation borders, uneven exposure or a density gradient, scatter haze, film grain, 
slightly rotated or off-centre positioning, overlying skin folds or bowel gas or clothing, and a 
lead side marker. Judge the ANATOMY, not the film quality. Age-appropriate change is likewise 
expected: a patient stated to be older SHOULD show osteopenia and degenerative change, and a film 
that contradicts the stated age is a defect in the other direction. Respond with ONLY a JSON object 
and no other text.```

## Per-case checks appended to the user message (this example: Ochronosis)

```
SPINE CHECK: one continuous vertebral column of stacked, sequentially-sized vertebrae — no duplicated
column, no floating/extra vertebra, no abrupt count or size discontinuity. Symmetric pedicles. Wedging
or curvature from the pathology is expected; a doubled or broken-chain column is a CRITICAL artifact.
AGE CHECK: the patient is an older adult over 60 years old. Confirm skeletal maturity matches — osteopenia with thinned cortices, a degenerate spine (narrowed discs, endplate sclerosis, osteophytes), calcified costal cartilage and aorta. A pristine young-looking skeleton in a patient over 60 is WRONG.
Maturity that CONTRADICTS the age is CRITICAL: open growth plates in an adult, fused plates in a young
child, or a pristine young-looking spine in a patient over 60. Age-appropriate degeneration is EXPECTED
and is never a defect.
REALISM IS EXPECTED AND MUST NOT BE FLAGGED: collimation borders, uneven exposure, a density gradient,
scatter haze, film grain, slightly rotated or off-centre positioning, and overlying skin folds, bowel gas
or clothing are all normal features of a genuine radiograph. Only flag AI impossibilities in the ANATOMY.
NO LETTERING: the film must carry no text at all — no lead L or R side marker, no letters, numbers or
annotation. Any lettering present is a defect and should be reported.```

## What the gate returns and how it is used

```json
{"plausible": bool, "depictsDiagnosis": bool, "correctBodyPart": bool,
 "defects": [string], "severity": "pass"|"minor"|"critical"}
```

- `critical` -> regenerate, feeding the listed defects back into the next prompt as
  "avoid these specific errors". Up to 3 attempts.
- Still failing after 3 -> the case is flagged `needsReview` and can never auto-post.
- `depictsDiagnosis:false` or `correctBodyPart:false` also fail, because a "guess the
  diagnosis" post whose pinned answer names something the image does not show is worse
  than a mangled bone.
- `minor` passes.

**Specific question on the gate:** it passed a cochlear implant whose receiver sat on one
side of the skull, its lead dead-ending in mid-air, and its electrode coil on the opposite
side connected to nothing. Every part looked plausible alone. How should the gate be
restructured so composite-object incoherence like that cannot pass?
