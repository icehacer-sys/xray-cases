# Case-sourcing prompt for ChatGPT

Paste the whole block below into ChatGPT (turn web search ON). Change only the
`SYSTEM` line to work through one body system at a time.

---

You are a consultant radiologist helping me source teaching cases for a medical
education account. I need **real, documented conditions only**. Every suggestion must be
something that genuinely exists in the published literature and is genuinely visible on
the plain-film modality you name. Do not invent conditions, do not invent signs, and do
not stretch a real condition into a finding it does not actually produce.

**SYSTEM: musculoskeletal**
(run again with: chest and mediastinum / abdomen and GI / genitourinary / head, skull and
facial bones / dental and jaws / paediatric and congenital / obstetric / foreign bodies and
trauma / occupational and environmental / infectious and tropical / metabolic and endocrine /
haematological / iatrogenic, devices and post-surgical)

## What I need

Give me **15 candidate cases** in that system, ranked by how visually striking they are on
the film. For each one:

1. **Diagnosis** — the standard name, plus common synonyms and eponyms.
2. **Modality and view** — the exact plain-film view that shows it best, e.g. "PA chest",
   "lateral lumbar spine", "panoramic dental". If the finding is only really visible on CT,
   MRI or ultrasound, **say so and exclude it** — I can only use plain radiographs.
3. **Key radiographic findings** — what is actually visible, in the order a radiologist
   would notice it. Name the classic sign if there is one.
4. **Typical patient age** — infant, child, adolescent, young adult, middle-aged, or older.
   This drives how I render the skeleton, so be specific.
5. **Why it matters clinically** — two sentences.
6. **Evidence it is real** — at least one of: a PubMed/PMC citation, a Radiopaedia article,
   a StatPearls entry, or a named textbook. Give the actual link or citation. **If you
   cannot find a real source, drop the case and replace it.**
7. **Shock rating 1–10** — how obviously wrong the film looks to a non-medical person
   scrolling past in one second.

## Hard requirements

- **Documented only.** Every case must be findable online by a reader who checks. My
  audience includes doctors and radiographers, and a fabricated case would destroy the
  account's credibility.
- **No invented signs.** If a condition is real but its classic appearance is on CT rather
  than plain film, say that plainly instead of pretending the X-ray shows it.
- **Plain radiograph only.** No CT, MRI, ultrasound, nuclear medicine or angiography.
- **Prefer ADDITIVE or EXPANSILE findings** — calcification, ossification, dense foreign
  material, gas in the wrong place, expansile bone lesions, organ displacement. These
  render reliably. **Avoid findings whose whole point is absent or vanishing bone**, subtle
  cortical erosion, or fine trabecular texture.
- **One dominant abnormality per case.** I need a film where one thing is obviously wrong,
  not a subtle multi-finding puzzle.
- **Flag anything with framing problems.** Tell me if the classic view would include the
  pelvis, groin or genitalia, because I have to crop those out.
- **Flag sensitivity.** Tell me if a case involves child abuse, self-harm, execution,
  or anything likely to distress a general audience, so I can decide separately.

## Already covered — do not suggest any of these or a close variant

Achalasia; Achondroplasia; Acute subdural hematoma; Ainhum; Ameloblastoma; Aneurysmal bone cyst; Ascariasis bowel infestation; Bochdalek hernia; Bone sarcoidosis; Bullet embolism; Caffey disease; Calcific constrictive pericarditis; Calcified fibroadenoma; Calcified meningioma; Calcified pleural plaques; Calcified pulmonary hydatid cyst; Calcinosis universalis; Cannonball metastases; Cervical rib; Charcot joint; Cherubism; Chilaiditi syndrome; Chondrocalcinosis; Chronic osteomyelitis with sequestrum; Chronic pancreatitis with calcification; Cloverleaf skull; Cochlear implant; Coin in the oesophagus; Complex odontoma; Compound odontoma; Craniofacial fibrous dysplasia; Dentigerous cyst; Diffuse idiopathic skeletal hyperostosis; Dracunculiasis; Duodenal atresia; Dyke-Davidoff-Masson syndrome; Eagle syndrome; Ectrodactyly; Edwards syndrome; Elephantiasis; Emphysematous cholecystitis; Emphysematous pyelonephritis; Engelmann disease; Epidermodysplasia verruciformis; Epidural hematoma; Erlenmeyer flask deformity; Ewing sarcoma; Fetus in fetu; Fibrodysplasia ossificans progressiva; Fish hook impaction in the esophagus; Gallstone ileus; Gardner syndrome; Gas gangrene; Giant cell tumor of bone; Giant gallstone; Giant renal angiomyolipoma; Giant submandibular sialolith; Gorham disease; Gossypiboma; Haemochromatosis arthropathy; Haemophilic arthropathy; Hand-Schuller-Christian disease; Hurler syndrome; Hyperparathyroidism; Hypertrophic osteoarthropathy; Impalement by a metal rod; Infantile scurvy; Intrathoracic stomach with gastric volvulus; Klippel-Feil syndrome; Klippel-Trenaunay syndrome; Lithopedion; Madelung deformity; Maffucci syndrome; Massive ovarian cyst; Massive splenomegaly; Massive substernal goiter; Meconium peritonitis; Mediastinal teratoma; Melorheostosis; Miliary tuberculosis; Motion artifact; Mycetoma; Myositis ossificans; Nail gun injury to the skull; Neurofibromatosis type 1; Ochronosis; Odontogenic keratocyst; Ollier disease; Osteochondroma; Osteogenesis imperfecta; Osteoid osteoma; Osteomalacia with Looser zones; Osteopoikilosis; Paget disease of bone; Pectus excavatum; Pindborg tumor; Pneumatosis intestinalis; Pneumoperitoneum; Portal venous gas; Pott disease; Progressive massive fibrosis; Proteus syndrome; Psoriatic arthritis mutilans; Pulmonary alveolar microlithiasis; Pulmonary hamartoma; Pulmonary hydatid cyst; Pyknodysostosis; Retained Pantopaque contrast; Retained surgical instrument; Retrosternal goiter; Rhinolith; Rib notching in aortic coarctation; Rugger jersey spine; Sacrococcygeal teratoma; Sclerosteosis; Shepherd's crook deformity; Sigmoid volvulus; Situs inversus totalis; Sliding hiatus hernia; Small bowel obstruction; Splenic calcification; Spondylolisthesis; Sprengel deformity; Staghorn calculus; Swallowed coins; Swallowed keys; Swallowed light bulb; Swallowed padlock; Swallowed safety pin; Swallowed spoon; Swallowed sword; Tooth in the nasal cavity; Tophaceous gout; Tracheo-oesophageal fistula; Tumoral calcinosis; Zenker diverticulum

## Output format

A table with: Diagnosis | View | Age band | Key findings | Source link | Shock /10.
Then, underneath, any case you rejected and the reason — especially anything you dropped
because you could not verify it or because it is not really a plain-film finding.
