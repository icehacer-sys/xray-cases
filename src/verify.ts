// Vision QA gate for generated X-rays. gpt-image-2 sometimes renders anatomically
// IMPOSSIBLE images (duplicated/extra bones, wrong body part, melted bone). Before a
// generated case is queued, Claude (vision) checks the X-ray against the expected
// diagnosis and rejects AI artifacts so they never auto-post. Motivated by the
// Sprengel-deformity incident: gpt-image-2 drew TWO scapulae on one side (a normal one
// plus an extra elevated one) and it auto-posted publicly.
import Anthropic from "@anthropic-ai/sdk";
import { config, requireEnv } from "./config.js";
import type { Condition } from "./types.js";

export interface XrayVerdict {
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
  "Respond with ONLY a JSON object and no other text.";

function userPrompt(cond: Condition): string {
  return [
    `Expected diagnosis: ${cond.diagnosis}`,
    `Expected view: ${cond.view}`,
    `Expected key findings: ${cond.keyFindings}`,
    ``,
    `Examine the attached X-ray systematically: count paired structures, trace each bone, count`,
    `digits/ribs/vertebrae, confirm every organ/device is singular and correctly placed, and confirm the`,
    `body part and view match. Distinguish real pathology from AI duplication/garbling artifacts.`,
    ``,
    `Return ONLY this JSON:`,
    `{"plausible": boolean, "depictsDiagnosis": boolean, "correctBodyPart": boolean, "defects": [string], "severity": "pass"|"minor"|"critical"}`,
    `severity = "critical" if there is any clear AI anatomical impossibility (duplicated/extra bone or organ,`,
    `wrong number of limbs/digits, wrong body part) — these must not post. "minor" for small but believable`,
    `imperfections. "pass" if it is a believable radiograph of the diagnosis.`,
  ].join("\n");
}

/** Ask Claude (vision) whether a generated X-ray is anatomically safe to post. */
export async function verifyXray(png: Buffer, cond: Condition): Promise<XrayVerdict> {
  const res = await client().messages.create({
    model: config.xrayVerifyModel,
    max_tokens: 700,
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
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  // The model sometimes wraps the JSON in prose or code fences; extract the object itself.
  const m = text.match(/\{[\s\S]*\}/);
  const json = (m ? m[0] : text).trim();
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(json) as Record<string, unknown>;
  } catch {
    // Unparseable verifier output → fail safe to manual review (never silently pass).
    return {
      ok: false,
      severity: "minor",
      plausible: false,
      depictsDiagnosis: false,
      correctBodyPart: false,
      defects: ["X-ray verifier returned unparseable output; needs manual review"],
      raw: text,
    };
  }
  const severity: XrayVerdict["severity"] =
    p.severity === "critical" ? "critical" : p.severity === "minor" ? "minor" : "pass";
  return {
    ok: severity !== "critical",
    severity,
    plausible: !!p.plausible,
    depictsDiagnosis: !!p.depictsDiagnosis,
    correctBodyPart: !!p.correctBodyPart,
    defects: Array.isArray(p.defects) ? p.defects.map(String) : [],
    raw: text,
  };
}
