// New product line switch (BOT_CTA_LINE=v2, BOT_REPLY_HINT=on). Offline: no network, no state writes.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
process.env.BOT_USAGE_LOG = "off";
globalThis.fetch = async () => { throw new Error("Unexpected network request in launch CTA checks"); };
const { pickCta, pickLaunchCta, tagCtaLink, withReplyHint, withFollowCta, REPLY_HINT_LINE, CTA_ROTATION_V2, assertPublicCopy } = await import("../src/captions.js");
const { serialCommaProblems } = await import("../src/copy-style.js");
const { config } = await import("../src/config.js");

// Defaults are the old line: nothing changes until launch day flips the flags.
assert.equal(config.ctaLine, "v1");
assert.equal(config.replyHint, false);
assert.equal(withReplyHint("A\n\nB"), "A\n\nB");

// Rotation alternates by posting night and the link carries the night tag.
const a = pickLaunchCta({ postAt: "2026-10-14T19:00:00Z" });
const b = pickLaunchCta({ postAt: "2026-10-15T19:00:00Z" });
assert.deepEqual(new Set([a.key, b.key]), new Set(CTA_ROTATION_V2));
assert.match(a.text.split("\n").pop()!, /^(?:free|book)\.mednoteslab\.com\/\?c=1014$/);
assert.equal(pickLaunchCta({ postAt: "2026-10-14T19:00:00Z" }).key, a.key, "deterministic per night (retries post the same CTA)");

// Legacy pins on queued cases land on the replacement product; new pins stay as they are.
const pins: Array<[string, string]> = [["hopital", "freeround"], ["challenge", "inside"], ["viral10", "inside"], ["vol1", "book"], ["spotit", "book"], ["collection", "everyfile"], ["ctvol1", "everyfile"], ["support", "keepcoming"], ["anxiety", "anxiety"], ["inside", "inside"]];
for (const [from, to] of pins) assert.equal(pickLaunchCta({ cta: from as any, postAt: "2026-10-20T19:00:00Z" }).key, to, from);

// The CTA stage derives the link card URL from the last line; tagged links must still match it.
const domainOk = (text: string) => /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text.trim().split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "");
assert.equal(tagCtaLink("x\nmednoteslab.gumroad.com/l/collection", "2026-10-14T19:00:00Z").split("\n").pop(), "mednoteslab.gumroad.com/l/collection?c=1014");
assert.equal(tagCtaLink("x\nfree.mednoteslab.com", undefined), "x\nfree.mednoteslab.com", "no postAt, no tag");

// Every new-line CTA passes the public copy rules and fits a reply.
for (const key of ["freeround", "book", "inside", "everyfile", "keepcoming", "anxiety"]) {
  const { text } = pickLaunchCta({ cta: key as any, postAt: "2026-10-14T19:00:00Z" });
  assert.deepEqual(serialCommaProblems(text), [], `${key}: comma rule`);
  assert.doesNotThrow(() => assertPublicCopy(text), key);
  assert.ok(!/—/.test(text), `${key}: no em dash`);
  assert.ok(!/\breal (?:x-?rays?|patients?|ct)\b/i.test(text), `${key}: no real-patient claim`);
  assert.ok(text.length <= 500, `${key}: 500 chars`);
  assert.ok(domainOk(text), `${key}: link card URL`);
}
// v1 is unchanged for the old keys.
assert.equal(pickCta({ cta: "anxiety" } as any).key, "anxiety");

// Launch-day style for the five new keys: flowing sentences (no "A fork. A padlock." fragments),
// only the final lineup's objects, the CTA emoji set, and no prices that could drift from Gumroad.
const NEW_KEYS = ["freeround", "book", "inside", "everyfile", "keepcoming"] as const;
const CTA_EMOJI = new Set(["👇🏼", "😭", "🤣", "🤍", "🫡", "✅", "💯", "👏"]);
for (const key of NEW_KEYS) {
  const { text } = pickLaunchCta({ cta: key, postAt: "2026-10-14T19:00:00Z" });
  const prose = text.split("\n").slice(0, -1).join("\n");
  for (const line of prose.split("\n").filter(Boolean)) {
    const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const s of sentences.slice(0, -1)) {
      assert.ok(s.split(/\s+/).length > 5, `${key}: choppy fragment "${s}" in "${line}"`);
    }
  }
  assert.ok(!/\b(?:padlock|worms?|twin|keys)\b/i.test(text), `${key}: names a case that is not in the final lineup`);
  assert.ok(!/\bAI\b/.test(text), `${key}: never "AI"`);
  assert.ok(!/\$\d/.test(text), `${key}: no price in the CTA`);
  for (const m of text.match(/\p{Extended_Pictographic}\p{Emoji_Modifier}?/gu) ?? []) assert.ok(CTA_EMOJI.has(m), `${key}: emoji ${m}`);
  assert.equal(text.split("\n").pop(), `${key === "freeround" ? "free" : key === "everyfile" ? "all" : key === "keepcoming" ? "support" : key}.mednoteslab.com/?c=1014`, `${key}: domain`);
}

// Every queued case that has not posted yet, as the v2 CTA stage would post it tomorrow and after.
// Old pins (in case.json or cached in generated.ctaText) must never reach a retired product.
const NEW_LINE_DOMAIN = /^(?:free|inside|book|all|support|anxiety)\.mednoteslab\.com\/\?c=\d{4}$/;
let queued = 0;
for (const folder of readdirSync(new URL("../cases/", import.meta.url))) {
  const file = new URL(`../cases/${folder}/case.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const c = JSON.parse(readFileSync(file, "utf8"));
  if (c.stages?.threadsPostId || c.retired) continue;
  const { key, text } = pickLaunchCta(c);
  assert.ok([...NEW_KEYS, "anxiety"].includes(key as any), `${folder}: v2 key ${key}`);
  assert.match(text.split("\n").pop()!, NEW_LINE_DOMAIN, `${folder}: v2 link`);
  assert.ok(text.length <= 500, `${folder}: CTA reply fits 500`);
  assert.ok(domainOk(text), `${folder}: link card URL`);
  const answer: string | undefined = c.generated?.threadsAnswer;
  if (answer) assert.ok(answer.length <= config.answerMaxChars, `${folder}: answer reply fits ${config.answerMaxChars}`);
  queued++;
}
assert.ok(queued >= 10, `checked ${queued} queued CTAs`);
// Every legacy key lands on a live product.
for (const old of ["hopital", "challenge", "viral10", "spotit", "vol1", "vol2", "vol3", "rare", "field", "collection", "ctvol1", "support"]) {
  assert.ok((NEW_KEYS as readonly string[]).includes(pickLaunchCta({ cta: old as any, postAt: "2026-10-14T19:00:00Z" }).key), `legacy ${old}`);
}

// The workflow env strings actually turn the switches on (case-insensitive, nothing else does).
const { spawnSync } = await import("node:child_process");
const probe = (env: Record<string, string>) => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "-e", "const { config } = await import('./src/config.ts'); console.log(config.ctaLine + ' ' + config.replyHint);"], {
    cwd: new URL("..", import.meta.url), env: { ...process.env, BOT_USAGE_LOG: "off", ...env }, encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim().split("\n").pop();
};
assert.equal(probe({ BOT_CTA_LINE: "v2", BOT_REPLY_HINT: "on" }), "v2 true");
assert.equal(probe({ BOT_CTA_LINE: "V2", BOT_REPLY_HINT: "ON" }), "v2 true");
assert.equal(probe({ BOT_CTA_LINE: "yes", BOT_REPLY_HINT: "true" }), "v1 false");

// The reply hint takes the challenge label slot, keeps six lines and fits every queued caption.
const casesDir = new URL("../cases/", import.meta.url);
let checked = 0;
for (const folder of readdirSync(casesDir)) {
  const file = new URL(`${folder}/case.json`, casesDir);
  if (!existsSync(file)) continue;
  const c = JSON.parse(readFileSync(file, "utf8"));
  const caption: string | undefined = c.generated?.threadsCaption;
  if (!caption || c.stages?.threadsPostId || c.retired) continue;
  const hinted = withReplyHint(caption, true);
  assert.equal(hinted.split("\n\n").length, caption.split("\n\n").length, `${folder}: same line count`);
  assert.equal(hinted.split("\n\n").at(-1), REPLY_HINT_LINE, `${folder}: hint is last`);
  assert.ok(!hinted.includes("Quick diagnosis challenge"), `${folder}: label swapped out`);
  assert.ok(hinted.length <= config.captionMaxChars, `${folder}: fits`);
  assert.deepEqual(serialCommaProblems(hinted), [], `${folder}: comma rule`);
  assert.notEqual(withFollowCta(caption, true), hinted, "different last line from the follow arm");
  checked++;
}
assert.ok(checked >= 10, `checked ${checked} queued captions`);
console.log(`launch CTA checks passed (${checked} queued captions)`);
