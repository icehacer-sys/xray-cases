import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateThreadsCaption, generateThreadsAnswer, withFollowCta } from '../src/captions.js';
import { copyProblems } from '../src/readiness.js';
import type { Case, Condition } from '../src/types.js';
// No model calls: reviewed conditions already supply every answer section.
globalThis.fetch = async () => { throw new Error('Pool check must not call the network'); };
const pool = JSON.parse(readFileSync(new URL('../data/conditions.json', import.meta.url), 'utf8')) as Condition[];
const reviewed = pool.filter(c => !c.used && !c.skipPublic && c.sources?.length && c.reviewedAt);
for (const condition of reviewed) {
  const c = { ...condition, condition, source: 'generated', igSlides: [], seedHint: '', folder: 'fixture', postAt: '2030-01-01T19:00:00Z' } as unknown as Case;
  c.generated = { threadsCaption: generateThreadsCaption(c), threadsCaptionAlt: '', threadsAnswer: await generateThreadsAnswer(c), igCaption: '', ctaText: '' };
  assert.deepEqual(copyProblems(c), [], condition.diagnosis);
  assert.ok(withFollowCta(c.generated.threadsCaption!, true).length <= 500, condition.diagnosis);
  assert.ok(condition.requiredObservations?.length);
  assert.ok(c.generated.threadsAnswer!.includes('💊 Treatment:'), condition.diagnosis + ' lost treatment');
}
assert.ok(reviewed.length > 0);
console.log(`PASS ${reviewed.length} unused source-reviewed conditions: complete captions/answers, no literal answer leaks, follow arm fits, treatment retained`);
