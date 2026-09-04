// Threads publishing client. Two-step container + publish flow against the
// Threads Graph API. Bodies are form-encoded; auth is a Bearer token read lazily
// so --prompt mode (which never posts) works without THREADS_ACCESS_TOKEN.

import { config, requireEnv } from "./config.js";

const PUBLISH_RETRIES = 4;
const PUBLISH_RETRY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST a form-encoded body to a Threads endpoint and return the parsed JSON. */
async function post(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${config.threadsBase}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("THREADS_ACCESS_TOKEN")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const detail = body?.error?.message ?? text ?? res.statusText;
    const err = new Error(`Threads ${path} failed (${res.status}): ${detail}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  return body;
}

/** Create a media container and return its creation id. */
async function createContainer(params: Record<string, string>): Promise<string> {
  const body = await post(`${config.threadsUserId}/threads`, params);
  if (!body?.id) {
    throw new Error(`Threads container creation returned no id: ${JSON.stringify(body)}`);
  }
  return String(body.id);
}

/**
 * Publish a previously created container. The publish step can briefly 400 with
 * "media not found" while the container is still processing — sleep ~2s and retry.
 */
async function publish(creationId: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= PUBLISH_RETRIES; attempt++) {
    try {
      const body = await post(`${config.threadsUserId}/threads_publish`, {
        creation_id: creationId,
      });
      if (!body?.id) {
        throw new Error(`Threads publish returned no id: ${JSON.stringify(body)}`);
      }
      return String(body.id);
    } catch (err) {
      lastErr = err;
      if (attempt < PUBLISH_RETRIES) {
        await sleep(PUBLISH_RETRY_MS);
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Threads publish failed after ${PUBLISH_RETRIES} attempts`);
}

/** How many times to retry the TAGGED container before giving up on the topic tag. */
const TOPIC_TAG_RETRIES = 4;
const TOPIC_TAG_RETRY_MS = 3000;

/**
 * Thrown when the topic tag could not be applied and the caller asked for it to be REQUIRED.
 * Nothing has been published when this is thrown, so the caller can safely leave the stage
 * unposted and let the next poll cycle try the whole post again.
 */
export class TopicTagError extends Error {
  constructor(tag: string, cause: string) {
    super(`Threads topic_tag "${tag}" could not be applied after ${TOPIC_TAG_RETRIES} attempts: ${cause}`);
    this.name = "TopicTagError";
  }
}

/**
 * Post an image challenge to Threads. Returns the published post id.
 *
 * The topic tag is what files the post under the account's community (e.g. "Med Threads"), so an
 * untagged post loses that placement and the reach that comes with it. The tag used to be
 * abandoned after a SINGLE failed attempt, which cost 00135-pectus-excavatum its community on
 * 2026-09-03: Meta returned an opaque `400 An unknown error occurred`, and the post went out
 * untagged 8 seconds later. That error is transient — the same tag succeeded on the posts either
 * side of it — so retry the tagged container properly before ever falling back.
 */
export async function postImage(
  imageUrl: string,
  text: string,
  opts: { requireTag?: boolean } = {},
): Promise<string> {
  const base: Record<string, string> = { media_type: "IMAGE", image_url: imageUrl, text };
  const tag = config.topicTag;
  let creationId: string | undefined;

  if (tag) {
    for (let attempt = 1; attempt <= TOPIC_TAG_RETRIES; attempt++) {
      try {
        creationId = await createContainer({ ...base, topic_tag: tag });
        if (attempt > 1) console.log(`  Threads topic_tag "${tag}" succeeded on attempt ${attempt}.`);
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (attempt < TOPIC_TAG_RETRIES) {
          console.warn(`  Threads topic_tag "${tag}" attempt ${attempt}/${TOPIC_TAG_RETRIES} failed (${msg}); retrying.`);
          await sleep(TOPIC_TAG_RETRY_MS * attempt); // linear backoff
          continue;
        }
        // Exhausted. Nothing has been published yet, so the caller may prefer to wait for the
        // next poll cycle (minutes) rather than permanently lose the community placement.
        if (opts.requireTag) throw new TopicTagError(tag, msg);
        // Past the grace window: an untagged post beats missing the slot entirely. Loud, because
        // this is a silent quality regression that is invisible unless someone reads the logs.
        console.error(
          `  ⚠ Threads topic_tag "${tag}" failed ${TOPIC_TAG_RETRIES}x (${msg}) — POSTING WITHOUT THE COMMUNITY TAG. ` +
            `This post will not appear in the community; consider deleting and reposting it.`,
        );
      }
    }
  }

  if (!creationId) creationId = await createContainer(base);
  return publish(creationId);
}

/** A character range to blur as a spoiler (Threads text_entities). */
export interface SpoilerEntity {
  entity_type: "SPOILER";
  offset: number;
  length: number;
}

/**
 * Reply (text only) to an existing post/comment. Pass spoilers to blur ranges.
 * Pass linkAttachment (a full https:// URL) to render a link-preview CARD (used for the CTA so the
 * product's Gumroad cover shows). NOTE: link_attachment is documented for top-level TEXT posts; on
 * replies it is best-effort (the API silently ignores unsupported fields), so the CTA text ALSO
 * carries the URL as a fallback auto-preview. Any media on a reply container suppresses the card.
 */
export async function reply(replyToId: string, text: string, spoilers?: SpoilerEntity[], linkAttachment?: string): Promise<string> {
  const params: Record<string, string> = { media_type: "TEXT", text, reply_to_id: replyToId };
  if (linkAttachment) params.link_attachment = linkAttachment;
  if (spoilers && spoilers.length > 0) params.text_entities = JSON.stringify(spoilers);
  const creationId = await createContainer(params);
  return publish(creationId);
}

/** GET a Threads endpoint and return parsed JSON. */
async function get(path: string, query: Record<string, string>): Promise<any> {
  const url = new URL(`${config.threadsBase}/${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requireEnv("THREADS_ACCESS_TOKEN")}` } });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Threads GET ${path} failed (${res.status}): ${body?.error?.message ?? text}`);
  }
  return body;
}

/** The authenticated account's username (to recognize its own replies). */
export async function getMyUsername(): Promise<string> {
  const me = await get("me", { fields: "username" });
  return String(me?.username ?? "");
}

/** Top-level replies on a post (id + text + username), best-effort single page. */
export async function getReplies(mediaId: string): Promise<Array<{ id: string; text?: string; username?: string }>> {
  const body = await get(`${mediaId}/replies`, { fields: "id,text,username", limit: "100" });
  return body?.data ?? [];
}
