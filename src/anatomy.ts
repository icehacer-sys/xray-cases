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
      `stated pathology. Use age-appropriate dentition, including normal mixed dentition in children, never a`,
      `chaotic mix). Upper and lower arches mirror-consistent in tooth count and spacing. Every tooth except`,
      `the described lesion is normal and correctly positioned. One mandible with two symmetric rami and`,
      `condyles; the two temporomandibular joints match.`,
    ],
    verify: [
      `TEETH CHECK (this view shows teeth): count the teeth in the upper arch and the lower arch. Confirm a`,
      `SINGLE continuous arch per jaw with every tooth seated in alveolar bone — no floating, duplicated,`,
      `fused, or supernumerary teeth beyond the stated pathology — and ONE age-appropriate dentition (not a`,
      `chaotic distribution; normal mixed dentition in children is allowed). Confirm ONE mandible with`,
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
  prompt: ['DEVICE: follow the case-specific number, course, connections and endpoints. Connected components must have a continuous plausible path. Multiple components, bilateral systems and disconnected objects are allowed only when specified by the case. Do not invent duplicate hardware.'],
  verify: ['DEVICE CHECK: report the visible number, course, connections and endpoints. Judge these against this case, not a universal one-device or one-side rule. Do not assume an occluded segment is absent; mark uncertainty if an essential connection cannot be assessed.'],
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
const AGE_RULES: Record<AgeBand, AgeRule> = Object.fromEntries([
  ['infant', 'an infant under 2 years old', 'immature ossification appropriate to the visible anatomy'],
  ['child', 'a child aged 3 to 11', 'open physes where visible; normal mixed dentition is allowed'],
  ['adolescent', 'an adolescent aged 12 to 18', 'maturing skeleton; physeal closure varies by site and age'],
  ['young-adult', 'an adult aged 19 to 39', 'skeletally mature visible anatomy'],
  ['middle-aged', 'an adult aged 40 to 59', 'skeletally mature visible anatomy'],
  ['older', 'an adult over 60', 'skeletally mature visible anatomy; degeneration is variable, not mandatory'],
].map(([band, who, maturity]) => [band, { who, prompt: [maturity + '. Do not invent degeneration, osteopenia or vascular calcification unless specified. Apply maturity only inside the field of view.'], verify: [maturity] }])) as Record<AgeBand, AgeRule>;

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
    inferAgeBand([cond.symptom, cond.view, cond.hook].filter(Boolean).join(" "));
  if (!band) return ["Age unspecified: use consistent skeletal maturity; do not invent an age or mandatory degenerative findings."];
  const rule = AGE_RULES[band];
  return kind === "prompt"
    ? [`PATIENT: ${rule.who}. Render the skeleton and soft tissues of a patient of this age.`, ...rule.prompt]
    : [
        `AGE CHECK: the patient is ${rule.who}. Confirm skeletal maturity matches — ${rule.verify.join(" ")}.`,
        'Assess maturity only where visible. Absence of degeneration in an older adult is not a defect.',
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
    `  lighter from greater attenuation. Air is dark; bone and metal are light.`,
    `- Scatter softens the soft tissues into a smooth grey haze rather than a clean cutout.`,
    `- Positioning is very slightly imperfect. The patient sits a degree or two rotated or off centre the way a`,
    `  real person does. Do not centre it perfectly.`,
    `- Real overlying shadows cross the anatomy: skin folds, breast or pectoral soft tissue, bowel gas, hair or`,
    `  a clothing edge, exactly as they do on a genuine film.`,
    `- Fine even film grain over the whole image including the black background.`,
    // NO side marker. It was tried and dropped by the owner: any rendered letter is the single
    // most obvious "this was generated" tell if it comes out malformed, and it adds nothing the
    // audience reads. Keep the film free of ALL lettering.
    `- NO lettering anywhere on the film. No lead side marker, no L or R, no letters, numbers, dates,`,
    `  names or any other text or annotation of any kind.`,
    `All of the above is NORMAL IMAGING PHYSICS. None of it may look like digital damage: no smearing, no melted`,
    `anatomy, no repeated texture patches, no uniform stippled noise standing in for tissue, and the primary`,
    `finding stays clearly visible through all of it.`,
  ],
  verify: [
    `REALISM IS EXPECTED AND MUST NOT BE FLAGGED: collimation borders, uneven exposure, a density gradient,`,
    `scatter haze, film grain, slightly rotated or off-centre positioning, and overlying skin folds, bowel gas`,
    `or clothing are all normal features of a genuine radiograph. Only flag AI impossibilities in the ANATOMY.`,
    `NO LETTERING: the film must carry no text at all — no lead L or R side marker, no letters, numbers or`,
    `annotation. Any lettering present is a defect and should be reported.`,
  ],
};

/**
 * Everything the VERIFIER should check beyond the generic pass: region rules, device coherence,
 * age, and the realism-tolerance clause. Kept here so generation and QA compose from one source.
 */
export function verifyExtraLines(
  cond: Pick<Condition, "view" | "diagnosis" | "keyFindings"> &
    Partial<Pick<Condition, "symptom" | "hook">> & { ageBand?: AgeBand; anatomyException?: string },
): string[] {
  return [
    "Assess only anatomy visible in this field and projection. Do not count off-frame or superimposed structures as absent. If a required finding is not assessable, do not pass it.",
    ...regionVerifyLines(cond.view),
    ...deviceLines(cond, "verify"),
    ...ageLines(cond, "verify"),
    ...ACQUISITION_REALISM.verify,
    // LAST so it is read as overriding the checks above rather than being overridden by them.
    ...exceptionLines(cond.anatomyException, "verify"),
  ];
}

/**
 * A declared, per-case departure from normal anatomy.
 *
 * The region rules and the QA gate are deliberately absolute — "five digits", "never a fused
 * bone", "one humeral head per glenoid" — because those catch the AI artifacts that motivated
 * the gate. But a whole class of real diagnoses IS one of those violations: mirror hand has
 * seven digits and two ulnae, a synostosis is a fused bone, a dislocation is a head out of its
 * socket. Without a declared exception those cases burn every regeneration attempt and land in
 * needsReview forever, because the generator is told not to draw the finding and the verifier
 * is told to reject it.
 *
 * Scoped on purpose. Only the named departure is excused; everything else on the film is still
 * judged by the normal rules, so this cannot become a blanket "anything goes".
 */
export function exceptionLines(exception: string | undefined, kind: "prompt" | "verify"): string[] {
  const e = exception?.trim();
  if (!e) return [];
  return kind === "prompt"
    ? [
        `DECLARED ANATOMICAL EXCEPTION. This case OVERRIDES the general anatomy rules above:`,
        `  ${e}`,
        `That departure IS the diagnosis and must be rendered exactly as described. It is not an error.`,
        `Every OTHER anatomical rule above still applies in full: outside this one declared exception the`,
        `film must be normal, correctly counted and bilaterally consistent.`,
      ]
    : [
        `DECLARED ANATOMICAL EXCEPTION for this case:`,
        `  ${e}`,
        `This departure is EXPECTED and is the diagnosis itself. Do NOT report it as an AI artifact and do`,
        `NOT fail the image for it, even though it contradicts the general checks above. Judge every OTHER`,
        `structure by the normal rules — an impossibility OUTSIDE the declared exception is still critical,`,
        `and an image that does NOT show the declared departure has failed to depict the diagnosis.`,
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
    Partial<Pick<Condition, "symptom" | "hook">> & { ageBand?: AgeBand; anatomyException?: string },
  opts: { avoid?: string[]; emphasis?: string } = {},
): string {
  const lines = [
    'Create a de-identified educational radiograph simulation: ' + cond.view + '.',
    'Required diagnostic pattern: ' + cond.diagnosis + ': ' + cond.keyFindings,
    'Show ONE coherent diagnostic pattern, including all affected structures and multiplicity specified by this case. Do not add unrelated lesions.',
    'Anatomy constraints apply ONLY to structures visible in this field and projection. Do not add off-frame anatomy to satisfy a count. Normal superimposition is allowed; duplicated or melted anatomy is not.',
    ...ageLines(cond, 'prompt'), ...regionPromptLines(cond.view), ...deviceLines(cond, 'prompt'),
    ...ACQUISITION_REALISM.prompt,
    'Use coherent radiographic attenuation and projection geometry throughout. Avoid diagram-like contours, uniformly etched trabeculae, polished teeth or bones, artificial sharpening and decorative noise. Preserve clinical acquisition fidelity rather than cosmetic perfection.',
    'Keep the diagnostic finding assessable. No labels, lettering, lead markers, arrows, hospital branding or watermarks.',
    'The stated pathology takes precedence over generic normal-anatomy constraints.',
    ...exceptionLines(cond.anatomyException, 'prompt'),
  ];
  if (opts.emphasis) lines.push(``, opts.emphasis);
  if (opts.avoid?.length) {
    lines.push(``, `Avoid these specific errors from a previous attempt: ${opts.avoid.slice(0, 4).join("; ")}.`);
  }
  return lines.join("\n");
}
