// Instagram publishing client. Posts a carousel (or single image) to the
// connected account via the Instagram Graph API:
//   1. create an item container per image
//   2. create the carousel container referencing the item ids
//   3. poll the container until status_code === "FINISHED"
//   4. media_publish the container -> published media id
//
// IG content publishing to your OWN account may not work in development mode,
// so every call surfaces a clear Error; the orchestrator catches it and still
// posts to Threads.

import { config, requireEnv } from "./config.js";

const STATUS_TRIES = 5;
const STATUS_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST a form-encoded body to the IG Graph API and return the parsed JSON. */
async function igPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${config.igBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("IG_ACCESS_TOKEN")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Instagram POST ${path} returned non-JSON (${res.status}): ${text}`);
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? text;
    throw new Error(`Instagram POST ${path} failed (${res.status}): ${msg}`);
  }
  return json;
}

/** GET from the IG Graph API and return the parsed JSON. */
async function igGet(path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${config.igBase}${path}${sep}access_token=${encodeURIComponent(requireEnv("IG_ACCESS_TOKEN"))}`,
    { headers: { Authorization: `Bearer ${requireEnv("IG_ACCESS_TOKEN")}` } },
  );
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Instagram GET ${path} returned non-JSON (${res.status}): ${text}`);
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? text;
    throw new Error(`Instagram GET ${path} failed (${res.status}): ${msg}`);
  }
  return json;
}

/** Poll a container until it reports FINISHED, throwing on ERROR/timeout. */
async function waitForContainer(containerId: string): Promise<void> {
  for (let i = 0; i < STATUS_TRIES; i++) {
    const { status_code } = await igGet(`/${containerId}?fields=status_code`);
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram container ${containerId} status ${status_code}`);
    }
    await sleep(STATUS_DELAY_MS);
  }
  throw new Error(`Instagram container ${containerId} not FINISHED after ${STATUS_TRIES} tries`);
}

/** Publish a finished container and return the published media id. */
async function publishContainer(containerId: string): Promise<string> {
  await waitForContainer(containerId);
  const { id } = await igPost("/me/media_publish", { creation_id: containerId });
  return id;
}

/**
 * Publish a carousel post. Creates an item container per image, then a CAROUSEL
 * container referencing them, polls until ready, and publishes. Returns the id.
 */
export async function publishCarousel(imageUrls: string[], caption: string): Promise<string> {
  if (imageUrls.length === 0) {
    throw new Error("publishCarousel: no image URLs provided");
  }
  const childIds: string[] = [];
  for (const image_url of imageUrls) {
    const { id } = await igPost("/me/media", { image_url, is_carousel_item: "true" });
    childIds.push(id);
  }
  const { id: containerId } = await igPost("/me/media", {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  return publishContainer(containerId);
}

/**
 * Publish a single image post (no carousel). Returns the published media id.
 */
export async function publishImage(imageUrl: string, caption: string): Promise<string> {
  const { id: containerId } = await igPost("/me/media", { image_url: imageUrl, caption });
  return publishContainer(containerId);
}
