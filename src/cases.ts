// Queue loader: reads cases/<folder>/case.json files, resolves public image URLs,
// and writes cases back (so generated drafts + stages persist for the user to review).

import { readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import type { Case, ImageUrl } from "./types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Resolve config.casesDir (may be relative) against the project root. */
function casesRoot(): string {
  return join(projectRoot, config.casesDir);
}

/** Parse the leading digits of a folder name, e.g. "00007-foo" -> 7. */
function leadingNumber(folder: string): number | undefined {
  const m = folder.match(/^(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Read every cases/*\/case.json, set `.folder` to the directory name, sort by
 * `postAt` ascending, and assign `.number` from the folder's leading digits
 * (falling back to sequential order).
 */
export function loadCases(): Case[] {
  const root = casesRoot();
  if (!existsSync(root)) return [];

  const cases: Case[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(root, entry.name, "case.json");
    if (!existsSync(file)) continue;
    const c = JSON.parse(readFileSync(file, "utf8")) as Case;
    c.folder = entry.name;
    cases.push(c);
  }

  cases.sort((a, b) => a.postAt.localeCompare(b.postAt));

  cases.forEach((c, i) => {
    c.number = leadingNumber(c.folder) ?? i + 1;
  });

  return cases;
}

/** A resolved public image URL for a file inside a case folder. */
export function imageUrl(folder: string, filename: string): ImageUrl {
  return `${config.githubRawBase}/cases/${folder}/${filename}`;
}

/** Write a case back to cases/<folder>/case.json as pretty JSON. */
export function saveCase(c: Case): void {
  const file = join(casesRoot(), c.folder, "case.json");
  writeFileSync(file, JSON.stringify(c, null, 2) + "\n", "utf8");
}

// --- no-repeat tracking -----------------------------------------------------
// Every diagnosis that has ever been posted (seeded with the account's history)
// lives in data/used-diagnoses.json, so no case is ever repeated. We compare on a
// normalized form and also track aliases, so "Gossypiboma" and "Retained surgical
// sponge" both count as the same case.

const usedFile = join(projectRoot, "data", "used-diagnoses.json");

export function normalizeDx(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readUsedRaw(): string[] {
  if (!existsSync(usedFile)) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(readFileSync(usedFile, "utf8"));
  } catch {
    // Fail CLOSED: a truncated/corrupt dedup file must NEVER silently read as "empty" — that
    // would make every diagnosis look fresh and let a posted case repeat. Refuse loudly instead.
    throw new Error(`used-diagnoses.json is not valid JSON — refusing to run the no-repeat gate blind. Fix ${usedFile}.`);
  }
  return Array.isArray(arr) ? (arr as string[]) : [];
}

/** The set of normalized diagnosis names (incl. aliases) that have already been used. */
export function loadUsedDiagnoses(): Set<string> {
  return new Set(readUsedRaw().map(normalizeDx));
}

/** True if this diagnosis (or any alias) has already been used. */
export function isUsedDiagnosis(used: Set<string>, name: string, aliases: string[] = []): boolean {
  return [name, ...aliases].some((x) => used.has(normalizeDx(x)));
}

/** Record a diagnosis (and aliases) as used, so it can never be posted again. */
export function addUsedDiagnosis(name: string, aliases: string[] = []): void {
  const arr = readUsedRaw();
  const set = new Set(arr.map(normalizeDx));
  let changed = false;
  for (const x of [name, ...aliases]) {
    const n = normalizeDx(x);
    if (n && !set.has(n)) {
      arr.push(x);
      set.add(n);
      changed = true;
    }
  }
  if (changed) {
    // Atomic write (tmp + rename) so a crash mid-write can't truncate the dedup file and wipe
    // the posted-diagnosis history — the same guarantee state.json already uses.
    const tmp = `${usedFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(arr, null, 2) + "\n", "utf8");
    renameSync(tmp, usedFile);
  }
}
