// Pin the 7-night support-page CTA run (owner-approved copy, 2026-08-19) onto cases 00122..00128.
//
// Written straight into each case's generated.ctaText because the publisher prefers that over the
// rotation (`generated.ctaText ?? pickCta(c).text` in src/index.ts Stage 3), and every night needs
// DIFFERENT copy so a single rotation key would not do.
//
// The last line of each block MUST stay the bare domain on its own: Stage 3 derives the Threads
// link-preview card from it (`https://<last line>`), so anything after it kills the card.
//
// Run: node tools/setsupportctas.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const LINK = "support.mednoteslab.com";

const COPY = {
  122: `Every case on this account is free and always will be.

No paywall and no catch.

If they have been worth something to you there is now a page to chip in.

Only if you want to 👇🏼
${LINK}`,

  123: `I have never put a single case behind a paywall.

Every one of them has been free since the first day and that is not changing.

If you want to send something back there is finally a page for it.

Completely optional 👇🏼
${LINK}`,

  124: `A quiet one tonight.

The daily case stays free for everyone and that is not changing.

A few of you asked if there was a way to send something back and now there is.

No pressure at all 👇🏼
${LINK}`,

  125: `I am a med student saving for my exams and this page is my only side income.

The cases stay free either way.

If one of them has taught you something you can chip in here.

Thank you either way 👇🏼
${LINK}`,

  126: `Pay what you want even a dollar helps.

Nothing on this account will ever sit behind a paywall.

The page is just there for anyone who feels like it.

No obligation at all 👇🏼
${LINK}`,

  127: `Some of you have been here since the very first case.

If this account has earned a coffee there is a page for that now.

And if not then just keep guessing.

That is the whole point of it.

👇🏼
${LINK}`,

  128: `Last time I will mention this for a while.

There is a support page now for anyone who wants to put something back.

The daily case stays free regardless and always will.

Thank you for reading 👇🏼
${LINK}`,
};

let done = 0;
for (const d of readdirSync("cases")) {
  const f = join("cases", d, "case.json");
  if (!existsSync(f)) continue;
  const c = JSON.parse(readFileSync(f, "utf8"));
  const copy = COPY[c.number];
  if (!copy) continue;

  if (c.stages?.ctaPostedAt) { console.log(`  skip n=${c.number}: CTA already posted`); continue; }

  c.generated = c.generated ?? {};
  c.generated.ctaText = copy;
  delete c.cta; // no rotation pin, the explicit text above wins
  writeFileSync(f, JSON.stringify(c, null, 2) + "\n", "utf8");

  // guards: bare-domain last line (link card) and house style
  const last = copy.trim().split("\n").map((l) => l.trim()).filter(Boolean).pop();
  const cardOk = /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(last);
  const commas = (copy.match(/,/g) ?? []).length;
  const dash = /[—–]/.test(copy);
  console.log(
    `  n=${c.number} ${c.postAt.slice(0, 10)}  card:${cardOk ? "ok" : "BROKEN"}  commas:${commas}  emdash:${dash}  ${c.diagnosis}`,
  );
  done++;
}
console.log(`\npinned ${done} support CTAs -> https://${LINK}`);
