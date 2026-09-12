import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { buildXrayPrompt } from "./anatomy.js";
import { saveCase } from "./cases.js";
import { verifyXray, type XrayVerdict } from "./verify.js";
import type { Case, Condition } from "./types.js";

const VERSION = "4";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (input: Buffer | string) => createHash("sha256").update(input).digest("hex");
export const diagnosticHash = (condition: Condition) => hash(JSON.stringify([buildXrayPrompt(condition), condition.requiredObservations ?? [condition.keyFindings]]));

export function finalImage(c: Case): Buffer {
  return readFileSync(join(resolve(root, config.casesDir), c.folder, c.threadsImage));
}

export function imageApproval(png: Buffer, condition: Condition, verdict: XrayVerdict): NonNullable<Case["imageApproval"]> {
  return {
    sha256: hash(png), conditionSha256: diagnosticHash(condition),
    clinicalContextSha256: hash(condition.symptom),
    verifiedAt: new Date().toISOString(), model: config.xrayVerifyModel,
    verifierVersion: VERSION, ok: verdict.ok, defects: verdict.defects,
    observations: verdict.observations,
    blindRead: verdict.blindRead, singleAnswerSupported: verdict.singleAnswerSupported, diagnosticReason: verdict.diagnosticReason,
  };
}

export function imageApprovalProblem(c: Case, png: Buffer): string | null {
  if (c.source !== "generated") return null;
  if (!c.condition) return "generated case has no diagnostic image inputs";
  const a = c.imageApproval;
  if (!a) return "final image has not been verified";
  if (a.sha256 !== hash(png)) return "image changed after verification";
  if (a.conditionSha256 !== diagnosticHash(c.condition)) return "diagnostic image inputs changed after verification";
  if (a.clinicalContextSha256 && a.clinicalContextSha256 !== hash(c.condition.symptom)) return "clinical vignette changed after verification";
  if (a.verifierVersion !== VERSION) return "image verifier version is stale";
  if (a.singleAnswerSupported !== true || !a.diagnosticReason?.trim()) return "missing independent diagnostic assessment";
  if (a.ok !== true) return "final image failed verification";
  return null;
}

/** Meta downloads the public URL, which must serve the same verified bytes. */
export async function assertPublicImage(c: Case, url: string): Promise<void> {
  if (c.source !== "generated") return;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Cannot read public image for ${c.folder}: HTTP ${res.status}`);
  const problem = imageApprovalProblem(c, Buffer.from(await res.arrayBuffer()));
  if (problem) throw new Error(`Public image blocked for ${c.folder}: ${problem}. Publish the verified asset before retrying.`);
}

/** Migration for existing queued cases. Changed/failed approvals never silently renew. */
export async function verifyLegacyImage(c: Case): Promise<void> {
  if (c.source !== "generated" || c.needsReview || c.imageApproval) return;
  if (!c.condition) throw new Error(`Cannot verify ${c.folder}: missing condition`);
  const png = finalImage(c);
  const verdict = await verifyXray(png, c.condition);
  c.imageApproval = imageApproval(png, c.condition, verdict);
  if (!verdict.ok) {
    c.needsReview = true;
    c.approved = false;
    c.verifyDefects = verdict.defects;
  }
  saveCase(c);
}

/** Persist the hold before modifying a publishable asset, including when a repair crashes. */
export function invalidateImage(c: Case): void {
  delete c.imageApproval;
  c.approved = false;
  c.needsReview = true;
  c.verifyDefects = ["Image changed; inspect the final asset and run regencase verify before release"];
  saveCase(c);
}
