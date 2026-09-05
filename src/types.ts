// Shared types — the CONTRACT every module is built against. Do not change these
// signatures without updating SPEC.md and all modules.

/**
 * One queued case. Lives at cases/<folder>/case.json. The author fills the top
 * block (diagnosis + a few inputs + image filenames + postAt); the tool fills the
 * `generated` block on first run and the `stages` block as it posts. Anything in
 * `generated` can be hand-edited before postAt to override the drafted wording.
 */
export interface Case {
  /** Folder name under cases/, e.g. "00001-giant-gallstone". Set by the loader. */
  folder: string;
  /** Sequential case number (for "Case File 07"). Assigned by the loader if absent. */
  number?: number;

  // --- author inputs ---
  diagnosis: string; // e.g. "Giant Gallstone"
  aliases?: string[]; // other acceptable phrasings
  symptom: string; // e.g. "abdominal discomfort"  -> "A patient came in with <symptom>."
  hook: string; // e.g. "it looked like someone had hidden a giant pearl inside the abdomen"
  /** Optional owner-written breakdown facts; if absent the tool drafts them (review before postAt). */
  whatYouSee?: string;
  whyItMatters?: string;
  treatment?: string;
  takeaway?: string;
  /** Engagement fields — drafted by captions.draftEngagement, all NON-spoiling. `difficulty`
   *  (1-5) renders as "Difficulty x/5"; `laypersonQuestion` is the no-medical-knowledge secondary
   *  ask; `seedHint` is the author's first-comment nudge auto-posted seconds after the challenge. */
  difficulty?: number;
  laypersonQuestion?: string;
  seedHint?: string;
  /** IG slide A/B/C options as shown on the user's slide image (for context only). */
  igOptions?: string[];

  // --- images (filenames inside the case folder) ---
  threadsImage: string; // the X-ray for the Threads challenge
  igSlides: string[]; // ordered carousel images, e.g. ["question.png","answer.png","cta.png"]

  // --- scheduling ---
  postAt: string; // ISO datetime to publish the challenge
  cta?: CtaKey; // which CTA to use under the pinned answer (rotates if absent)

  // --- review gate ---
  /** A generated case must be approved before the publisher will post it (unless config.autoApprove). */
  approved?: boolean;
  /** "manual" = user-made images; "generated" = produced by the auto-generator. */
  source?: "manual" | "generated";
  /** The source Condition, kept on the case so the slides can be re-rendered after
   *  you swap in your own X-ray (the manual workflow). */
  condition?: Condition;

  /** Owner override to post a diagnosis already in used-diagnoses.json — a deliberate one-off
   *  (e.g. cross-promoting a new product with a case covered once before). Never set by the
   *  auto-generator; skips the no-repeat gate for THIS case only. */
  forceRepeat?: boolean;
  /** Set by the generator's X-ray anatomy-QA gate when the image fails verification after
   *  all retries. The publisher HARD-BLOCKS these (no auto-post, even with BOT_AUTO_APPROVE)
   *  until a human regenerates the X-ray and clears the flag. */
  needsReview?: boolean;
  verifyDefects?: string[];

  // --- filled by the tool ---
  generated?: {
    threadsCaption?: string;
    /** Hook-framing experiment B arm: the same case with its opening tension foregrounded.
     *  "" means drafted but the case had no genuine tension to surface (a valid outcome);
     *  undefined means never drafted. */
    threadsCaptionAlt?: string;
    threadsAnswer?: string;
    igCaption?: string;
    ctaText?: string;
  };
  stages?: {
    challengePostedAt?: string;
    threadsPostId?: string;
    seedPostedAt?: string;
    seedCommentId?: string;
    answerPostedAt?: string;
    answerCommentId?: string;
    ctaPostedAt?: string;
    igPostedAt?: string;
    igMediaId?: string;
    fbPostedAt?: string;
    fbPostId?: string;
    fbAnswerPostedAt?: string;
    fbAnswerCommentId?: string;
  };
}

export type CtaKey = "support" | "hopital" | "spotit" | "collection" | "vol2" | "rare" | "vol1" | "vol3" | "field" | "anxiety" | "viral10" | "ctvol1";

/** A resolved public image URL for a case file (built from config.githubRawBase). */
export type ImageUrl = string;

/**
 * Patient age band for a generated X-ray. A band rather than a number because each one maps to
 * concrete radiographic features the image model can actually draw (open physes, endplate
 * sclerosis, calcified costal cartilage). The per-band wording lives in anatomy.ts.
 */
export type AgeBand = "infant" | "child" | "adolescent" | "young-adult" | "middle-aged" | "older";

/**
 * One entry in the vetted condition pool (data/conditions.json). The auto-generator
 * draws the next `used: false` condition, generates its X-ray + slides, and turns it
 * into a Case. The medical facts here are owner-vetted — the source of truth.
 */
export interface Condition {
  diagnosis: string; // "Maffucci syndrome"
  aliases?: string[];
  symptom: string; // "abdominal discomfort"
  hook: string; // "it looked like someone had hidden a giant pearl inside the abdomen"
  view: string; // radiograph view for the image prompt, e.g. "PA hand" / "AP chest"
  keyFindings: string; // the classic radiographic signs, for the X-ray image prompt
  // breakdown (real, vetted facts)
  whatYouSee: string;
  whyItMatters: string;
  treatment: string;
  takeaway: string;
  // IG slide content
  igTitle: string; // "THE HAND OF STONES"
  igOptions: [string, string, string]; // the A/B/C choices shown on the question slide
  igCorrect: "A" | "B" | "C"; // which option is right
  /** Patient age band for the image. Drives skeletal maturity and age-appropriate degeneration
   *  in the X-ray prompt AND the QA gate, so a 70-year-old does not get a pristine young spine.
   *  Optional: when absent the band is inferred from symptom/view/hook, else defaults to
   *  young-adult. Required on all NEW conditions. See AgeBand in anatomy.ts. */
  ageBand?: AgeBand;
  /** Set true once the generator has produced a case from it (so it is never reused). */
  used?: boolean;
  /** Set true to permanently exclude from auto-generation (e.g. pelvic/groin/full-lower-body
   *  views that Meta suppresses as sensitive). The generator never picks these. */
  skipPublic?: boolean;
}
