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

/** Post an image challenge to Threads. Returns the published post id. */
export async function postImage(imageUrl: string, text: string): Promise<string> {
  const base: Record<string, string> = { media_type: "IMAGE", image_url: imageUrl, text };
  const tag = config.topicTag;
  let creationId: string;
  if (tag) {
    try {
      creationId = await createContainer({ ...base, topic_tag: tag });
    } catch (err) {
      // If the API ever rejects the topic tag, never block the post — retry without it.
      console.warn(`Threads topic_tag "${tag}" rejected (${(err as Error).message}); posting without it.`);
      creationId = await createContainer(base);
    }
  } else {
    creationId = await createContainer(base);
  }
  return publish(creationId);
}

/** Reply (text only) to an existing post/comment. Returns the reply's id. */
export async function reply(replyToId: string, text: string): Promise<string> {
  const creationId = await createContainer({
    media_type: "TEXT",
    text,
    reply_to_id: replyToId,
  });
  return publish(creationId);
}
