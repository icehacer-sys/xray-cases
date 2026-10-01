// Optional reference radiograph for a condition: a cleaned crop of a teaching image from the
// owner's lecture atlas. It steers HOW the finding looks; the anatomy guide still steers the rest.
//
// References live in a LOCAL folder outside this repo (BOT_REFERENCE_DIR). This repo is public,
// so committing them would republish lecture images; only the generated film is committed.
// Conditions with a reference therefore render locally, and the CI top-up skips them.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { config } from "./config.js";
import type { Condition } from "./types.js";

export const REFERENCE_PROMPT = [
  "REFERENCE IMAGE: the attached radiograph is a teaching example of this finding from a different patient.",
  "Match how the finding looks in it: location, shape, density, extent and multiplicity.",
  "Do not copy the reference. Draw a new patient with different positioning, framing, body habitus and exposure.",
  "Never reproduce any text, letters, numbers, arrows, circles, markers, logos or annotations from the reference.",
  "Every anatomy rule above still applies, including exact bone and digit counts.",
].join(" ");

export function referencePath(cond: Pick<Condition, "referenceImage">): string | undefined {
  if (!cond.referenceImage) return undefined;
  return isAbsolute(cond.referenceImage) ? cond.referenceImage : resolve(config.referenceDir, cond.referenceImage);
}

/** False only when the condition names a reference that is not on this machine (e.g. in CI). */
export function referenceAvailable(cond: Pick<Condition, "referenceImage">): boolean {
  const path = referencePath(cond);
  return !path || existsSync(path);
}

/** Never silently renders a reference condition from text alone. */
export function loadReference(cond: Pick<Condition, "referenceImage" | "diagnosis">): Buffer | undefined {
  const path = referencePath(cond);
  if (!path) return undefined;
  if (!existsSync(path)) throw new Error(`Reference image for ${cond.diagnosis} not found at ${path}; render it where BOT_REFERENCE_DIR holds the references`);
  return readFileSync(path);
}
