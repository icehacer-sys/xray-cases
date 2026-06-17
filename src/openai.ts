// OpenAI X-ray image generation. The ONLY AI-generated image in the pipeline
// (the IG slides are rendered deterministically from a template — see slides.ts).
//
// Calls the OpenAI images API and decodes the base64 PNG it returns into a
// Buffer the rest of the pipeline can write to disk and embed in slides.

import { config, requireEnv } from "./config.js";

/**
 * Generate an X-ray image for the given prompt and return it as a PNG Buffer.
 *
 * POSTs to https://api.openai.com/v1/images/generations with the configured
 * model/size; gpt-image-1 returns the image as `data[0].b64_json`, which is
 * decoded into a Buffer. Throws a clear Error on a non-200 response.
 */
export async function generateXray(prompt: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.imageModel,
      prompt,
      size: config.imageSize,
      quality: config.imageQuality,
      n: 1,
    }),
  });

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`OpenAI images API returned non-JSON (${res.status}): ${text}`);
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? text;
    throw new Error(`OpenAI images API failed (${res.status}): ${msg}`);
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI images API returned no b64_json image data: ${text}`);
  }
  return Buffer.from(b64, "base64");
}

/**
 * Generate a 1024x1024 IG slide image with gpt-image-2. When `baseImage` is given (the
 * case X-ray), uses the image-EDIT endpoint so the SAME X-ray is composited into the
 * slide (keeps it consistent across slides + the Threads post); otherwise text->image.
 */
export async function generateSlideImage(prompt: string, baseImage?: Buffer): Promise<Buffer> {
  const key = requireEnv("OPENAI_API_KEY");
  let res: Response;
  if (baseImage) {
    const form = new FormData();
    form.append("model", config.imageModel);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("n", "1");
    form.append("image", new Blob([new Uint8Array(baseImage)], { type: "image/png" }), "xray.png");
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.imageModel, prompt, size: "1024x1024", quality: config.imageQuality, n: 1 }),
    });
  }

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`OpenAI images API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json?.error) {
    throw new Error(`OpenAI images API failed (${res.status}): ${json?.error?.message ?? text.slice(0, 200)}`);
  }
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI images API returned no image: ${text.slice(0, 200)}`);
  }
  return Buffer.from(b64, "base64");
}
