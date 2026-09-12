# Future queue repair report: 12 September 2026

All six previously held future slots are resolved through renewed review, image repair or owner-approved replacement. The active queue contains eight consecutive ready cases from 12 to 19 September. Failed candidates remain retired and cannot enter the publishing queue.

## What was fixed

| Original held case | Outcome | Final scheduled case |
| --- | --- | --- |
| Madelung deformity | Repeated repairs still showed a traumatic fracture or carpal dislocation. Retired at the owner's request. | 00158 Hypertrophic nonunion |
| Dracunculiasis | Replaced the weak original image with the existing Flare pilot. Tightened the answer to a likely calcified remnant in the exposure context, without claiming active infection. Renewed image and copy QA passed. | 00148 Dracunculiasis |
| Metal-rod impalement | Original image retained. Renewed image and copy QA passed. Copy explicitly preserves the depth and trajectory limits of one AP view. | 00146 Impalement by a metal rod |
| Duodenal atresia | Original image retained. Renewed image and copy QA passed. Copy distinguishes a proximal obstruction pattern from proof that the entire distal bowel is gasless. | 00149 Duodenal atresia |
| Ochronosis | Regenerated candidates did not achieve consistent image and copy approval. Retired at the owner's request. | 00159 Chondrocalcinosis |
| DISH | Regenerated image failed renewed independent review. Retired at the owner's request. | 00161 Swallowed spoon |

All three final replacement images were generated with gpt-image-2.5-flare at high quality. Each final active image was visually inspected and has a passing Anthropic image review plus a current copy review. The knee replacement needed one targeted repair to make the meniscal calcification distinct from the underlying bone cortex. A proposed calcified pleural-plaque replacement failed QA and looked unnaturally patterned on visual inspection, so it was retired and replaced by the spoon case.

## Copy and QA changes

- Removed sentence-opening And fragments from affected queued captions and removed prose commas and semicolons from the edited case copy.
- Corrected the knee caption's duplicated patient wording and removed its unnecessary alternate caption.
- Kept treatment statements general and conditional. No biopsy, operation, recovery or confirmed patient outcome was invented.
- Supplied the clinical vignette to the second image assessment. Previously this assessment omitted the case history while deciding whether one answer was sufficiently supported. The first image read remains blind to both the intended answer and vignette.
- Clarified that the task is to identify the best-supported answer. A lower-ranked possible alternative is not automatically an image defect. Equally or better supported alternatives, missing required findings and unexplained lesions still fail.
- Bound new image approvals to the clinical vignette hash. Changing that context now invalidates the approval. Earlier image-only approvals remain valid because they did not depend on this additional context.
- Synchronized the final approved conditions back into the generation pool and marked retired original conditions as unavailable for public generation.
- Preserved contradictory spine reviews with exact asset hashes in qa-2026-09-12-review-conflicts.json. A bounded independent Opus assessment also failed, so no disagreement was resolved by forcing an approval.

## Final schedule

All times are 22:00 Africa/Cairo, currently 19:00 UTC.

| Date | Case | Queue check |
| --- | --- | --- |
| 12 September | 00152 Luxatio erecta | Ready; existing image and copy preserved |
| 13 September | 00145 Swallowed safety pin | Ready; existing image and copy preserved |
| 14 September | 00158 Hypertrophic nonunion | Ready |
| 15 September | 00148 Dracunculiasis | Ready |
| 16 September | 00146 Impalement by a metal rod | Ready |
| 17 September | 00149 Duodenal atresia | Ready |
| 18 September | 00159 Chondrocalcinosis | Ready |
| 19 September | 00161 Swallowed spoon | Ready |

The scheduler uses Cairo civil time and reserves one challenge per night. Actual publication follows the running workflow's polling cycle. This report records readiness, not a claim that future posts have already published.

## Verification

Passed after the code changes: npm run typecheck, tools/verify-image-evidence.mts, npm run audit:verify and npm run publishing:verify. The fixtures verify blind-first review, clinical-context inclusion and invalidation after a vignette change, alongside the existing publishing protections. The final npm run queue:check exited successfully with eight ready active cases and no active holds. Final asset bytes are also checked against approval hashes before publishing.

The reply bot remains on deployed commit 897f266860685500a7a60b82ac42cf75b88c32d5. No reply-bot source files were changed in this task. Anthropic access was tested successfully after the recharge. The publisher release is committed and pushed separately; its live run and public-asset checks are reported in the completion message.

## What was not fixed or released

Madelung, DISH and ochronosis were not successfully repaired into releasable cases. They were replaced with the owner's approval. Their failed images and reviews remain retired for traceability. The failed pleural-plaque candidate is also retired. The previously rejected lightbulb remains retired. No failed image was released by removing its hold alone.

The routine QA model remains Sonnet. Opus was used only to investigate two contradictory spine reviews and did not justify a global model change. No guarantee of diagnostic perfection or radiologist certification is implied by an automated pass. No social post or comment was manually published, edited or deleted during this queue repair.

## Paid usage recorded during this repair

These are provider request records from this task, including failed candidates and repeated reviews. They are not dollar charges. The Anthropic and OpenAI billing dashboards remain the source of actual cost. Reusing the existing Guinea-worm pilot avoided a new image-generation request for that case.

| Stage | Model | Recorded requests |
| --- | --- | --- |
| caption | claude-sonnet-4-6 | 8 |
| copy-qa | claude-opus-4-6 | 2 |
| copy-qa | claude-sonnet-4-6 | 19 |
| image | gpt-image-2.5-flare | 10 |
| image-qa | claude-opus-4-6 | 4 |
| image-qa | claude-sonnet-4-6 | 34 |
| qa-preflight | claude-sonnet-4-6 | 5 |

## Clinical references checked

- [Madelung radiographic features](https://pubmed.ncbi.nlm.nih.gov/26135644/)
- [Calcified Guinea-worm remnants](https://pmc.ncbi.nlm.nih.gov/articles/PMC3159369/)
- [Thoracic impalement management](https://pmc.ncbi.nlm.nih.gov/articles/PMC3039238/)
- [Duodenal obstruction](https://www.merckmanuals.com/professional/pediatrics/congenital-gastrointestinal-anomalies/duodenal-obstruction)
- [Alkaptonuria](https://www.ncbi.nlm.nih.gov/books/NBK1454/)
- [DISH imaging](https://pmc.ncbi.nlm.nih.gov/articles/PMC5604607/)
- [Hypertrophic nonunion](https://pmc.ncbi.nlm.nih.gov/articles/PMC11201148/)
- [CPPD and cartilage calcification](https://rheumatology.org/patients/calcium-pyrophosphate-deposition-cppd)
- [Pleural plaques](https://www.rightdecisions.scot.nhs.uk/tam-treatments-and-medicines-nhs-highland/therapeutic-guidelines/respiratory/pleural-plaques-guidelines/)
- [ASGE foreign-body guidance](https://www.asge.org/docs/default-source/education/practice_guidelines/doc-management-of-ingested-foreign-bodies-and-food-impactions.pdf)

The pleural guideline page returned HTTP 403 and the ASGE landing page returned HTTP 502 during direct opening. Relevant indexed guideline content and the ASGE guideline PDF supplied the facts used. Early maintenance file reads also encountered missing paths; the actual modules were identified from package scripts and imports before further work.

## Concurrent publisher batch reconciled before release

The scheduled heartbeat restarted the previously canceled publisher and generated five additional cases while local repairs were in progress: gas gangrene, portal venous gas, pulmonary hydatid cyst, swallowed spoon and swallowed keys. Three failed its image gate. The hydatid and spoon candidates had automated approvals but had not received the visual review used for this release. All five are preserved as retired candidates superseded by the reviewed eight-night queue. Their condition usage history is retained. The local replacement folders were renumbered to 00158, 00159 and 00161 to avoid collisions, and the duplicate spoon cannot publish twice.

These five automatically generated images are additional to the ten local image requests listed above. The remote workflow did not commit their usage rows, so the local table is not a complete account of concurrent publisher spend.

A request to temporarily disable the whole publisher workflow was rejected by automatic approval review because it could persistently stop scheduled publishing. No workflow-disable action was performed. The reconciliation used the canceled individual run, preserved remote commits through rebase and retained all candidate files.
