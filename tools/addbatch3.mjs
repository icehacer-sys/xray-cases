// Batch 3 (2026-08-13): 14 curated conditions. The audience-poll list is fully spent, so these
// are picked against the owner's rules rather than requested: half max-shock, half teaching
// classics, ZERO paediatric framing (Edwards and Caffey were both refused by OpenAI's safety
// system as infant cases), and every `view` deliberately narrow and cropped clear of the pelvis
// and groin so nothing repeats the censor block that stalled 00112/00113.
// Findings lean additive (calcification, periosteal new bone, gas, contrast) because gpt-image-2
// renders those reliably and fails at vanishing bone. Prose follows the no-comma house style.
//
// Run: node tools/addbatch3.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/conditions.json";

const NEW = [
  {
    diagnosis: "Miliary tuberculosis",
    aliases: ["miliary TB", "disseminated tuberculosis", "millet seed lung"],
    symptom: "weeks of fever night sweats and a cough that would not settle",
    hook: "both lungs were dusted with thousands of tiny identical specks",
    view: "PA chest",
    keyFindings:
      "countless uniform tiny nodules of roughly two millimetres scattered evenly through both lungs from apex to base giving a fine snowstorm appearance",
    whatYouSee: "Both lungs are peppered evenly with thousands of tiny nodules all the same size like a snowstorm frozen in place.",
    whyItMatters: "The infection has escaped the lung and seeded through the bloodstream so it is now everywhere including the brain.",
    treatment: "Months of combined antituberculous drugs started urgently and continued well past the point of feeling better.",
    takeaway: "Thousands of identical tiny nodules evenly spread through both lungs is miliary tuberculosis.",
    igTitle: "THE SNOWSTORM LUNG",
    igOptions: ["Miliary tuberculosis", "Pulmonary oedema", "Sarcoidosis"],
    igCorrect: "A",
  },
  {
    diagnosis: "Emphysematous cholecystitis",
    aliases: ["gas forming cholecystitis", "gas in the gallbladder wall"],
    symptom: "severe right upper belly pain and fever in a poorly controlled diabetic",
    hook: "there was gas outlining an organ that should never contain any",
    view: "AP upper abdomen cropped above the pelvis",
    keyFindings:
      "a curved rim of gas outlining the gallbladder wall with more gas collected inside the lumen in the right upper abdomen",
    whatYouSee: "A thin curve of gas traces the whole outline of the gallbladder and more gas sits trapped inside it.",
    whyItMatters: "Gas forming bacteria are eating the gallbladder wall from within and it can perforate within hours.",
    treatment: "Emergency antibiotics with urgent removal of the gallbladder or a drain if the patient is too unwell.",
    takeaway: "Gas drawing the outline of the gallbladder is emphysematous cholecystitis until proven otherwise.",
    igTitle: "THE ORGAN FULL OF AIR",
    igOptions: ["Bowel gas overlying the liver", "Emphysematous cholecystitis", "A large gallstone"],
    igCorrect: "B",
  },
  {
    diagnosis: "Bullet embolism",
    aliases: ["missile embolism", "migrating bullet"],
    symptom: "a gunshot wound to the thigh yet the bullet was nowhere near the entry point",
    hook: "the bullet had travelled through the bloodstream and parked in the chest",
    view: "PA chest",
    keyFindings:
      "a dense metallic bullet fragment lying within the pulmonary vascular shadow of the chest with no fracture or wound track anywhere near it",
    whatYouSee: "A solid metal bullet sits deep in the chest vessels with no injury track anywhere around it to explain how it arrived.",
    whyItMatters: "The bullet entered a vein and was carried by the blood until the vessel became too narrow to pass.",
    treatment: "Removal by catheter or surgery depending on where it lodges and how unstable it is.",
    takeaway: "A bullet far from its entry wound with no track has embolised through the bloodstream.",
    igTitle: "THE BULLET THAT SWAM",
    igOptions: ["A second gunshot wound", "An old surgical clip", "Bullet embolism"],
    igCorrect: "C",
  },
  {
    diagnosis: "Rib notching in aortic coarctation",
    aliases: ["rib notching", "coarctation of the aorta", "inferior rib notching"],
    symptom: "high blood pressure in the arms with weak pulses in both legs",
    hook: "the undersides of the ribs had been quietly scalloped away",
    view: "PA chest",
    keyFindings:
      "smooth scalloped notches along the inferior margins of the posterior third to eighth ribs on both sides with an indented aortic contour",
    whatYouSee: "The lower edges of several ribs on both sides carry smooth scooped notches and the aortic outline is indented.",
    whyItMatters: "A narrowed aorta forces blood through the rib arteries instead and those swollen vessels carve into the bone.",
    treatment: "Repair of the narrowed segment by balloon stent or surgery followed by lifelong blood pressure review.",
    takeaway: "Notched under surfaces of the ribs with high arm pressures points to coarctation of the aorta.",
    igTitle: "THE RIBS THAT WERE EATEN",
    igOptions: ["Rib notching from aortic coarctation", "Healing rib fractures", "Bone metastases"],
    igCorrect: "A",
  },
  {
    diagnosis: "Calcified pulmonary hydatid cyst",
    aliases: ["hydatid cyst", "echinococcal cyst", "dog tapeworm cyst"],
    symptom: "a shepherd with a nagging cough and an odd round shadow found by chance",
    hook: "there was a perfectly round cyst in the lung with a shell of calcium around it",
    view: "PA chest",
    keyFindings:
      "a sharply defined round mass in the lung with a thin curved rim of calcification around its wall and a smooth uniform interior",
    whatYouSee: "A perfectly round mass sits in the lung wrapped in a thin curved shell of calcium like an egg in the chest.",
    whyItMatters: "This is a tapeworm larva living in a fluid cyst and rupturing it can flood the body with allergic protein.",
    treatment: "Antiparasitic drugs with careful surgical removal that avoids spilling the contents.",
    takeaway: "A round lung mass with a calcified rim in a farming region is a hydatid cyst.",
    igTitle: "THE EGG IN THE LUNG",
    igOptions: ["Old healed tuberculosis", "Calcified hydatid cyst", "Lung cancer"],
    igCorrect: "B",
  },
  {
    diagnosis: "Pott disease",
    aliases: ["tuberculous spondylitis", "spinal tuberculosis", "gibbus deformity"],
    symptom: "months of back pain with a sharp angle that had appeared in the spine",
    hook: "two vertebrae had crumbled together and folded the spine into a sharp angle",
    view: "lateral thoracic spine cropped above the pelvis",
    keyFindings:
      "collapse of adjacent vertebral bodies with loss of the disc space between them and sharp angular forward kyphosis at that level",
    whatYouSee: "Two neighbouring vertebrae have collapsed into each other and the spine folds forward into a sharp angle at that point.",
    whyItMatters: "Tuberculosis has eaten through the vertebral bodies and the collapsing bone can press on the spinal cord.",
    treatment: "Long antituberculous drug treatment with surgery to decompress and stabilise a threatened cord.",
    takeaway: "Collapsed neighbouring vertebrae with a lost disc space and a sharp angle is spinal tuberculosis.",
    igTitle: "THE SPINE THAT FOLDED",
    igOptions: ["Osteoporotic collapse", "Pott disease", "Spinal metastases"],
    igCorrect: "B",
  },
  {
    diagnosis: "Zenker diverticulum",
    aliases: ["pharyngeal pouch", "hypopharyngeal diverticulum"],
    symptom: "food coming back up hours later and a gurgling sound in the neck",
    hook: "a pouch had ballooned out of the back of the throat and was holding onto meals",
    view: "lateral neck during a barium swallow",
    keyFindings:
      "a rounded contrast filled pouch projecting backwards from the lower pharynx just above the upper oesophageal sphincter with contrast pooling in it",
    whatYouSee: "A rounded pouch filled with bright contrast bulges backwards out of the lower throat and holds a puddle of it.",
    whyItMatters: "Food collects in the pouch and can spill into the airway at night which is how these patients get pneumonia.",
    treatment: "Endoscopic or open division of the muscle bar with removal or suspension of the pouch.",
    takeaway: "A contrast filled pouch bulging backwards from the lower throat is a Zenker diverticulum.",
    igTitle: "THE POUCH THAT KEPT DINNER",
    igOptions: ["Zenker diverticulum", "Oesophageal cancer", "A swallowed foreign body"],
    igCorrect: "A",
  },
  {
    diagnosis: "Ewing sarcoma",
    aliases: ["Ewing tumour", "onion skin periosteal reaction"],
    symptom: "a young adult with deep arm pain and fevers mistaken for infection",
    hook: "the bone had grown layer upon layer of new shell like an onion",
    view: "AP humerus",
    keyFindings:
      "a moth eaten permeative lesion in the shaft of the humerus with multiple stacked layers of lamellated periosteal new bone and an adjacent soft tissue mass",
    whatYouSee: "The shaft of the bone looks moth eaten and is wrapped in stacked layers of new bone like the rings of an onion.",
    whyItMatters: "This is an aggressive bone cancer of young people and the fever it causes gets it mistaken for infection.",
    treatment: "Chemotherapy followed by surgical removal or radiotherapy of the affected segment.",
    takeaway: "Stacked onion skin layers on a moth eaten shaft in a young adult is Ewing sarcoma.",
    igTitle: "THE ONION BONE",
    igOptions: ["Chronic osteomyelitis", "Ewing sarcoma", "Bone cyst"],
    igCorrect: "B",
  },
  {
    diagnosis: "Osteoid osteoma",
    aliases: ["osteoid osteoma nidus", "night pain tumour"],
    symptom: "night pain in the shin for a year that vanished with a plain aspirin",
    hook: "a tiny dot of tumour had built a fortress of dense bone around itself",
    view: "AP tibia",
    keyFindings:
      "a small round lucent nidus under one centimetre in the cortex of the tibia surrounded by a thick dense collar of reactive sclerotic bone",
    whatYouSee: "A tiny round dark spot sits in the cortex ringed by a thick collar of dense white bone it built around itself.",
    whyItMatters: "The nidus pumps out prostaglandin which is why the pain comes at night and melts away with aspirin.",
    treatment: "Burning the nidus with a needle guided by imaging cures it and the pain stops almost at once.",
    takeaway: "Night pain relieved by aspirin with a tiny nidus in dense bone is an osteoid osteoma.",
    igTitle: "THE DOT THAT KEPT HIM AWAKE",
    igOptions: ["Stress fracture", "Bone abscess", "Osteoid osteoma"],
    igCorrect: "C",
  },
  {
    diagnosis: "Hyperparathyroidism",
    aliases: ["primary hyperparathyroidism", "subperiosteal resorption", "brown tumour"],
    symptom: "kidney stones aching bones and a mood that had gone flat",
    hook: "the edges of the finger bones were being nibbled away from the outside",
    view: "PA hand",
    keyFindings:
      "lacy erosion along the radial borders of the middle phalanges with loss of the terminal tufts and scattered well defined lucent brown tumours",
    whatYouSee: "The outer edges of the middle finger bones look nibbled and lacy and the very tips have started to disappear.",
    whyItMatters: "An overactive parathyroid gland is pulling calcium out of the skeleton and dumping it into the kidneys.",
    treatment: "Removing the overactive gland stops the bone loss and the skeleton slowly rebuilds.",
    takeaway: "Lacy erosion along the radial side of the middle phalanges is hyperparathyroidism.",
    igTitle: "THE NIBBLED FINGERS",
    igOptions: ["Hyperparathyroidism", "Rheumatoid arthritis", "Scleroderma"],
    igCorrect: "A",
  },
  {
    diagnosis: "Klippel-Feil syndrome",
    aliases: ["congenital cervical fusion", "Klippel Feil"],
    symptom: "a very short neck with a low hairline and a head that barely turned",
    hook: "several neck vertebrae had been fused into one solid block since birth",
    view: "AP cervical spine",
    keyFindings:
      "two or more cervical vertebrae fused into a single block of bone with absent disc spaces between them and a shortened narrowed neck",
    whatYouSee: "Several neck vertebrae have merged into one solid block of bone with no disc spaces left between them.",
    whyItMatters: "The fused segment throws all the movement onto the joints above and below which wear out early and can be unstable.",
    treatment: "Activity advice with surgery reserved for instability or nerve compression.",
    takeaway: "Neck vertebrae fused into a single block with a short neck is Klippel-Feil syndrome.",
    igTitle: "THE NECK CARVED FROM ONE BONE",
    igOptions: ["Old fracture healing", "Klippel-Feil syndrome", "Ankylosing spondylitis"],
    igCorrect: "B",
  },
  {
    diagnosis: "Spondylolisthesis",
    aliases: ["vertebral slip", "pars defect", "spondylolysis with slip"],
    symptom: "back pain that eased leaning forward and a step you could feel through the skin",
    hook: "one vertebra had slid forward off the one beneath it",
    view: "lateral lumbar spine with no pelvis or groin in frame",
    keyFindings:
      "forward displacement of one lumbar vertebral body over the one below producing a visible step in the posterior vertebral line with a defect in the pars",
    whatYouSee: "One vertebra has slipped forward off the one below so the neat back line of the spine steps out of place.",
    whyItMatters: "The slip narrows the canal where the nerves run which is why walking hurts and leaning forward brings relief.",
    treatment: "Core strengthening and activity change first with fusion surgery for a slip that keeps progressing.",
    takeaway: "A vertebra stepped forward off the one below it is spondylolisthesis.",
    igTitle: "THE SPINE THAT SLIPPED",
    igOptions: ["Spondylolisthesis", "Compression fracture", "Disc herniation"],
    igCorrect: "A",
  },
  {
    diagnosis: "Osteomalacia with Looser zones",
    aliases: ["Looser zones", "pseudofractures", "adult rickets", "Milkman fractures"],
    symptom: "aching bones and a waddling walk in an adult who never sees the sun",
    hook: "there were neat cracks running into the bone that were not fractures at all",
    view: "AP both forearms",
    keyFindings:
      "symmetric narrow lucent bands running perpendicular into the cortex of both forearm bones with sclerotic margins and no displacement",
    whatYouSee: "Narrow clean bands cut straight into the bone edges on both sides in exactly the same places and nothing is displaced.",
    whyItMatters: "Severe vitamin D deficiency leaves new bone soft and unmineralised so it cracks without ever properly breaking.",
    treatment: "Vitamin D and calcium replacement with a hunt for why it was deficient in the first place.",
    takeaway: "Symmetric lucent bands cutting into bone that never displace are Looser zones of osteomalacia.",
    igTitle: "THE CRACKS THAT NEVER BROKE",
    igOptions: ["Stress fractures", "Osteomalacia with Looser zones", "Bone metastases"],
    igCorrect: "B",
  },
  {
    diagnosis: "Pyknodysostosis",
    aliases: ["pycnodysostosis", "Toulouse-Lautrec syndrome"],
    symptom: "short stature with fingers that had shortened and bones that broke too easily",
    hook: "the bones were chalk dense yet the fingertips were dissolving away",
    view: "PA hand",
    keyFindings:
      "uniformly dense sclerotic hand bones with tapering destruction of the terminal phalangeal tufts so the fingertips appear whittled to points",
    whatYouSee: "Every bone in the hand is chalk white and dense yet the very fingertips look whittled down to points.",
    whyItMatters: "A missing enzyme stops old bone being cleared so the skeleton grows dense brittle and oddly fragile.",
    treatment: "No cure so care focuses on preventing and fixing the fractures these dense brittle bones keep sustaining.",
    takeaway: "Chalk dense bones with dissolving fingertips is pyknodysostosis.",
    igTitle: "THE CHALK HANDS",
    igOptions: ["Scleroderma", "Pyknodysostosis", "Osteopetrosis"],
    igCorrect: "B",
  },
];

const arr = JSON.parse(readFileSync(FILE, "utf8"));
const have = new Set(arr.map((c) => c.diagnosis.toLowerCase()));
let added = 0;
for (const c of NEW) {
  if (have.has(c.diagnosis.toLowerCase())) { console.log(`skip (present): ${c.diagnosis}`); continue; }
  const ix = "ABC".indexOf(c.igCorrect);
  const opt = c.igOptions[ix];
  const key = c.diagnosis.split(/[ -]/)[0].toLowerCase();
  const ok = opt.toLowerCase().includes(key);
  arr.push(c); added++;
  console.log(`added ${c.diagnosis.padEnd(34)} igCorrect ${c.igCorrect} -> "${opt}"${ok ? "" : "   <-- CHECK"}`);
}
writeFileSync(FILE, JSON.stringify(arr, null, 2) + "\n", "utf8");
console.log(`\npool: ${arr.length} (+${added})`);
