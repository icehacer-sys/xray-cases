// Vision QA gate for generated X-rays. gpt-image-2 sometimes renders anatomically
// IMPOSSIBLE images (duplicated/extra bones, wrong body part, melted bone). Before a
// generated case is queued, Claude (vision) checks the X-ray against the expected
// diagnosis and rejects AI artifacts so they never auto-post. Motivated by the
// Sprengel-deformity incident: gpt-image-2 drew TWO scapulae on one side (a normal one
// plus an extra elevated one) and it auto-posted publicly.
import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "./usage.js";
import { config, requireEnv } from "./config.js";
import { verifyExtraLines } from "./anatomy.js";
import type { Condition } from "./types.js";

export interface XrayVerdict {
  observations?: { expected: string; observed: string; assessable: boolean; matches: boolean }[];
  ok: boolean; // safe to post (no critical AI artifact)
  severity: "pass" | "minor" | "critical";
  plausible: boolean;
  depictsDiagnosis: boolean;
  correctBodyPart: boolean;
  defects: string[];
  raw: string;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return _client;
}

const SYSTEM =
  "You are a radiologist doing strict QA on an AI-GENERATED X-ray before it is posted publicly to a large " +
  "audience. gpt-image-2 frequently makes anatomical IMPOSSIBILITIES: duplicated or extra bones/organs, " +
  "missing or merged structures, the wrong number of fingers/ribs/limbs/vertebrae, mirrored or doubled " +
  "anatomy, melted/garbled bone, wrong laterality, impossible joints, or the wrong body part. Genuine " +
  "pathology (deformity, fracture, fragmentation, a medical device) is EXPECTED and must NOT be flagged — " +
  "only flag AI artifacts. A real defect that slipped through once: a Sprengel deformity X-ray that drew " +
  "TWO scapulae on one side (a normal one PLUS an extra elevated one) instead of a single high scapula. " +
  "A CORRECT primary lesion does NOT rescue an image whose surrounding NON-pathological anatomy is impossible " +
  "— judge the WHOLE film. Flag critical if EITHER the primary finding is wrong or absent, OR any " +
  "non-pathological structure has an AI impossibility (a floating or duplicated bone or tooth, a garbled or " +
  "incoherent dental arch, a fused paired bone, the wrong digit count). " +
  "These images are deliberately generated to look like REAL SCANNED RADIOGRAPHS, so normal acquisition " +
  "characteristics are intended and must NEVER be reported as defects: collimation borders, uneven exposure " +
  "or a density gradient, scatter haze, film grain, slightly rotated or off-centre positioning, overlying " +
  "skin folds or bowel gas or clothing, with no lettering or lead side marker. Image quality must permit assessment. " +
  "Age determines skeletal maturity, not mandatory osteopenia or " +
  "degenerative change. Do not reject an older patient for absent degeneration. " +
  "Respond with ONLY a JSON object and no other text.";

function userPrompt(cond: Condition): string {
  // Region, device, AGE and realism-tolerance checks all come from the shared anatomy table
  // (src/anatomy.ts) — the same rules that steered the generation prompt, so the verifier
  // inspects for exactly the impossibilities the generator was told to avoid, and does not
  // reject the acquisition realism the generator was told to produce.
  const extra = verifyExtraLines(cond);
  return [
    `Expected diagnosis: ${cond.diagnosis}`,
    `Expected view: ${cond.view}`,
    `Expected key findings: ${cond.keyFindings}`,
    `Required observations, in this exact order: ${JSON.stringify(cond.requiredObservations ?? [cond.keyFindings])}`,
    ``,
    `Examine the attached X-ray systematically: count paired structures, trace each bone, count`,
    `digits/ribs/vertebrae, confirm case-specific structure/device counts and placement, and confirm the`,
    `body part and view match. Distinguish real pathology from AI duplication/garbling artifacts.`,
    ...(extra.length ? ["", ...extra] : []),
    ``,
    `Return ONLY this JSON:`,
    `Include an observations array: one {expected:string, observed:string, assessable:boolean, matches:boolean} for EACH required observation in order. Quote expected exactly. Describe what is actually visible before judging a match. Do not assume the expected diagnosis is correct. Unassessable required findings must fail.`,
    `{"plausible": boolean, "depictsDiagnosis": boolean, "correctBodyPart": boolean, "defects": [string], "severity": "pass"|"minor"|"critical"}`,
    `severity = "critical" if there is any clear AI anatomical impossibility (duplicated/extra bone or organ,`,
    `wrong number of limbs/digits, wrong body part, or a garbled/floating/duplicated dental arch) — these must`,
    `not post. "minor" for small but believable imperfections. "pass" only if it is a believable radiograph of`,
    `the diagnosis WITH coherent surrounding anatomy.`,
  ].join("\n");
}

/** Ask Claude (vision) whether a generated X-ray is anatomically safe to post. */
export async function verifyXray(png: Buffer, cond: Condition): Promise<XrayVerdict> {
  const res = await client().messages.create({
    model: config.xrayVerifyModel,
    max_tokens: 1600,
    output_config: { format: { type: "json_schema", schema: {
      type: "object", additionalProperties: false, required: ["plausible", "depictsDiagnosis", "correctBodyPart", "defects", "severity", "observations"],
      properties: { plausible: { type: "boolean" }, depictsDiagnosis: { type: "boolean" }, correctBodyPart: { type: "boolean" }, defects: { type: "array", items: { type: "string" } }, severity: { type: "string", enum: ["pass", "minor", "critical"] }, observations: { type: "array", items: { type: "object", additionalProperties: false, required: ["expected", "observed", "assessable", "matches"], properties: { expected: { type: "string" }, observed: { type: "string" }, assessable: { type: "boolean" }, matches: { type: "boolean" } } } } },
    } } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
          { type: "text", text: userPrompt(cond) },
        ],
      },
    ],
  });
  recordUsage("image-qa", config.xrayVerifyModel, res.usage);
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return parseXrayVerdict(text, cond, res.stop_reason);
}

/** Treat model output as untrusted data, including syntactically valid but contradictory JSON. */
export function parseXrayVerdict(text: string, cond: Condition, stopReason: string | null = "end_turn"): XrayVerdict {
  const reject = (reason: string): XrayVerdict => ({
    ok: false, severity: "critical", plausible: false, depictsDiagnosis: false,
    correctBodyPart: false, defects: [reason], raw: text,
  });
  if (stopReason !== "end_turn") return reject(`X-ray verifier did not finish (${stopReason}); needs review`);
  const json = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1");
  let p: unknown;
  try {
    p = JSON.parse(json);
  } catch {
    return reject("X-ray verifier returned unparseable output; needs manual review");
  }
  if (!p || typeof p !== "object" || Array.isArray(p)) return reject("X-ray verifier must return an object");
  const v = p as Record<string, unknown>;
  const required = cond.requiredObservations ?? [cond.keyFindings];
  if (!Array.isArray(v.observations) || v.observations.length !== required.length || !v.observations.every((o, i) => o && typeof o === "object" && o.expected === required[i] && typeof o.observed === "string" && o.observed.trim() && typeof o.assessable === "boolean" && typeof o.matches === "boolean")) return reject("Missing or invalid required observations");
  if (v.observations.some(o => !o.assessable || !o.matches)) return reject("A required image finding is absent or not assessable: " + v.observations.filter(o => !o.assessable || !o.matches).map(o => o.observed).join("; "));
  if (typeof v.plausible !== "boolean" || typeof v.depictsDiagnosis !== "boolean" ||
      typeof v.correctBodyPart !== "boolean" || typeof v.severity !== "string" || !["pass", "minor", "critical"].includes(v.severity) ||
      !Array.isArray(v.defects) || !v.defects.every((d) => typeof d === "string" && d.trim().length > 0)) {
    return reject("X-ray verifier returned invalid field types or missing fields; needs review");
  }
  const severity = v.severity as XrayVerdict["severity"];
  const depictsDiagnosis = v.depictsDiagnosis;
  const correctBodyPart = v.correctBodyPart;
  const plausible = v.plausible;
  const defects = [...v.defects] as string[];
  if (severity === "pass" && defects.length) return reject("X-ray verifier reported defects with a pass verdict; needs review");
  // A believable film that shows the WRONG body part, or does not actually depict the expected
  // pathology, is as bad as an AI artifact for a "guess the diagnosis" post — the pinned answer
  // would name something the image doesn't show. Fail QA on those too (not just anatomical
  // impossibilities), so the case regenerates and, if it keeps failing, is held for review.
  if (!correctBodyPart) defects.push(`wrong body part or view (expected ${cond.view})`);
  if (!depictsDiagnosis) defects.push(`image does not convincingly show ${cond.diagnosis}`);
  if (!plausible) defects.push("image is not anatomically plausible");
  return {
    ok: severity !== "critical" && plausible && depictsDiagnosis && correctBodyPart,
    observations: v.observations,
    severity,
    plausible,
    depictsDiagnosis,
    correctBodyPart,
    defects,
    raw: text,
  };
}
