// One-off: refill the exhausted condition pool (2026-09-23). The topup had been failing with
// "no source-reviewed fresh conditions left" and the queue was down to one ready case.
// Every entry is a real plain-film finding with checked sources. Findings are additive (a mass,
// calcification or an expanded bone) so the image model can render them, framing avoids the
// pelvis and groin, and there are no dental cases or swallowed objects (both underperform or
// are excluded). Array order is post order, so body regions alternate.
//
// Run: node tools/addbatch4.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/conditions.json";
const REVIEWED = "2026-09-23";

const NEW = [
  {
    diagnosis: "Faecaloma",
    aliases: ["fecaloma", "giant faecaloma", "giant fecaloma", "faecal impaction", "fecal impaction", "impacted stool"],
    symptom: "a belly that had been swelling for weeks with vomiting and no bowel movement for months in a man on long term medication that slows the gut",
    captionSymptom: "a belly that kept getting bigger and tighter for weeks",
    hook: "something the size of a watermelon had packed the belly from side to side",
    view: "AP abdomen from the diaphragm to the iliac crests with the pelvis and groin cropped out",
    ageBand: "middle-aged",
    keyFindings:
      "a huge rounded mottled mass of impacted stool speckled with tiny bubbles of trapped gas filling most of the abdomen inside a massively dilated colon that pushes the other bowel loops aside with very little normal bowel gas elsewhere",
    whatYouSee: "A giant mottled mass fills most of the belly inside a hugely stretched colon and pushes everything else aside.",
    whyItMatters: "Severely impacted stool can block the bowel and press on the colon wall. Ulceration and perforation of the stretched colon are serious risks.",
    treatment: "Smaller impactions are usually treated with enemas and manual disimpaction. A giant mass that blocks the bowel may need surgery.",
    takeaway: "A huge mottled mass inside a stretched colon in a chronically constipated patient points to a faecaloma.",
    igTitle: "THE WATERMELON IN THE BELLY",
    igOptions: ["Faecaloma", "Giant ovarian cyst", "Sigmoid volvulus"],
    igCorrect: "A",
    sources: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC7144756/",
      "https://radiopaedia.org/articles/faecaloma",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC13218709/",
    ],
  },
  {
    diagnosis: "Aspergilloma",
    aliases: ["pulmonary aspergilloma", "fungus ball", "fungal ball", "aspergillus fungus ball"],
    symptom: "coughing up streaks of blood years after being treated for tuberculosis",
    captionSymptom: "a cough that kept bringing up streaks of blood",
    hook: "a round ball sat loose inside a hollow in the lung like a pearl in an open shell",
    view: "PA chest",
    ageBand: "middle-aged",
    keyFindings:
      "a thin walled cavity in the right upper lobe containing a smooth round soft tissue ball with a thin crescent of air curving over the top of the ball between it and the cavity wall and mild surrounding upper lobe scarring",
    whatYouSee: "A round ball sits inside a hollow in the upper lung with a thin crescent of air curving over its top.",
    whyItMatters: "Aspergillus fungus can grow into a ball inside an old lung cavity. It can erode nearby vessels and cause serious bleeding.",
    treatment: "Stable cases without symptoms may simply be watched. Significant bleeding may need embolisation or surgical removal.",
    takeaway: "A ball inside an old lung cavity with an air crescent over it suggests an aspergilloma.",
    igTitle: "THE BALL IN THE LUNG",
    igOptions: ["Aspergilloma", "Lung abscess", "Cavitating lung cancer"],
    igCorrect: "A",
    sources: [
      "https://radiopaedia.org/articles/aspergilloma",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC3714090/",
    ],
  },
  {
    diagnosis: "Porocephalosis",
    aliases: ["pentastomiasis", "Armillifer infection", "Armillifer armillatus", "armillifer armillatus infection", "tongue worm infection"],
    symptom: "vague upper belly discomfort in an adult who grew up eating bushmeat in West Africa",
    captionSymptom: "vague upper belly discomfort",
    hook: "dozens of tiny crescent moons were scattered through the upper belly",
    view: "AP upper abdomen from the lower chest to the iliac crests with the pelvis cropped out",
    ageBand: "middle-aged",
    keyFindings:
      "dozens of small dense C shaped and comma shaped calcifications each a few millimetres long scattered over the liver and spleen and across the upper abdomen with otherwise normal bowel gas and bones",
    whatYouSee: "Dozens of tiny curled calcifications shaped like commas and crescents are scattered over the liver and upper belly.",
    whyItMatters: "These are dead calcified larvae of a tongue worm usually caught from undercooked snake meat. Most people never have symptoms.",
    treatment: "Calcified larvae usually need no treatment. Rare complications may need surgery.",
    takeaway: "Many small C shaped calcifications in the upper abdomen suggest old Armillifer infection.",
    igTitle: "THE CRESCENT MOONS",
    igOptions: ["Porocephalosis", "Cysticercosis", "Phleboliths"],
    igCorrect: "A",
    sources: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6519502/",
      "https://pubmed.ncbi.nlm.nih.gov/8868383/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC3647675/",
    ],
  },
  {
    diagnosis: "Sturge-Weber syndrome",
    aliases: ["Sturge Weber syndrome", "Sturge-Weber disease", "encephalotrigeminal angiomatosis"],
    symptom: "seizures since early childhood in a child with a port wine birthmark over one side of the face",
    captionSymptom: "seizures since early childhood",
    hook: "wavy double lines ran across the back of the brain like tram tracks",
    view: "lateral skull radiograph",
    ageBand: "child",
    keyFindings:
      "curving parallel double lines of calcification following the folds of the brain surface in the parietal and occipital region like pairs of wavy tram tracks with a normal skull vault and face",
    whatYouSee: "Wavy pairs of parallel calcified lines follow the folds of the brain surface at the back of the head.",
    whyItMatters: "Abnormal vessels over the brain surface lead to calcification of the cortex beneath them. It often comes with seizures and a facial port wine birthmark.",
    treatment: "Care focuses on seizure control and eye checks for glaucoma. Laser treatment can lighten the birthmark.",
    takeaway: "Gyriform tram track calcification at the back of the brain is the classic skull film sign of Sturge-Weber syndrome.",
    igTitle: "THE TRAM TRACKS IN THE BRAIN",
    igOptions: ["Sturge-Weber syndrome", "Tuberous sclerosis", "Cysticercosis"],
    igCorrect: "A",
    sources: [
      "https://radiopaedia.org/articles/sturge-weber-syndrome",
      "https://pubs.rsna.org/doi/10.1148/radiol.2312020545",
    ],
  },
  {
    diagnosis: "Limy bile",
    aliases: ["limey bile", "milk of calcium bile", "limy bile syndrome"],
    symptom: "months of right upper belly pain after fatty meals",
    hook: "the gallbladder looked as if someone had filled it with white paint",
    view: "AP upper abdomen centred on the right upper quadrant with the pelvis cropped out",
    ageBand: "middle-aged",
    keyFindings:
      "a pear shaped gallbladder under the right lower ribs uniformly filled with dense white material as bright as bone with a smooth outline and otherwise normal bowel gas and bones",
    whatYouSee: "The gallbladder under the right ribs is completely filled with dense white material as bright as bone.",
    whyItMatters: "Thick calcium rich bile can collect when the gallbladder outlet is blocked. Gallstones are present in most patients.",
    treatment: "Symptomatic cases are usually treated by removing the gallbladder. This is often done laparoscopically.",
    takeaway: "A gallbladder that is white on a plain film without contrast suggests limy bile.",
    igTitle: "THE GALLBLADDER FULL OF CHALK",
    igOptions: ["Limy bile", "Porcelain gallbladder", "Retained contrast"],
    igCorrect: "A",
    sources: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6664229/",
      "https://pubmed.ncbi.nlm.nih.gov/16173993/",
      "https://www.eurorad.org/case/10441",
    ],
  },
  {
    diagnosis: "Tuberculous dactylitis",
    aliases: ["spina ventosa", "tubercular dactylitis", "TB dactylitis"],
    symptom: "a swollen finger that had slowly been getting bigger for months in a young child",
    captionSymptom: "a swollen finger that kept getting bigger for months",
    hook: "one finger bone had puffed up from inside like a balloon",
    view: "PA hand of a child",
    ageBand: "child",
    anatomyException:
      "One proximal phalanx is legitimately EXPANDED into a ballooned bone with a thinned cortex and a lucent interior. That expansion IS the diagnosis. Every other bone keeps its normal size and shape and the growth plates stay open.",
    keyFindings:
      "the proximal phalanx of the middle finger expanded into a ballooned spindle shape with a lucent interior and a thinned bony shell surrounded by spindle shaped soft tissue swelling while the other fingers and metacarpals look normal",
    whatYouSee: "One finger bone has swollen into a balloon with a thin shell and a hollow looking centre.",
    whyItMatters: "Tuberculosis can spread through the blood into the short bones of the hand in children. It may be the first sign of infection elsewhere in the body.",
    treatment: "Treatment is a prolonged course of antituberculous medication. Surgery may be considered for selected complications.",
    takeaway: "A ballooned finger bone in a child should raise the possibility of spina ventosa.",
    igTitle: "THE BALLOON FINGER",
    igOptions: ["Tuberculous dactylitis", "Enchondroma", "Sickle cell dactylitis"],
    igCorrect: "A",
    sources: [
      "https://radiopaedia.org/articles/tuberculous-dactylitis",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC4913200/",
    ],
  },
  {
    diagnosis: "Calcified fibrothorax",
    aliases: ["fibrothorax", "calcified empyema", "chronic tuberculous empyema", "tuberculous fibrothorax"],
    symptom: "breathlessness that had slowly worsened for years decades after a chest infection treated as tuberculosis",
    captionSymptom: "breathlessness that had slowly worsened for years",
    hook: "one lung was sealed inside a thick shell of stone",
    view: "PA chest",
    ageBand: "older",
    keyFindings:
      "a thick continuous rind of dense calcification wrapping around the outer surface of the left lung like a shell with a shrunken left hemithorax and crowded left ribs while the right lung is normal",
    whatYouSee: "A thick shell of calcium wraps around one whole lung and that side of the chest has shrunk.",
    whyItMatters: "Old pleural infection such as tuberculous empyema can leave a thick calcified peel that traps the lung. This restricts breathing on that side.",
    treatment: "Management targets the underlying cause and any active infection. Surgical decortication is sometimes considered for selected patients.",
    takeaway: "A one sided calcified shell around the lung is a classic late sign of old tuberculous pleural disease.",
    igTitle: "THE LUNG IN A STONE SHELL",
    igOptions: ["Calcified fibrothorax", "Asbestos pleural plaques", "Mesothelioma"],
    igCorrect: "A",
    sources: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6296679/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC11161697/",
      "https://radiopaedia.org/cases/tuberculous-empyema-chronic",
    ],
  },
];

const pool = JSON.parse(readFileSync(FILE, "utf8"));
const have = new Set(pool.map((c) => c.diagnosis.toLowerCase()));
let added = 0;
for (const c of NEW) {
  if (have.has(c.diagnosis.toLowerCase())) {
    console.log(`skip (already present): ${c.diagnosis}`);
    continue;
  }
  pool.push({
    ...c,
    reviewedAt: REVIEWED,
    requiredObservations: [
      c.keyFindings,
      `The visible anatomy matches the requested ${c.view} and the declared age and anatomical exceptions.`,
    ],
  });
  added++;
}
writeFileSync(FILE, JSON.stringify(pool, null, 2) + "\n");
console.log(`added ${added} condition(s); pool now ${pool.length}`);
