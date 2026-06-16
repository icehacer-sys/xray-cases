// Queue loader: reads cases/<folder>/case.json files, resolves public image URLs,
// and writes cases back (so generated drafts + stages persist for the user to review).

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
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
