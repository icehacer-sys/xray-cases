// Offline: a condition's reference radiograph reaches the image-edit endpoint with the full
// anatomy-guide prompt; conditions without one keep the text-only call. All HTTP is mocked.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.OPENAI_API_KEY = "synthetic-openai";
process.env.BOT_USAGE_LOG = "off";
const refs = mkdtempSync(join(tmpdir(), "xray-refs-"));
process.env.BOT_REFERENCE_DIR = refs;
const { generateXray } = await import("../src/openai.js");
const { REFERENCE_PROMPT, loadReference, referenceAvailable } = await import("../src/reference.js");

const png = Buffer.from("synthetic-png");
const calls: Array<{ url: string; init: RequestInit }> = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url: String(url), init });
  return new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }], usage: null }), { status: 200 });
}) as typeof fetch;

const guide = "Create a de-identified educational radiograph simulation: PA hand.";
assert.deepEqual(await generateXray(guide), png);
assert.equal(calls[0].url, "https://api.openai.com/v1/images/generations", "no reference keeps the text-only call");
assert.equal(JSON.parse(String(calls[0].init.body)).prompt, guide);

const reference = Buffer.from("reference-bytes");
await generateXray(guide, reference);
assert.equal(calls[1].url, "https://api.openai.com/v1/images/edits", "a reference uses the edit endpoint");
const form = calls[1].init.body as FormData;
const prompt = String(form.get("prompt"));
assert.ok(prompt.startsWith(guide), "the full anatomy guide is kept");
assert.ok(prompt.endsWith(REFERENCE_PROMPT), "the reference rules are appended");
assert.match(REFERENCE_PROMPT, /Never reproduce any text/);
assert.match(REFERENCE_PROMPT, /digit counts/);
const image = form.get("image") as Blob;
assert.deepEqual(Buffer.from(await image.arrayBuffer()), reference, "the exact reference bytes are attached");
assert.equal(new Headers(calls[1].init.headers).get("content-type"), null, "multipart sets its own content type");

writeFileSync(join(refs, "present.png"), reference);
assert.equal(referenceAvailable({}), true, "no reference is always available");
assert.equal(referenceAvailable({ referenceImage: "present.png" }), true);
assert.equal(referenceAvailable({ referenceImage: "missing.png" }), false, "CI top-up skips a reference it cannot see");
assert.deepEqual(loadReference({ diagnosis: "x", referenceImage: "present.png" }), reference);
assert.equal(loadReference({ diagnosis: "x" }), undefined);
assert.throws(() => loadReference({ diagnosis: "Bat wing", referenceImage: "missing.png" }), /never|not found/, "a missing reference never falls back to text-only");
console.log("PASS reference image: edit endpoint with full anatomy guide plus reference rules, exact bytes attached, text-only path unchanged, missing references skipped by top-up and never silently dropped. No network.");
