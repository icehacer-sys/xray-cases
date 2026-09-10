// Tiny file-backed run state: per-case posting stages so a restart never
// double-posts, plus a daily/total challenge counter. Good enough for a
// cron-on-a-box; for serverless swap this for a real store (same interface).

import { existsSync, readFileSync } from "node:fs";
import { config } from "./config";
import type { Case } from "./types";
import { atomicJson, checkpointState, PersistenceError, validPublications, type Publication, type PublicationStore } from "./persistence.js";

type Stages = NonNullable<Case["stages"]>;

interface StateShape {
  publications?: Record<string, Publication>;
  // folder -> the stages we've recorded for that case.
  stages: Record<string, Stages>;
  // challenges posted: a running total + today's count.
  posted: { total: number; daily: { date: string; count: number } };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class State {
  private publications: Record<string, Publication>;
  private stages: Record<string, Stages>;
  private total: number;
  private daily: { date: string; count: number };

  constructor() {
    if (config.confirmLive && !existsSync(config.stateFile)) {
      throw new PersistenceError(`Missing ${config.stateFile}; restore publication history before running live`);
    }
    let loaded: StateShape | null = null;
    if (existsSync(config.stateFile)) {
      try {
        loaded = JSON.parse(readFileSync(config.stateFile, "utf8")) as StateShape;
        if (loaded?.posted !== undefined && (!loaded.posted || !Number.isInteger(loaded.posted.total) || loaded.posted.total < 0 || !loaded.posted.daily || typeof loaded.posted.daily.date !== "string" || !Number.isFinite(Date.parse(loaded.posted.daily.date)) || !Number.isInteger(loaded.posted.daily.count) || loaded.posted.daily.count < 0)) throw new Error("invalid posting counters");
        if (!loaded || !loaded.stages || typeof loaded.stages !== "object" || Array.isArray(loaded.stages) ||
            !Object.values(loaded.stages).every((s) => s && typeof s === "object" && !Array.isArray(s) && Object.values(s).every((v) => typeof v === "string")) ||
            (loaded.publications !== undefined && !validPublications(loaded.publications))) throw new Error("invalid state fields");
      } catch {
        throw new PersistenceError(`Cannot read ${config.stateFile}; refusing to reset publication history`);
      }
    }
    this.stages = loaded?.stages ?? {};
    this.publications = loaded?.publications ?? {};
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

  publication(key: string): PublicationStore {
    return {
      get: () => this.publications[key],
      set: (value) => {
        this.publications[key] = value;
        this.save();
        checkpointState(config.stateFile);
      },
    };
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

  /**
   * How many challenges have actually been published, derived from the recorded
   * stages rather than the `posted.total` counter (countPosted() is never called,
   * so that counter reads 0). Used as the CTA rotation index so the rotation
   * advances once per published case, in posting order.
   */
  publishedCount(): number {
    return Object.values(this.stages).filter((s) => s.challengePostedAt).length;
  }

  private save(): void {
    const out: StateShape = {
      publications: this.publications,
      stages: this.stages,
      posted: { total: this.total, daily: this.daily },
    };
    // Atomic write: a crash mid-write would otherwise leave state.json truncated,
    // the constructor's JSON.parse would throw + reset ALL stages to {}, and every
    // challenge-posted case would re-enter Stage 1 and double-post. Writing to a temp
    // file then renaming guarantees the live file is always a complete old-or-new copy
    // (rename is atomic on the same filesystem).
    atomicJson(config.stateFile, out);
  }
}
