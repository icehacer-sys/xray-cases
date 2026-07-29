// Re-space the unposted queue to exactly one case per night at BOT_POST_HOUR_UTC, starting
// with the next free night. The generator assigns postAt as "the day after the latest queued
// case", which lands cases in the PAST whenever the queue has been sitting empty — and the
// publisher has no daily cap, so several overdue cases would all fire in one poll.
//
// Run: node tools/reschedulequeue.mjs [--apply]      (dry-run unless --apply)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const HOUR = Number(process.env.BOT_POST_HOUR_UTC ?? 19);
const DIR = "cases";

const cases = [];
for (const d of readdirSync(DIR)) {
  const f = join(DIR, d, "case.json");
  if (!existsSync(f)) continue;
  cases.push({ f, c: JSON.parse(readFileSync(f, "utf8")) });
}

const posted = cases.filter((x) => x.c.stages?.challengePostedAt);
const pending = cases
  .filter((x) => !x.c.stages?.challengePostedAt && x.c.postAt)
  .sort((a, b) => (a.c.number ?? 0) - (b.c.number ?? 0));

// Latest night already used by a published case.
const lastPosted = posted
  .map((x) => new Date(x.c.stages.challengePostedAt))
  .sort((a, b) => b - a)[0];

// First free slot = the later of (tonight) and (the night after the last published case).
const now = new Date();
const tonight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), HOUR, 0, 0));
let slot = tonight;
if (lastPosted) {
  const nextAfterPosted = new Date(Date.UTC(lastPosted.getUTCFullYear(), lastPosted.getUTCMonth(), lastPosted.getUTCDate() + 1, HOUR, 0, 0));
  if (nextAfterPosted > slot) slot = nextAfterPosted;
}
// Never schedule a slot that has already passed today.
if (slot <= now) slot = new Date(slot.getTime() + 24 * 3600 * 1000);

console.log(`last published: ${lastPosted ? lastPosted.toISOString() : "(none)"}`);
console.log(`pending cases : ${pending.length}`);
console.log(`first slot    : ${slot.toISOString()}\n`);

let changed = 0;
for (const x of pending) {
  const want = slot.toISOString();
  if (x.c.postAt !== want) {
    console.log(`  n=${String(x.c.number).padStart(3)}  ${x.c.postAt}  ->  ${want}   ${x.c.diagnosis}`);
    x.c.postAt = want;
    if (APPLY) writeFileSync(x.f, JSON.stringify(x.c, null, 2) + "\n", "utf8");
    changed++;
  } else {
    console.log(`  n=${String(x.c.number).padStart(3)}  ${want}   (unchanged)   ${x.c.diagnosis}`);
  }
  slot = new Date(slot.getTime() + 24 * 3600 * 1000);
}
console.log(`\n${changed} case(s) ${APPLY ? "rescheduled" : "would be rescheduled (dry-run, pass --apply)"}`);
