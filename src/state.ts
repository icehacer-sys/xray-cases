// Tiny file-backed run state: per-case posting stages so a restart never
// double-posts, plus a daily/total challenge counter. Good enough for a
// cron-on-a-box; for serverless swap this for a real store (same interface).

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { config } from "./config";
import type { Case } from "./types";

type Stages = NonNullable<Case["stages"]>;

interface StateShape {
  // folder -> the stages we've recorded for that case.
  stages: Record<string, Stages>;
  // challenges posted: a running total + today's count.
  posted: { total: number; daily: { date: string; count: number } };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class State {
  private stages: Record<string, Stages>;
  private total: number;
  private daily: { date: string; count: number };

  constructor() {
    let loaded: StateShape | null = null;
    if (existsSync(config.stateFile)) {
      try {
        loaded = JSON.parse(readFileSync(config.stateFile, "utf8")) as StateShape;
      } catch {
        loaded = null;
      }
    }
    this.stages = loaded?.stages ?? {};
    this.total = loaded?.posted?.total ?? 0;
    this.daily =
      loaded?.posted?.daily && loaded.posted.daily.date === today()
        ? loaded.posted.daily
        : { date: today(), count: 0 };
  }

  /** The recorded stages for a case, or an empty object if none yet. */
  getStages(folder: string): Stages {
    return this.stages[folder] ?? {};
  }

  /** Merge `partial` into a case's stages and persist. Returns the merged stages. */
  setStages(folder: string, partial: Partial<Stages>): Stages {
    const merged: Stages = { ...this.getStages(folder), ...partial };
    this.stages[folder] = merged;
    this.save();
    return merged;
  }

  /** Bump the challenge-posted counters (call once per challenge published). */
  countPosted(): void {
    if (this.daily.date !== today()) this.daily = { date: today(), count: 0 };
    this.total += 1;
    this.daily.count += 1;
    this.save();
  }

  /** Challenges published today. */
  postedToday(): number {
    return this.daily.date === today() ? this.daily.count : 0;
  }

  /** Challenges published all-time. */
  postedTotal(): number {
    return this.total;
  }

  private save(): void {
    const out: StateShape = {
      stages: this.stages,
      posted: { total: this.total, daily: this.daily },
    };
    // Atomic write: a crash mid-write would otherwise leave state.json truncated,
    // the constructor's JSON.parse would throw + reset ALL stages to {}, and every
    // challenge-posted case would re-enter Stage 1 and double-post. Writing to a temp
    // file then renaming guarantees the live file is always a complete old-or-new copy
    // (rename is atomic on the same filesystem).
    const tmp = `${config.stateFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(out, null, 2));
    renameSync(tmp, config.stateFile);
  }
}
