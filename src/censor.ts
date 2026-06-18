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
  "You check an image (usually a medical X-ray) for visible EXTERNAL GENITALIA or explicit groin " +
  "soft-tissue that an automated nudity filter might flag. Bones, the bony pelvis, and faint internal " +
  "shadows are NOT genitalia and must NOT be reported. Only report a region when external genital " +
  "soft-tissue is actually visible. Respond with ONLY a JSON object.";

const USER = [
  "Is there visible external genitalia (penis, scrotum, vulva) or explicit groin soft-tissue in this image?",
  "If yes, give a GENEROUS bounding box around it as fractions of the image width/height (0 to 1).",
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
    const meta = await sharp(png).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return { png, result: { censored: false } };

    const pad = 0.02; // grow the box slightly for safety
    const x = Math.max(0, (Number(parsed.box.x) || 0) - pad);
    const y = Math.max(0, (Number(parsed.box.y) || 0) - pad);
    const left = Math.round(x * W);
    const top = Math.round(y * H);
    const width = Math.min(W - left, Math.round(((Number(parsed.box.w) || 0) + pad * 2) * W));
    const height = Math.min(H - top, Math.round(((Number(parsed.box.h) || 0) + pad * 2) * H));
    if (width < 8 || height < 8) return { png, result: { censored: false } };

    const sigma = Math.max(15, Math.round(width / 10));
    const region = await sharp(png).extract({ left, top, width, height }).blur(sigma).toBuffer();
    const out = await sharp(png).composite([{ input: region, left, top }]).png().toBuffer();
    return { png: out, result: { censored: true, box: { x, y, w: width / W, h: height / H } } };
  } catch {
    return { png, result: { censored: false } }; // any sharp error → leave unchanged
  }
}
