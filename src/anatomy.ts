// Single source of truth for the per-region anatomy rules used BOTH when generating an
// X-ray (steer gpt-image-2 toward correct anatomy) and when QA-verifying the result
// (reject AI impossibilities). Keeping the generation constraint and the verification
// check side-by-side in ONE table means the two can never drift — historically they were
// two hand-maintained regex lists and had already diverged (the shoulder/scapula check
// existed only in the verifier, so the very Sprengel-deformity failure that motivated the
// gate — gpt-image-2 drawing TWO scapulae — was never proactively prevented at generation).
//
// Each rule matches on the Condition.view string. ALL matching rules apply (a "shoulder AP
// chest" view picks up both the chest and the shoulder-girdle rule), so keep rules
// orthogonal and non-contradictory. Ordered head-to-toe for readable prompts.

import type { AgeBand, Condition } from "./types.js";

export interface RegionRule {
  id: string;
  /** Matches against the lowercased Condition.view. */
  test: RegExp;
  /** Constraint lines injected into the generation prompt (what to render). */
  prompt: string[];
  /** Check lines injected into the QA verifier prompt (what to inspect for). */
  verify: string[];
}

// prettier-ignore
export const REGION_RULES: RegionRule[] = [
  {
    id: "dental",
    test: /panoram|orthopantom|\bopg\b|jaw|mandible|maxilla|dental|teeth|tooth|odont/,
    prompt: [
      `TEETH: render a SINGLE continuous dental arch per jaw — every tooth seated in the alveolar bone along`,
      `one smooth curve, with NO floating, tilted-into-space, duplicated, fused, or extra teeth beyond the`,
      `stated pathology. Use ONE age-appropriate dentition (a normal adult set OR a normal child set, never a`,
      `chaotic mix). Upper and lower arches mirror-consistent in tooth count and spacing. Every tooth except`,
      `the described lesion is normal and correctly positioned. One mandible with two symmetric rami and`,
      `condyles; the two temporomandibular joints match.`,
    ],
    verify: [
      `TEETH CHECK (this view shows teeth): count the teeth in the upper arch and the lower arch. Confirm a`,
      `SINGLE continuous arch per jaw with every tooth seated in alveolar bone — no floating, duplicated,`,
      `fused, or supernumerary teeth beyond the stated pathology — and ONE age-appropriate dentition (not a`,
      `chaotic adult/baby mix), left-right mirror-consistent in count and spacing. Confirm ONE mandible with`,
      `two symmetric rami/condyles. Chaotic, floating, or duplicated dentition is a CRITICAL AI artifact even`,
      `when the primary lesion is rendered correctly.`,
    ],
  },
  {
    id: "skull-face",
    test: /skull|cranium|cranial|calvari|facial|orbit|sinus|nasal|zygoma|temporal bone/,
    prompt: [
      `SKULL/FACE: one symmetric cranial vault, exactly TWO orbits, one midline nasal septum, one set of`,
      `mirror-image paired sinuses, and a single mandible. Do not duplicate an orbit, the nasal bones, or the`,
      `jaw, and do not split the calvarium into a doubled outline.`,
    ],
    verify: [
      `SKULL/FACE CHECK: exactly one cranial vault (no doubled outline), TWO symmetric orbits, one midline`,
      `nasal septum, mirror-image paired sinuses, one mandible. A duplicated orbit/jaw or a doubled skull`,
      `outline is a CRITICAL artifact.`,
    ],
  },
  {
    id: "spine",
    test: /spine|spinal|vertebr|cervical|thoracic|lumbar|sacr|coccyx|scolios|kyphos/,
    prompt: [
      `SPINE: a SINGLE vertebral column of stacked, sequentially-sized vertebrae in one continuous line — each`,
      `vertebra with one body and symmetric paired pedicles. Do not duplicate the column, insert a stray or`,
      `floating vertebra, or let the count wander. Curvature/wedging from the pathology is fine but the column`,
      `stays a single coherent chain.`,
    ],
    verify: [
      `SPINE CHECK: one continuous vertebral column of stacked, sequentially-sized vertebrae — no duplicated`,
      `column, no floating/extra vertebra, no abrupt count or size discontinuity. Symmetric pedicles. Wedging`,
      `or curvature from the pathology is expected; a doubled or broken-chain column is a CRITICAL artifact.`,
    ],
  },
  {
    id: "shoulder-girdle",
    test: /shoulder|scapula|clavicle|acromio|glenohumeral|sprengel|coracoid/,
    prompt: [
      `SHOULDER GIRDLE: exactly ONE scapula and ONE clavicle per side — never an extra, elevated, or mirrored`,
      `second scapula/clavicle. One humeral head sits in one glenoid per shoulder. If the pathology raises or`,
      `deforms a scapula (e.g. Sprengel) it stays a SINGLE displaced bone, not a duplicate added beside a`,
      `normal one.`,
    ],
    verify: [
      `PAIRED-STRUCTURE CHECK: exactly one scapula and one clavicle per side, one humeral head per glenoid.`,
      `A SECOND scapula or clavicle on one side (the classic Sprengel-deformity failure) is a CRITICAL`,
      `artifact even if one of them looks normal.`,
    ],
  },
  {
    id: "chest",
    test: /chest|thorax|thoracic cage|\brib\b|ribs|lung|pulmonary|mediastin/,
    prompt: [
      `CHEST: lung markings are fine BRANCHING vessels tapering to the periphery, not uniform speckled static.`,
      `Symmetric ribcage with the ribs curving in matched pairs, one heart shadow, one hemidiaphragm per side,`,
      `and one scapula/clavicle per side overlying the film. Ribs do not fork, float, or lose their count.`,
    ],
    verify: [
      `CHEST CHECK: symmetric ribcage with matched rib pairs (no forked/floating/miscounted ribs), one heart`,
      `shadow, one hemidiaphragm per side, one scapula and one clavicle per side. Lung markings branch and`,
      `taper rather than being uniform stippled noise.`,
    ],
  },
  {
    id: "abdomen",
    test: /abdom|\bkub\b|bowel|intestin|colon|gastric|stomach|liver|hepat|splee|splen|kidney|renal|ureter|bladder|gallbladder|biliar/,
    prompt: [
      `ABDOMEN: one gas-filled stomach bubble under the left hemidiaphragm, a bowel gas pattern that stays`,
      `CONTINUOUS and connected as real loops (never disconnected floating gas blobs), one liver shadow on the`,
      `right and one spleen on the left, two kidney outlines, one bladder, and a single midline lumbar spine`,
      `flanked by two psoas margins. Do not duplicate an organ or add a second stomach bubble.`,
    ],
    verify: [
      `ABDOMEN CHECK: one stomach bubble, a continuous connected bowel gas pattern (not disconnected floating`,
      `gas blobs), one liver and one spleen, two kidney outlines, one midline lumbar spine with two psoas`,
      `margins. A duplicated organ or gas that follows no anatomical lumen is a CRITICAL artifact.`,
    ],
  },
  {
    id: "humerus-femur",
    test: /humerus|upper arm|femur|femoral shaft|thigh/,
    prompt: [
      `LONG BONE: a SINGLE long bone (humerus or femur) with one shaft between two joints — one head/proximal`,
      `end and one distal end. Do not split it into two parallel shafts or double the joint.`,
    ],
    verify: [
      `LONG-BONE CHECK: a single shaft (humerus/femur) with one proximal and one distal end — not doubled,`,
      `forked, or fused to a phantom second bone.`,
    ],
  },
  {
    id: "forearm-leg",
    test: /forearm|radius|ulna|\bleg\b|lower leg|tibia|fibula/,
    prompt: [
      `PAIRED BONES: two parallel long bones (radius and ulna, or tibia and fibula) separated by an`,
      `interosseous space — never a single fused bone and never a third parallel bone.`,
    ],
    verify: [
      `PAIRED-BONE CHECK: confirm TWO parallel long bones (radius+ulna or tibia+fibula) with an interosseous`,
      `space — never one fused bone and never a third bone.`,
    ],
  },
  {
    id: "joint",
    test: /elbow|olecranon|knee|patella|tibial plateau|ankle|malleol|talus|calcaneus|hindfoot|wrist|carpal/,
    prompt: [
      `JOINT: the two (or few) bones forming the joint articulate cleanly with normal spacing — surfaces meet`,
      `once, not doubled or interpenetrating. Sesamoids/patella are singular and correctly placed. No extra`,
      `phantom bone crowding the joint.`,
    ],
    verify: [
      `JOINT CHECK: the articulating bones meet once with a clean joint space (no doubled/interpenetrating`,
      `surfaces), and any sesamoid/patella is singular and correctly placed.`,
    ],
  },
  {
    id: "digits",
    test: /hand|metacarp|finger|thumb|foot|forefoot|midfoot|\btoe\b|toes|metatars|digit|phalan/,
    prompt: [
      `DIGITS: five digits with the correct phalanx count (thumb/big toe two, the others three) and one`,
      `metacarpal/metatarsal per digit; do not add, drop, merge, or detach a digit, and keep the carpal/tarsal`,
      `block coherent.`,
    ],
    verify: [
      `DIGIT CHECK: confirm five digits with the correct phalanx count (thumb/big toe two phalanges, the`,
      `others three), one metacarpal/metatarsal each; none added, dropped, merged, or detached.`,
    ],
  },
  {
    id: "pelvis-hip",
    test: /pelvis|pelvic|hip|acetabul|iliac|ilium|ischium|pubis|femoral head|sacroiliac/,
    prompt: [
      `PELVIS/HIP: one symmetric bony pelvic ring — two iliac wings, two symmetric obturator foramina, one`,
      `midline sacrum and coccyx, and one femoral head seated in one acetabulum per side. Do not duplicate a`,
      `femoral head, split the pelvic ring, or make the two halves mismatched (unless the pathology itself is`,
      `the asymmetry).`,
    ],
    verify: [
      `PELVIS/HIP CHECK: one symmetric pelvic ring with two obturator foramina, one midline sacrum/coccyx, and`,
      `one femoral head in one acetabulum per side. A duplicated femoral head, a broken/doubled pelvic ring, or`,
      `mismatched halves (beyond the stated pathology) is a CRITICAL artifact.`,
    ],
  },
];

/**
 * Region names mentioned only to EXCLUDE them from frame. Many vetted views end with a
 * Meta-safety crop instruction like "AP chest and upper abdomen cropped at the navel with
 * no pelvis or groin in frame" — a naive substring match sees "pelvis" there and injects the
 * pelvis/hip rule into a CHEST prompt, ordering gpt-image-2 to draw a pelvic ring that has no
 * business on the film. Strip negated clauses before matching so an excluded region never
 * pulls in its own anatomy rule.
 */
const NEGATED_CLAUSE = /\b(?:no|without|excluding|not\s+including|avoid(?:ing)?|omit(?:ting)?|free\s+of)\b[^.;]*/g;

/**
 * A crop boundary names the region where the film STOPS, so that region is out of frame too
 * ("...upper abdomen cropped above the pelvis", "...enlarged foot cropped at the ankle").
 * Dropping everything from the crop phrase onward leaves only the anatomy actually pictured.
 */
const CROP_BOUNDARY = /\bcropped\s+(?:above|below|at|to|just\s+\w+)\b[^.;]*/g;

/**
 * The third way a vetted view excludes a region: "...upper abdomen only WITH THE PELVIS and
 * lower abdomen completely OUT OF FRAME". Neither a "no X" negation nor a "cropped at X"
 * boundary, so it needs its own pattern.
 */
const OUT_OF_FRAME = /with[^.;]*?out of (?:the )?frame/g;

/**
 * Implanted hardware and swallowed objects get their own coherence rule, keyed off the
 * DIAGNOSIS/keyFindings rather than the view because a device can appear on any film. Added
 * after a cochlear-implant X-ray passed QA with the receiver package on one side of the
 * skull, its lead dead-ending in mid-air, and the electrode coil on the OPPOSITE side
 * connected to nothing — every individual part looked right so the anatomy checks cleared it.
 */
/**
 * Real hardware words. Safe to match anywhere (diagnosis OR findings) because they have no
 * innocent anatomical meaning.
 */
const DEVICE_HARDWARE =
  /implant|pacemaker|defibrillat|stent|catheter|shunt|prosthe|replacement|cochlear|cannula|electrode/;

/**
 * Object words matched against the DIAGNOSIS ONLY. In findings text these are constantly
 * innocent: "barium SWALLOW" is a study not an object, Ascariasis findings mention "SWALLOWED
 * gas" inside a worm, and — now that the age blocks talk about growth PLATES and vertebral
 * ENDPLATES — a findings-wide "plate" match would fire the hardware rule on most films.
 */
const DEVICE_OBJECT =
  /swallow|ingest|foreign body|retained|impale|\bgun\b|bullet|shrapnel|pellet|sponge|instrument|gossypib|magnet|batter|\biud\b|denture|\bcoil\b|\bplate\b|screw|\bnail\b|\bpin\b|valve|\bport\b|\blead\b|\bdevice\b/;

/** A retained CONTRAST agent is not hardware, so "Retained Pantopaque contrast" must not match. */
const NOT_DEVICE = /contrast|barium|gastrografin|\bdye\b|pantopaque|iophendylate/;

const DEVICE_RULE = {
  prompt: [
    `DEVICE INTEGRITY: render the hardware as ONE continuous connected object. Every part sits on the`,
    `SAME side of the body and in its correct anatomical relationship — a receiver or generator, its lead,`,
    `and the electrode or tip it feeds are physically joined along one unbroken path. No lead that ends in`,
    `mid-air, no component floating free of the rest, no second copy of any part, and never the same device`,
    `split across both sides of the body.`,
  ],
  verify: [
    `DEVICE CHECK: trace the hardware end to end. Every component (generator/receiver, lead, electrode or`,
    `tip) must form ONE connected object on ONE side of the body with correct anatomical placement. A lead`,
    `that dead-ends in mid-air, a component floating unconnected, a duplicated part, or a device split`,
    `across both sides is a CRITICAL AI artifact even when each piece looks realistic on its own.`,
  ],
};

/** Device-coherence lines when the condition genuinely involves hardware or a swallowed object. */
export function deviceLines(
  cond: Pick<Condition, "diagnosis" | "keyFindings">,
  kind: "prompt" | "verify",
): string[] {
  const dx = cond.diagnosis.toLowerCase();
  if (NOT_DEVICE.test(dx)) return [];
  const isDevice = DEVICE_HARDWARE.test(`${dx} ${cond.keyFindings.toLowerCase()}`) || DEVICE_OBJECT.test(dx);
  return isDevice ? DEVICE_RULE[kind] : [];
}

// ---------------------------------------------------------------------------
// Patient age. Without it gpt-image-2 invents a patient and defaults to a young pristine
// skeleton, so a 70-year-old came out with flawless discs and no osteopenia. A BAND rather
// than a number, because each band maps to concrete features the model can actually draw
// (open physes, endplate sclerosis, calcified costal cartilage).
// ---------------------------------------------------------------------------

export const AGE_BANDS: AgeBand[] = ["infant", "child", "adolescent", "young-adult", "middle-aged", "older"];

interface AgeRule {
  /** Goes into "PATIENT: ..." — a plain description of who this is. */
  who: string;
  prompt: string[];
  verify: string[];
}

// prettier-ignore
const AGE_RULES: Record<AgeBand, AgeRule> = {
  "infant": {
    who: "an infant under 2 years old",
    prompt: [
      `The epiphyses are still largely cartilaginous and not yet ossified so the joint spaces look very wide.`,
      `Fontanelles are open and the cranial sutures are wide. Cortices are thin. Only deciduous tooth buds sit`,
      `in the jaws. Soft tissues are rounded and chubby.`,
    ],
    verify: [`wide unossified joint spaces, open fontanelles and wide sutures, thin cortices, deciduous tooth buds only`],
  },
  "child": {
    who: "a child between about 3 and 11 years old",
    prompt: [
      `Growth plates are OPEN and show as clean lucent lines across every metaphysis, with the ossification`,
      `centres sitting separate from the shafts. Dentition is mixed deciduous and permanent. Bones are slender`,
      `with a wide medullary canal. There is NO degenerative change anywhere.`,
    ],
    verify: [`OPEN growth plates as lucent metaphyseal lines, separate ossification centres, mixed dentition, zero degeneration`],
  },
  "adolescent": {
    who: "an adolescent between about 12 and 18 years old",
    prompt: [
      `The physes are closing, with dense fusing metaphyseal lines and a residual physeal scar. Proportions are`,
      `near adult. Permanent dentition is present without third molars. There is still no degenerative change.`,
    ],
    verify: [`physes closing or recently fused with a physeal scar, near-adult proportions, no degeneration`],
  },
  "young-adult": {
    who: "a young adult between about 19 and 39 years old",
    prompt: [
      `The physes are fully closed leaving only faint physeal scars. Cortices are dense and sharp and the joint`,
      `spaces are crisp. There are no osteophytes and no vascular calcification.`,
    ],
    verify: [`fully closed physes, dense sharp cortices, crisp joint spaces, no osteophytes or vascular calcification`],
  },
  "middle-aged": {
    who: "a middle-aged adult between about 40 and 59 years old",
    prompt: [
      `Early wear is visible: mild disc space narrowing with small endplate osteophytes and slight facet`,
      `sclerosis, and early calcification of the costal cartilage. The cortices are still good.`,
    ],
    verify: [`mild early degeneration (small osteophytes, slight disc narrowing) with still-good cortices`],
  },
  "older": {
    who: "an older adult over 60 years old",
    prompt: [
      `This skeleton is OLD and must look it. Generalised osteopenia with thinned cortices and coarse prominent`,
      `trabeculae. The spine is degenerate with narrowed discs, sclerotic endplates and bridging osteophytes.`,
      `Facet arthrosis. The costal cartilage and the aorta are calcified. There may be mild vertebral height`,
      `loss. Joint spaces are narrowed. NOTHING about this skeleton looks young or pristine.`,
    ],
    verify: [
      `osteopenia with thinned cortices, a degenerate spine (narrowed discs, endplate sclerosis, osteophytes),`,
      `calcified costal cartilage and aorta. A pristine young-looking skeleton in a patient over 60 is WRONG`,
    ],
  },
};

/** Age cues already written into a condition's symptom/view/hook, for the ~20 that have one. */
const AGE_CUES: [RegExp, AgeBand][] = [
  [/infant|neonat|newborn|baby/i, "infant"],
  [/child|toddler|childhood|young boy|young girl/i, "child"],
  [/adolescen|teenage|teen/i, "adolescent"],
  [/young adult|young man|young woman/i, "young-adult"],
  [/middle-aged/i, "middle-aged"],
  [/older|elderly|old man|old woman/i, "older"],
];

/** Best-guess band from free text when a condition has no explicit ageBand. */
export function inferAgeBand(text: string): AgeBand | undefined {
  for (const [re, band] of AGE_CUES) if (re.test(text)) return band;
  return undefined;
}

/**
 * Age lines for a condition. Explicit ageBand wins, then a cue inferred from the condition's own
 * wording, then a neutral young-adult default so nothing breaks for the conditions written before
 * the field existed.
 */
export function ageLines(
  cond: Pick<Condition, "diagnosis"> & Partial<Pick<Condition, "symptom" | "view" | "hook">> & { ageBand?: AgeBand },
  kind: "prompt" | "verify",
): string[] {
  const band =
    cond.ageBand ??
    inferAgeBand([cond.symptom, cond.view, cond.hook].filter(Boolean).join(" ")) ??
    "young-adult";
  const rule = AGE_RULES[band];
  return kind === "prompt"
    ? [`PATIENT: ${rule.who}. Render the skeleton and soft tissues of a patient of this age.`, ...rule.prompt]
    : [
        `AGE CHECK: the patient is ${rule.who}. Confirm skeletal maturity matches — ${rule.verify.join(" ")}.`,
        `Maturity that CONTRADICTS the age is CRITICAL: open growth plates in an adult, fused plates in a young`,
        `child, or a pristine young-looking spine in a patient over 60. Age-appropriate degeneration is EXPECTED`,
        `and is never a defect.`,
      ];
}

// ---------------------------------------------------------------------------
// Acquisition realism. Everything here is normal imaging PHYSICS, not digital damage — the
// wording has to say so explicitly, or the model produces smearing and the QA gate then
// rejects its own realism as an AI artifact.
// ---------------------------------------------------------------------------

const ACQUISITION_REALISM = {
  prompt: [
    `ACQUISITION REALISM. This must look like a real radiograph exposed on real equipment and scanned, not a`,
    `clean synthetic render.`,
    `- Collimation: the exposed field is a rectangle with straight unexposed borders along at least two edges`,
    `  where the beam was coned down.`,
    `- Exposure is not perfectly even. A gentle density gradient crosses the film and thicker body parts read`,
    `  darker and less penetrated than thin ones.`,
    `- Scatter softens the soft tissues into a smooth grey haze rather than a clean cutout.`,
    `- Positioning is very slightly imperfect. The patient sits a degree or two rotated or off centre the way a`,
    `  real person does. Do not centre it perfectly.`,
    `- Real overlying shadows cross the anatomy: skin folds, breast or pectoral soft tissue, bowel gas, hair or`,
    `  a clothing edge, exactly as they do on a genuine film.`,
    `- Fine even film grain over the whole image including the black background.`,
    `- A small radiopaque lead side marker (a single letter L or R matching the side imaged) sits in one corner`,
    `  of the collimated field over background, never over the anatomy or the finding.`,
    `All of the above is NORMAL IMAGING PHYSICS. None of it may look like digital damage: no smearing, no melted`,
    `anatomy, no repeated texture patches, no uniform stippled noise standing in for tissue, and the primary`,
    `finding stays clearly visible through all of it.`,
  ],
  verify: [
    `REALISM IS EXPECTED AND MUST NOT BE FLAGGED: collimation borders, uneven exposure, a density gradient,`,
    `scatter haze, film grain, slightly rotated or off-centre positioning, and overlying skin folds, bowel gas`,
    `or clothing are all normal features of a genuine radiograph. Only flag AI impossibilities in the ANATOMY.`,
    `SIDE MARKER: if a lead L or R marker is present it should be one legible letter clear of the anatomy. An`,
    `illegible or garbled marker is MINOR, not critical.`,
  ],
};

/**
 * Everything the VERIFIER should check beyond the generic pass: region rules, device coherence,
 * age, and the realism-tolerance clause. Kept here so generation and QA compose from one source.
 */
export function verifyExtraLines(
  cond: Pick<Condition, "view" | "diagnosis" | "keyFindings"> &
    Partial<Pick<Condition, "symptom" | "hook">> & { ageBand?: AgeBand },
): string[] {
  return [
    ...regionVerifyLines(cond.view),
    ...deviceLines(cond, "verify"),
    ...ageLines(cond, "verify"),
    ...ACQUISITION_REALISM.verify,
  ];
}

/** All region rules whose matcher fires for this view (head-to-toe order preserved). */
export function matchedRegions(view: string): RegionRule[] {
  const v = view
    .toLowerCase()
    .replace(CROP_BOUNDARY, " ")
    .replace(OUT_OF_FRAME, " ")
    .replace(NEGATED_CLAUSE, " ");
  return REGION_RULES.filter((r) => r.test.test(v));
}

/** Region-specific generation constraints for a view, flattened for the image prompt. */
export function regionPromptLines(view: string): string[] {
  return matchedRegions(view).flatMap((r) => r.prompt);
}

/** Region-specific QA checks for a view, flattened for the verifier prompt. */
export function regionVerifyLines(view: string): string[] {
  return matchedRegions(view).flatMap((r) => r.verify);
}

/**
 * THE canonical X-ray image prompt. Lives here (not in generate.ts) because regencase.ts
 * regenerates images for existing cases too, and it used to carry its OWN weaker copy with no
 * region rules and no device-coherence rule — so repairing a defective case could quietly
 * reintroduce the very defect the gate had caught. One builder, one set of rules, both callers.
 *
 * `avoid` feeds a previous attempt's detected defects back in; `emphasis` lets a caller
 * strengthen a weak diagnostic feature without forking the prompt.
 */
export function buildXrayPrompt(
  cond: Pick<Condition, "view" | "diagnosis" | "keyFindings"> &
    Partial<Pick<Condition, "symptom" | "hook">> & { ageBand?: AgeBand },
  opts: { avoid?: string[]; emphasis?: string } = {},
): string {
  const region = [
    ...regionPromptLines(cond.view),
    ...deviceLines(cond, "prompt"),
  ];
  const lines = [
    `Create a realistic, de-identified ${cond.view} X-ray for a medical diagnosis challenge.`,
    ``,
    `Show classic ${cond.diagnosis}: ${cond.keyFindings}.`,
    ``,
    ...ageLines(cond, "prompt"),
    ``,
    // "unremarkable FOR A PATIENT OF THIS AGE" — without that qualifier this rule and the age
    // block contradict each other for any older patient, whose normal film is full of
    // degenerative change that would otherwise read as forbidden "extra lesions".
    `Render exactly ONE primary abnormality — the finding above. Everything else on the film is`,
    `unremarkable for a patient of this age, normal anatomy. Do not scatter extra lesions, densities, or`,
    `incidental abnormalities. Age-appropriate degeneration is NOT an extra lesion and is expected.`,
    ``,
    `ANATOMY MUST BE CORRECT. Render a real human body with the NORMAL number of bones and organs.`,
    `Do NOT duplicate, mirror, or add any extra bone, organ, or structure. Exactly one of each paired`,
    `structure (one scapula and one clavicle per side, one femoral head per hip, 12 rib pairs, five`,
    `digits per hand/foot, one continuous spine, two orbits) unless the pathology itself only changes a`,
    `structure's position, shape, or density. Represent the pathology as a change to a SINGLE structure,`,
    `never as an added duplicate. No melted, smeared, doubled, or garbled bone.`,
    ``,
    `The PATHOLOGY may be irregular or asymmetric — that is expected. But every NON-pathological paired`,
    `structure (both forearm bones, both sides of the jaw and dental arch, the ribs, the orbits) must stay`,
    `bilaterally consistent, correctly counted, and cleanly superimposed where structures overlap. Make it`,
    `look like a genuine abnormal finding, not a perfect textbook diagram.`,
    ...(region.length ? ["", ...region] : []),
    ``,
    ...ACQUISITION_REALISM.prompt,
    ``,
    // Precedence: osteopetrosis in a child must not be forced into the child band's "slender
    // bones with a wide medullary canal", and a pathology that reshapes the film wins over any
    // realism instruction above.
    `Where the stated pathology changes any of the above, the PATHOLOGY WINS.`,
    ``,
    `Include realistic surrounding anatomy, soft tissues, and authentic radiographic grain.`,
    ``,
    // "no labels" dropped: a lead side marker is now wanted (see ACQUISITION_REALISM).
    `Radiology style: diagnostic-quality radiograph, authentic grayscale contrast, natural X-ray`,
    `grain, no cinematic glow, no artificial sharpening, no arrows or annotations.`,
    ``,
    `High-resolution medical imaging. De-identified. No patient identifiers. No hospital branding.`,
    `No watermark.`,
    ``,
    `Avoid these AI artifacts: duplicated or mirrored bones, a floating bone or tooth detached from the`,
    `skeleton, merged or melted cortical bone, teeth outside the arch, an extra scapula/clavicle/rib, the`,
    `wrong number of fingers or toes, a single fused forearm bone, and uniform stippled noise standing in for`,
    `real tissue texture.`,
  ];
  if (opts.emphasis) lines.push(``, opts.emphasis);
  if (opts.avoid?.length) {
    lines.push(``, `Avoid these specific errors from a previous attempt: ${opts.avoid.slice(0, 4).join("; ")}.`);
  }
  return lines.join("\n");
}
