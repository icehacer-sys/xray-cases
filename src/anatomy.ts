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

/** All region rules whose matcher fires for this view (head-to-toe order preserved). */
export function matchedRegions(view: string): RegionRule[] {
  const v = view.toLowerCase();
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
