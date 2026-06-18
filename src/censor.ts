// Blur external genitalia on a generated image so Threads/IG do not flag the post as
// sensitive/adult. A Claude vision pass locates the genital/groin region (if any) and sharp
// applies a heavy local blur. No-op when nothing is detected or the verifier/key is absent
// (fails open so it never blocks the pipeline). Used on the X-ray and, when the X-ray had a
// region blurred, on the composited IG slides too.
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { config, requireEnv } from "./config.js";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return _client;
}

const SYSTEM =
  "You check an image (usually a medical X-ray) for any visible EXTERNAL GENITAL or GROIN region that an " +
  "automated nudity filter on Instagram or Threads might flag. On a FRONTAL pelvic, hip, lower-abdomen, or " +
  "lower-body/leg X-ray the external genital area (the soft-tissue region between the upper thighs and below " +
  "the pubic bones) is usually visible and MUST be flagged for blurring even when it is faint or only a " +
  "soft-tissue shadow. Err STRONGLY on the side of flagging: if any groin or genital soft tissue is in frame, " +
  "flag it. Return present=false ONLY when the image clearly has no groin in frame (for example a skull, " +
  "chest, hand, arm, or foot X-ray). Respond with ONLY a JSON object.";

const USER = [
  "Is any external genital or groin region visible in this image (including a faint soft-tissue shadow",
  "between the upper thighs on a frontal pelvic or lower-body X-ray)?",
  "If yes, give a TIGHT bounding box covering ONLY the external genital soft tissue (the central bulge",
  "between the upper thighs, just below the pubic bones) with a small margin. Do NOT extend the box over the",
  "femurs, hip bones, knees, or lower legs — keep it focused on the genital area so diagnostic bones stay",
  "sharp. The box is normally small and centered horizontally.",
  'Return ONLY: {"present": boolean, "box": {"x": number, "y": number, "w": number, "h": number}}',
  "x,y = top-left corner; w,h = width,height; all 0-1 fractions. If present is false, box may be zeros.",
].join("\n");

export interface CensorResult {
  censored: boolean;
  box?: { x: number; y: number; w: number; h: number };
}

/** Blur external genitalia on a PNG if present. Fails open (returns the input unchanged) on
 *  any detection error so it never blocks generation. */
export async function censorXray(png: Buffer): Promise<{ png: Buffer; result: CensorResult }> {
  if (!config.censorGenitals) return { png, result: { censored: false } };

  let parsed: { present?: boolean; box?: { x: number; y: number; w: number; h: number } };
  try {
    const res = await client().messages.create({
      model: config.xrayVerifyModel,
      max_tokens: 200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
            { type: "text", text: USER },
          ],
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return { png, result: { censored: false } }; // detection failed (e.g. no key) → leave unchanged
  }

  if (!parsed?.present || !parsed.box) return { png, result: { censored: false } };

  try {
    const pad = 0.035; // grow the detected box for safety against imprecise model coordinates
    const box = {
      x: Math.max(0, (Number(parsed.box.x) || 0) - pad),
      y: Math.max(0, (Number(parsed.box.y) || 0) - pad),
      w: (Number(parsed.box.w) || 0) + pad * 2,
      h: (Number(parsed.box.h) || 0) + pad * 2,
    };
    const out = await blurBox(png, box);
    if (out === png) return { png, result: { censored: false } };
    return { png: out, result: { censored: true, box } };
  } catch {
    return { png, result: { censored: false } }; // any sharp error → leave unchanged
  }
}

/** Heavily blur a normalized [0-1] box of a PNG (no detection). Returns the input unchanged
 *  if the box is degenerate. Exported so a known region can be censored directly. */
export async function blurBox(png: Buffer, box: { x: number; y: number; w: number; h: number }): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return png;
  const left = Math.max(0, Math.round(box.x * W));
  const top = Math.max(0, Math.round(box.y * H));
  const width = Math.min(W - left, Math.round(box.w * W));
  const height = Math.min(H - top, Math.round(box.h * H));
  if (width < 8 || height < 8) return png;
  const sigma = Math.max(18, Math.round(Math.min(width, height) / 6));
  // Blur the region, then feather its edges with a radial alpha mask so it reads as a soft
  // smudge rather than a hard rectangle.
  const blurred = await sharp(png).extract({ left, top, width, height }).blur(sigma).ensureAlpha().toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><radialGradient id="g" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#fff" stop-opacity="1"/>` +
      `<stop offset="58%" stop-color="#fff" stop-opacity="1"/>` +
      `<stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="${width}" height="${height}" fill="url(#g)"/></svg>`,
  );
  const feathered = await sharp(blurred).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp(png).composite([{ input: feathered, left, top }]).png().toBuffer();
}

/** Blur genitalia repeatedly until a detection pass finds none (compensates for imprecise
 *  single-shot box placement). Returns the censored PNG, whether anything was blurred, and
 *  whether genitalia are STILL detected after maxPasses (caller should hold those for review
 *  so exposed genitalia can never auto-post). */
export async function censorUntilClean(
  png: Buffer,
  maxPasses = 3,
): Promise<{ png: Buffer; blurred: boolean; stillExposed: boolean }> {
  let cur = png;
  let blurred = false;
  let lastDetected = false;
  for (let i = 0; i < maxPasses; i++) {
    const r = await censorXray(cur);
    lastDetected = r.result.censored;
    if (lastDetected) blurred = true;
    cur = r.png;
    if (!lastDetected) break; // a pass found nothing → clean
  }
  return { png: cur, blurred, stillExposed: lastDetected };
}
