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
  /** IG slide A/B/C options as shown on the user's slide image (for context only). */
  igOptions?: string[];

  // --- images (filenames inside the case folder) ---
  threadsImage: string; // the X-ray for the Threads challenge
  igSlides: string[]; // ordered carousel images, e.g. ["question.png","answer.png","cta.png"]

  // --- scheduling ---
  postAt: string; // ISO datetime to publish the challenge
  cta?: CtaKey; // which CTA to use under the pinned answer (rotates if absent)

  // --- filled by the tool ---
  generated?: {
    threadsCaption?: string;
    threadsAnswer?: string;
    igCaption?: string;
    ctaText?: string;
  };
  stages?: {
    challengePostedAt?: string;
    threadsPostId?: string;
    answerPostedAt?: string;
    answerCommentId?: string;
    ctaPostedAt?: string;
    igPostedAt?: string;
    igMediaId?: string;
  };
}

export type CtaKey = "vol2" | "rare" | "vol1";

/** A resolved public image URL for a case file (built from config.githubRawBase). */
export type ImageUrl = string;
