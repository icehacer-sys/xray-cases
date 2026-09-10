// Offline regressions. All HTTP calls are mocked; fixtures live in an OS temp directory.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import type { Publication, PublicationStore } from "../src/persistence.js";

process.env.GITHUB_ACTIONS = "false";
process.env.BOT_USAGE_LOG = "off";
process.env.THREADS_ACCESS_TOKEN = "offline-test-token";
globalThis.fetch = async () => { throw new Error("Unexpected HTTP call in offline test"); };
const { config } = await import("../src/config.js");
const { State } = await import("../src/state.js");
const { parseXrayVerdict } = await import("../src/verify.js");
const { imageApproval, imageApprovalProblem, assertPublicImage, invalidateImage } = await import("../src/image-approval.js");
const { buildXrayPrompt } = await import("../src/anatomy.js");
const { imagePrompt } = await import("../src/captions.js");
const { postImage, reply } = await import("../src/threads.js");
const { atomicJson, checkpointState, PersistenceError } = await import("../src/persistence.js");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), "xray-publishing-test-"));
config.stateFile = join(dir, "state.json");
config.casesDir = relative(root, join(dir, "cases"));
config.confirmLive = true;
config.postHourLocal = 0;
config.topicTag = "";
config.instagram = false;
config.facebook = false;
config.seedComment = false;
config.ctaReply = false;
atomicJson(config.stateFile, { stages: {}, posted: { total: 0, daily: { date: "2020-01-01", count: 0 } } });
const condition: any = { diagnosis: "Fixture", view: "PA hand", keyFindings: "Seven finger rays", ageBand: "child", anatomyException: "Seven digits are required", symptom: "hand pain", hook: "fixture" };
const valid = { plausible: true, depictsDiagnosis: true, correctBodyPart: true, severity: "pass", defects: [], observations: [{ expected: "Seven finger rays", observed: "Seven coherent finger rays", assessable: true, matches: true }] };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const c: any = {
  folder: "fixture", diagnosis: "Offline fixture diagnosis", symptom: "pain", hook: "fixture",
  source: "manual", postAt: "2020-01-01T00:00:00Z", threadsImage: "xray.png", igSlides: [],
  generated: { threadsCaption: "Fixture", threadsCaptionAlt: "", threadsAnswer: "Answer: fixture", igCaption: "", ctaText: "" },
};
function fixture(value: any) {
  const folder = join(dir, "cases", value.folder);
  mkdirSync(folder, { recursive: true });
  atomicJson(join(folder, "case.json"), value);
}
if (process.argv.includes("--failure-cli")) {
  fixture(c);
  new State().setStages(c.folder, { publishedCaption: "stale unreviewed caption", experiment: JSON.stringify({ hookAlt: false, followCta: false }) });
  fixture({ ...c, folder: "later", diagnosis: "Another offline fixture", stages: { threadsPostId: "existing-post", challengePostedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString() } });
  fixture({ ...c, folder: "archived", diagnosis: "Historical fixture", stages: { threadsPostId: "archived-post", challengePostedAt: "2020-01-01T00:00:00Z" } });
  let archivedAttempts = 0;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes("/me?")) return response({ username: "fixture-owner" });
    const params = new URLSearchParams(String(init?.body ?? ""));
    if (params.get("reply_to_id") === "archived-post") archivedAttempts++;
    if (path.endsWith("/threads")) { if (!params.has("reply_to_id")) assert.equal(params.get("text"), "Fixture", "refresh old snapshot before a container exists"); return response({ id: params.has("reply_to_id") ? "answer-container" : "bad-container" }); }
    if (path.endsWith("/threads_publish")) return params.get("creation_id") === "bad-container"
      ? response({ error: { message: "Permanent image failure" } }, 400) : response({ id: "answer-id" });
    throw new Error(`Unexpected fixture URL: ${path}`);
  };
  process.argv = [process.execPath, join(root, "src/index.ts"), "--live"];
  process.once("beforeExit", () => {
    const saved = new State();
    assert.equal(archivedAttempts, 0, "historical unfinished replies must not reach the API");
    assert.equal(saved.getStages("later").answerCommentId, "answer-id", "independent answer must succeed after a failed case");
    assert.equal(saved.getStages("fixture").threadsPostId, undefined);
    assert.equal(saved.getStages("archived").answerCommentId, undefined, "skipping an old reply must not mark it published");
    assert.equal(saved.publication("case:fixture:challenge").get()?.creationId, "bad-container");
  });
  await import("../src/index.js");
} else {
  for (const bad of [null, [], {}, { ...valid, plausible: "false" }, { ...valid, plausible: false },
    { ...valid, depictsDiagnosis: false }, { ...valid, correctBodyPart: false }, { ...valid, severity: "unknown" },
    { ...valid, severity: ["pass"] }, { ...valid, defects: "none" }, { ...valid, defects: [3] },
    { ...valid, defects: [""] }, { ...valid, defects: ["extra bone"] }, { ...valid, severity: "critical" }]) {
    assert.equal(parseXrayVerdict(JSON.stringify(bad), condition).ok, false);
  }
  assert.equal(parseXrayVerdict(JSON.stringify(valid), condition, "max_tokens").ok, false);
  assert.equal(parseXrayVerdict("prefix " + JSON.stringify(valid), condition).ok, false);
  assert.equal(parseXrayVerdict("```json\n" + JSON.stringify(valid) + "\n```", condition).ok, true);
  assert.equal(parseXrayVerdict(JSON.stringify({ ...valid, severity: "minor", defects: ["minor imperfection"] }), condition).ok, true);
  console.log("PASS strict image verdict types, contradictions, and truncation");

  const png = Buffer.from("verified-final-image");
  const generated = { ...c, source: "generated", condition, approved: true,
    imageApproval: imageApproval(png, condition, parseXrayVerdict(JSON.stringify(valid), condition)) };
  assert.equal(imageApprovalProblem(generated, png), null);
  assert.match(imageApprovalProblem(generated, Buffer.from("replaced-image"))!, /changed/);
  assert.match(imageApprovalProblem({ ...generated, condition: { ...condition, keyFindings: "different" } }, png)!, /inputs changed/);
  assert.match(imageApprovalProblem({ ...generated, imageApproval: { ...generated.imageApproval, verifierVersion: "old" } }, png)!, /stale/);
  globalThis.fetch = async () => new Response(png);
  await assertPublicImage(generated, "https://fixture.invalid/image.png");
  globalThis.fetch = async () => new Response("different public bytes");
  await assert.rejects(assertPublicImage(generated, "https://fixture.invalid/image.png"), /Public image blocked/);
  fixture(generated);
  invalidateImage(generated);
  const held = JSON.parse(readFileSync(join(dir, "cases/fixture/case.json"), "utf8"));
  assert.equal(held.approved, false);
  assert.equal(held.needsReview, true);
  assert.equal(held.imageApproval, undefined);
  for (const view of ["PA hand", "AP pelvis", "Lateral lumbar spine", "AP chest"]) {
    const input = { ...condition, view };
    assert.equal(imagePrompt({ ...c, condition: input }), buildXrayPrompt(input));
  }
  assert.throws(() => imagePrompt(c), /condition/);
  console.log("PASS final image binding, public bytes, repair hold, and canonical prompt variants");

  const state = new State();
  const events: string[] = [];
  const backing = state.publication("challenge");
  const store: PublicationStore = { get: backing.get, set: (p) => { events.push("save"); backing.set(p); } };
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/threads_publish")) { events.push("publish"); assert.equal(new State().publication("challenge").get()?.creationId, "container"); return response({ id: "media" }); }
    events.push("create"); return response({ id: "container" });
  };
  assert.equal(await postImage("https://fixture.invalid/image", "original", { publication: store }), "media");
  assert.equal(events[0], "create");
  assert.ok(events.indexOf("save") < events.indexOf("publish"));
  globalThis.fetch = async () => { throw new Error("Completed receipt must not call HTTP"); };
  assert.equal(await postImage("different-url", "redrafted", { publication: new State().publication("challenge") }), "media");
  const pending: Publication = { creationId: "lost-container", createdAt: new Date().toISOString(), params: { text: "original", reply_to_id: "parent" } };
  const recovery = state.publication("answer");
  recovery.set(pending);
  let creations = 0;
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith("/threads")) { creations++; throw new Error("Duplicate container creation"); }
    if (path.endsWith("/threads_publish")) return response({ error: { message: "Container has already been published" } }, 400);
    if (path.includes("/me?")) return response({ username: "owner" });
    if (path.includes("/parent/replies")) return response({ data: [{ id: "real-answer-id", text: "original", username: "owner", timestamp: new Date().toISOString() }] });
    throw new Error("Unexpected recovery URL");
  };
  assert.equal(await reply("parent", "original", undefined, undefined, recovery), "real-answer-id");
  assert.equal(creations, 0);
  const unresolved = state.publication("unresolved");
  unresolved.set({ ...pending, confirmedPublished: true });
  globalThis.fetch = async (url) => String(url).includes("/me?") ? response({ username: "owner" }) : response({ data: [] });
  await assert.rejects(reply("parent", "text", undefined, undefined, unresolved), /unresolved/);
  assert.equal(unresolved.get()?.creationId, pending.creationId);
  let publicWrites = 0;
  globalThis.fetch = async (url) => { if (String(url).endsWith("/threads_publish")) publicWrites++; return response({ id: "container" }); };
  await assert.rejects(postImage("url", "text", { publication: { get: () => undefined, set: () => { throw new PersistenceError("checkpoint unavailable"); } } }), PersistenceError);
  assert.equal(publicWrites, 0);
  let pendingAfterAck: Publication | undefined;
  const failedAck: PublicationStore = {
    get: () => pendingAfterAck,
    set: (p) => { if (p.publishedId) throw new PersistenceError("completion checkpoint unavailable"); pendingAfterAck = p; },
  };
  await assert.rejects(postImage("url", "text", { publication: failedAck }), PersistenceError);
  assert.equal(publicWrites, 1, "must not retry a public write after its completion checkpoint fails");
  assert.equal(pendingAfterAck?.creationId, "container");
  console.log("PASS persisted-before-publish, restart reuse, lost response recovery, unresolved hold, and failed checkpoint");

  const snapshot = readFileSync(config.stateFile, "utf8");
  assert.throws(() => atomicJson(config.stateFile, { circular: BigInt(1) }), PersistenceError);
  assert.equal(readFileSync(config.stateFile, "utf8"), snapshot);
  for (const corrupt of ["{", "null", JSON.stringify({ stages: [] }), JSON.stringify({ stages: {}, publications: { bad: {} } })]) {
    writeFileSync(config.stateFile, corrupt);
    assert.throws(() => new State(), PersistenceError);
    assert.equal(readFileSync(config.stateFile, "utf8"), corrupt);
  }
  console.log("PASS atomic write failure preserves old state; corrupt state never resets");

  // Exercise the real Git checkpoint with a local bare remote. No GitHub access.
  const gitDir = join(dir, "git-checkpoint");
  const remote = join(dir, "remote.git");
  mkdirSync(gitDir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: gitDir, encoding: "utf8", stdio: "pipe" });
  git("init", "--bare", remote);
  git("init", "--initial-branch=main");
  git("config", "user.name", "Offline test");
  git("config", "user.email", "offline@example.invalid");
  git("remote", "add", "origin", remote);
  atomicJson(join(gitDir, "state.json"), { pending: "first" });
  git("add", "state.json");
  git("commit", "-m", "test: initial state");
  git("push", "-u", "origin", "main");
  const originalCwd = process.cwd();
  const originalBranch = process.env.GITHUB_REF_NAME;
  process.chdir(gitDir);
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_REF_NAME = "main";
  try {
    atomicJson("state.json", { pending: "second" });
    checkpointState("state.json");
    assert.equal(JSON.parse(git("--git-dir", remote, "show", "main:state.json")).pending, "second");
    git("remote", "set-url", "origin", join(dir, "unavailable-remote.git"));
    atomicJson("state.json", { pending: "third" });
    assert.throws(() => checkpointState("state.json"), PersistenceError);
    assert.equal(JSON.parse(git("--git-dir", remote, "show", "main:state.json")).pending, "second");
  } finally {
    process.chdir(originalCwd);
    process.env.GITHUB_ACTIONS = "false";
    if (originalBranch === undefined) delete process.env.GITHUB_REF_NAME;
    else process.env.GITHUB_REF_NAME = originalBranch;
  }
  console.log("PASS real Git checkpoint reaches a fresh checkout; unavailable remote fails closed");
  const child = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "--failure-cli"], { cwd: root, encoding: "utf8", timeout: 60_000 });
  assert.equal(child.status, 1, child.stderr + child.stdout + String(child.error ?? ""));
  assert.match(child.stderr, /1 operation\(s\) failed/);
  assert.match(child.stdout, /posted ANSWER for later/);
  console.log("PASS publisher CLI fails visibly while saving an independent successful answer");
}
