// One-off LIVE test: post ONE CTA reply with link_attachment, check whether Threads accepted it
// (link_attachment_url echoed back = the preview card will render on a reply), then DELETE it.
// Run: npx tsx src/_ctatest.ts
import { config, requireEnv } from "./config.js";
import { reply, getReplies, getMyUsername } from "./threads.js";

const CTA = `If these weird X-rays keep pulling you in.

I put 5 of the strangest into a free pack.

Guess hopital then flip for what each one really is.

Grab it free 👇🏼
free.mednoteslab.com`;
const LINK = "https://free.mednoteslab.com";
const H = { Authorization: `Bearer ${requireEnv("THREADS_ACCESS_TOKEN")}` };

async function getMedia(id: string): Promise<{ fields: string; body: any }> {
  for (const fields of ["id,text,permalink,link_attachment_url", "id,text,permalink"]) {
    const res = await fetch(`${config.threadsBase}/${id}?fields=${fields}`, { headers: H });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { fields, body };
  }
  return { fields: "none", body: {} };
}
async function del(id: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${config.threadsBase}/${id}`, { method: "DELETE", headers: H });
  return { status: res.status, body: await res.text() };
}

async function main(): Promise<void> {
  const me = await getMyUsername();
  // pick an older, low-traffic post to test under (skip the 2 freshest active ones)
  const res = await fetch(`${config.threadsBase}/${config.threadsUserId}/threads?fields=id,text,timestamp&limit=10`, { headers: H });
  const posts: any[] = (await res.json()).data ?? [];
  const target = posts[4] ?? posts[posts.length - 1];
  console.log(`target post: ${target.id} [${target.timestamp}] "${(target.text || "").replace(/\s+/g, " ").slice(0, 50)}"`);

  const replies = await getReplies(target.id);
  const answer = replies.find((r) => r.username === me && /^\s*answer/i.test(r.text || ""));
  const parent = answer?.id ?? target.id;
  console.log(`replying under ${answer ? "the ANSWER comment " + parent : "the post directly " + parent}`);

  const id = await reply(parent, CTA, undefined, LINK);
  console.log(`\nposted test reply id=${id}\nwaiting 25s for Threads to scrape the OG image ...`);
  await new Promise((r) => setTimeout(r, 25000));

  const m = await getMedia(id);
  console.log(`\nGET (${m.fields}) ->`, JSON.stringify(m.body));
  const ok = !!m.body.link_attachment_url;
  console.log(ok
    ? `\n✅ RESULT: link_attachment_url is POPULATED (${m.body.link_attachment_url}) — Threads accepted link_attachment on a REPLY, so the preview card renders.`
    : `\n⚠ RESULT: no link_attachment_url returned — link_attachment may be silently ignored on replies; will need the fallback (URL-in-text auto-preview or top-level post).`);
  console.log(`permalink (was live for eyeballing): ${m.body.permalink ?? "?"}`);

  const d = await del(id);
  console.log(`\ncleanup DELETE ${id} -> HTTP ${d.status}: ${d.body.slice(0, 120)}`);
  console.log(d.status === 200 ? "test reply deleted." : "⚠ delete may have failed — check the post and remove it manually if it is still up.");
}
main().catch((e) => { console.error("TEST ERROR:", e instanceof Error ? e.message : String(e)); process.exit(1); });
