import type { Case } from "./types.js";
import { config } from "./config.js";
import { localDate, localSlot, nextSlot, nightKey } from "./schedule.js";
import { readinessProblem } from "./readiness.js";
import { saveCase } from "./cases.js";
import type { State } from "./state.js";
/** Fill empty nightly slots with ready cases. Never move a container with an uncertain outcome. */
export function repairQueueSlots(cases: Case[], state: State, now: Date): void {
  let slot = localSlot(localDate(now, config.activeTz), config.postHourLocal, config.activeTz);
  const occupied = new Set(cases.flatMap(c => {
    const posted = state.getStages(c.folder).challengePostedAt ?? c.stages?.challengePostedAt;
    const pending = state.publication(`case:${c.folder}:challenge`).get();
    return posted ? [nightKey(new Date(posted), config.activeTz)] : pending ? [nightKey(new Date(c.postAt), config.activeTz), nightKey(now, config.activeTz)] : [];
  }));
  for (const c of cases) {
    if (state.getStages(c.folder).challengePostedAt || c.stages?.challengePostedAt || state.publication(`case:${c.folder}:challenge`).get() || readinessProblem(c)) continue;
    while (occupied.has(nightKey(slot, config.activeTz))) slot = nextSlot(slot, config.postHourLocal, config.activeTz);
    // Compact ready cases into consecutive nightly slots, leaving held cases for repair.
    if (Date.parse(c.postAt) !== slot.getTime()) {
      c.postAt = slot.toISOString(); saveCase(c); console.log(`Scheduled ready case ${c.folder} at ${c.postAt}`);
    }
    occupied.add(nightKey(slot, config.activeTz)); slot = nextSlot(slot, config.postHourLocal, config.activeTz);
  }
}
