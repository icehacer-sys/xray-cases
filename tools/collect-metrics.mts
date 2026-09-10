// Read-only against Threads. Stores lifetime exposure with an explicit sampling time and case arm.
import { existsSync, readFileSync } from "node:fs";
import { loadCases } from "../src/cases.js";
import { State } from "../src/state.js";
import { config, requireEnv } from "../src/config.js";
import { atomicJson } from "../src/persistence.js";
const file = "data/case-metrics.json", state = new State();
const rows = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
if (!Array.isArray(rows)) throw new Error("Invalid metrics history");
for (const c of loadCases()) {
  const s = state.getStages(c.folder);
  if (!s.experiment || !s.threadsPostId || !s.challengePostedAt || Date.parse(s.challengePostedAt) < Date.now() - 7 * 86400000) continue;
  const prior = rows.filter((r: any) => r.folder === c.folder).at(-1);
  if (prior && Date.now() - Date.parse(prior.measuredAt) < 6 * 3600000) continue;
  const url = new URL(`${config.threadsBase}/${s.threadsPostId}/insights`);
  url.searchParams.set("metric", "views,likes,replies,reposts,quotes");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${requireEnv("THREADS_ACCESS_TOKEN")}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Metrics for ${c.folder}: HTTP ${res.status}`);
  const body = await res.json() as { data?: { name: string; values?: { value: unknown }[] }[] };
  const metrics = Object.fromEntries((body.data ?? []).map(m => [m.name, typeof m.values?.[0]?.value === "number" ? m.values[0].value : null]));
  rows.push({ folder: c.folder, postId: s.threadsPostId, measuredAt: new Date().toISOString(), publishedAt: s.challengePostedAt, ageHours: (Date.now() - Date.parse(s.challengePostedAt)) / 3600000, experiment: JSON.parse(s.experiment), caption: s.publishedCaption, answerDueAt: new Date(Date.parse(s.challengePostedAt) + Number(s.answerDelayMin) * 60000).toISOString(), ctaDueAt: new Date(Date.parse(s.challengePostedAt) + Number(s.ctaDelayMin) * 60000).toISOString(), metrics });
  atomicJson(file, rows);
}
console.log("Case metrics collected; no posts created.");
