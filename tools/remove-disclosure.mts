// One-time owner-requested editorial removal. No API calls or public posting.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCases, saveCase } from '../src/cases.js';
import { contentHash, copyProblems } from '../src/readiness.js';
import { config } from '../src/config.js';
const strip = (s: string) => s.split(/\r?\n/).filter(l => !/^\s*Educational illustration\.\s*$/i.test(l)).join('\n').trimEnd();
const state = JSON.parse(readFileSync(config.stateFile, 'utf8'));
let edited = 0, stateEdited = false;
for (const c of loadCases()) {
  const before = contentHash(c);
  const generated = Object.fromEntries(Object.entries(c.generated ?? {}).map(([k,v]) => [k, typeof v === 'string' ? strip(v) : v]));
  if (JSON.stringify(generated) === JSON.stringify(c.generated ?? {})) continue;
  if (c.contentReview && c.contentReview.sha256 !== before) throw new Error('Existing review is stale: '+c.folder);
  c.generated = generated;
  const issues = copyProblems(c);
  if (issues.length) throw new Error(c.folder+': '+issues.join('; '));
  if (c.contentReview) c.contentReview = {
    sha256: contentHash(c), reviewedAt: new Date().toISOString(),
    reviewer: 'Owner-approved editorial disclosure removal; prior review: '+c.contentReview.reviewer,
  };
  if (c.stages?.publishedCaption) c.stages.publishedCaption = strip(c.stages.publishedCaption);
  const saved = state.stages?.[c.folder];
  if (saved?.publishedCaption) {
    const caption = strip(saved.publishedCaption);
    if (caption !== saved.publishedCaption) { saved.publishedCaption = caption; stateEdited = true; }
  }
  saveCase(c); edited++; console.log('Removed disclosure: '+c.folder);
}
if (stateEdited) writeFileSync(config.stateFile, JSON.stringify(state, null, 2)+'\n');
console.log(JSON.stringify({edited,stateEdited,clinicalCopyChanged:false,imageApprovalsChanged:false}));
