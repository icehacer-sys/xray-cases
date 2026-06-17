// gpt-image-2 carousel slide generation (owner chose AI-generated slides over the
// rendered template). The case X-ray is composited via the image-edit endpoint so the
// SAME X-ray appears on every slide and matches the Threads post. Prompts spell out the
// exact text; image models can still garble text, so output is reviewed before posting.

import { generateSlideImage } from "./openai.js";
import type { Case, Condition } from "./types.js";

const LETTERS = ["A", "B", "C"] as const;

const STYLE =
  "A 1080x1080 square Instagram slide for a medical 'guess the diagnosis' series. " +
  "Deep navy background (#070b16) with cyan (#22d3ee) accents and clean white sans-serif text. " +
  "Render every piece of text crisply and CORRECTLY SPELLED, exactly as written, with no extra, " +
  "missing, or misspelled words. Modern, minimal, high-contrast, professional medical look.";

export async function generateSlides(
  _c: Case,
  cond: Condition,
  xrayPng: Buffer,
): Promise<{ question: Buffer; answer: Buffer; cta: Buffer }> {
  const options = cond.igOptions.map((o, i) => `${LETTERS[i]}  ${o}`).join("\n");

  const questionPrompt =
    `${STYLE} Use the PROVIDED X-ray exactly as given (do not redraw, alter, or replace it), ` +
    `placed centered inside a cyan-bordered scanner frame. Small label top-left "WEIRD X-RAY CASE FILES". ` +
    `Bold headline near the top: "${cond.igTitle}". Below the X-ray a cyan ` +
    `line "WHAT IS THE DIAGNOSIS?" then three answer options each on its own line:\n${options}\n` +
    `A small pill at the very bottom reads "SWIPE TO REVEAL".`;

  const answerPrompt =
    `${STYLE} Use the PROVIDED X-ray exactly as given (do not alter it), in a smaller cyan-bordered ` +
    `frame on the right side. Small label top-left "WEIRD X-RAY CASE FILES" and an orange "ANSWER" tag ` +
    `top-right. Large heading on the left: "ANSWER: ${cond.diagnosis}". Under it: "Correct option: ${cond.igCorrect}". ` +
    `Then two short labeled blocks: "WHAT YOU SEE — ${cond.whatYouSee}" and "WHY IT MATTERS — ${cond.whyItMatters}". ` +
    `A small grey footer reads "Educational entertainment only. Not medical advice.".`;

  const ctaPrompt =
    `${STYLE} No X-ray. Centered composition. Small label near the top "WEIRD X-RAY CASE FILES". ` +
    `A huge two-line headline: "A NEW CASE" in white above "EVERY DAY" in cyan. A short orange ` +
    `divider line under it. A subline "Can you think like a doctor?". An outlined cyan pill button ` +
    `"FOLLOW @mdnoteslab". A small grey footer "Educational entertainment only. Not medical advice.".`;

  const [question, answer, cta] = await Promise.all([
    generateSlideImage(questionPrompt, xrayPng),
    generateSlideImage(answerPrompt, xrayPng),
    generateSlideImage(ctaPrompt),
  ]);
  return { question, answer, cta };
}
