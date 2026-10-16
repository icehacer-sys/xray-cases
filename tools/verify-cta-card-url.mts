// The CTA link-preview card must use one stable URL per product (2026-10-17): Meta shows the
// preview image only for URLs it has scraped before, so the nightly ?c=MMDD tag stays in the
// visible text link only.
import assert from "node:assert/strict";
import { cardUrl, tagCtaLink } from "../src/captions.ts";

assert.equal(cardUrl("book.mednoteslab.com/?c=1013"), "https://book.mednoteslab.com/?c=card");
assert.equal(cardUrl("free.mednoteslab.com/?c=1016"), "https://free.mednoteslab.com/?c=card");
assert.equal(cardUrl("book.mednoteslab.com"), "https://book.mednoteslab.com/?c=card");
assert.equal(cardUrl("anxiety.mednoteslab.com/l/x?c=0101&a=b"), "https://anxiety.mednoteslab.com/l/x?c=card");
const tagged = tagCtaLink("Here 👇🏼\nbook.mednoteslab.com", "2026-10-13T19:00:00Z");
const last = tagged.split("\n").pop()!;
assert.equal(last, "book.mednoteslab.com/?c=1013", "visible text keeps the nightly tag");
assert.equal(cardUrl(last), cardUrl(tagCtaLink("x\nbook.mednoteslab.com", "2026-10-20T19:00:00Z").split("\n").pop()!), "card URL is the same every night");
console.log("CTA card URL checks passed");
