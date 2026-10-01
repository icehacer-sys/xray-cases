// Offline: the verifier rejects a hand or foot with other than five digits. No network.
// Repro: 2026-10-01 00180 Kienbock posted a six-finger hand that the gate had passed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseXrayVerdict } from "../src/verify.js";
import type { Condition } from "../src/types.js";

const cond = JSON.parse(readFileSync(new URL("../cases/00180-kienbock/case.json", import.meta.url), "utf8")).condition as Condition;
const required = cond.requiredObservations ?? [cond.keyFindings];
const base = {
  unexplainedFindings: [], singleAnswerSupported: true, diagnosticReason: "Sclerotic collapsed lunate",
  plausible: true, depictsDiagnosis: true, correctBodyPart: true, severity: "pass", defects: [],
  observations: required.map((expected) => ({ expected, observed: "seen", assessable: true, matches: true })),
};
const verdict = (digitCounts: unknown, c: Condition = cond) =>
  parseXrayVerdict(JSON.stringify(digitCounts === undefined ? base : { ...base, digitCounts }), c);

const six = verdict([{ part: "hand", digits: 6, allDigitsInFrame: true }]);
assert.equal(six.ok, false, "six fingers fail the gate even when every other field passes");
assert.match(six.defects.join(" "), /hand shows 6 digits \(must be 5\)/);
assert.equal(verdict([{ part: "foot", digits: 6, allDigitsInFrame: true }]).ok, false, "six toes fail");
assert.equal(verdict([{ part: "hand", digits: 4, allDigitsInFrame: true }]).ok, false, "four fingers fail");
assert.equal(verdict([{ part: "hand", digits: 5, allDigitsInFrame: true }]).ok, true, "a normal hand passes");
assert.equal(verdict([]).ok, true, "no hand or foot in frame passes");
assert.equal(verdict([{ part: "hand", digits: 3, allDigitsInFrame: false }]).ok, true, "digits cropped out by collimation are not counted");
assert.equal(verdict(undefined).ok, false, "a verdict without digit counts is rejected");
assert.equal(verdict([{ part: "hand", digits: 5.5, allDigitsInFrame: true }]).ok, false, "a non-integer count is rejected");
assert.equal(verdict([{ part: "paw", digits: 5, allDigitsInFrame: true }]).ok, false, "an unknown part is rejected");
const ectrodactyly = { ...cond, diagnosis: "Ectrodactyly", aliases: ["split hand"] } as Condition;
assert.equal(verdict([{ part: "hand", digits: 4, allDigitsInFrame: true }], ectrodactyly).ok, true, "a diagnosis that changes the digit count is exempt");
console.log("PASS digit count: six fingers or toes, four fingers, missing or malformed counts fail; normal, cropped and digit-changing diagnoses pass. No network.");
