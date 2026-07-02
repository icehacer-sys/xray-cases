// Facebook Page publishing client. Posts a single photo to the connected Page via the
// Facebook Graph API: POST /{page-id}/photos with url + caption. Simpler than Instagram
// (one call, no container polling). The Page access token is read lazily so --prompt /
// dry-run modes work without FB_PAGE_ACCESS_TOKEN.

import { config, requireEnv } from "./config.js";

/** POST a form-encoded body to the Facebook Graph API and return the parsed JSON. */
async function fbPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${config.fbBase}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...params,
      access_token: requireEnv("FB_PAGE_ACCESS_TOKEN"),
    }).toString(),
  });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? text ?? res.statusText;
    const err = new Error(`Facebook ${path} failed (${res.status}): ${msg}`);
    (err as any).status = res.status;
    (err as any).body = json;
    throw err;
  }
  return json;
}

/**
 * Post a single photo to the Page feed. Returns the published post id. The /photos
 * endpoint returns { id (photo id), post_id (the feed story id) }; prefer post_id.
 */
export async function postPhoto(imageUrl: string, caption: string): Promise<string> {
  const pageId = requireEnv("FB_PAGE_ID");
  const body = await fbPost(`${pageId}/photos`, { url: imageUrl, caption });
  return String(body.post_id ?? body.id ?? "");
}
