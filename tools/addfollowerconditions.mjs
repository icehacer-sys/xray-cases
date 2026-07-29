// One-off: append the follower-requested conditions (2026-07-27 audience poll) to the vetted pool.
// Only requests that produce a REAL finding on a plain radiograph are included; suggestions with
// no radiographic sign (porphyria, fatal familial insomnia, HLH, SSPE, nutcracker, palindromic
// rheumatism, Lesch-Nyhan, Dercum) and genital views (Peyronie) are deliberately excluded.
// Findings are chosen to be additive/expansile where possible so gpt-image-2 can actually render
// them and pass the anatomy gate. Prose follows the owner's no-comma house style.
//
// Run: node tools/addfollowerconditions.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/conditions.json";

const NEW = [
  {
    diagnosis: "Tracheo-oesophageal fistula",
    aliases: ["tracheoesophageal fistula", "oesophageal atresia", "esophageal atresia", "TOF", "TEF"],
    symptom: "a newborn who choked and turned blue with the very first feed",
    hook: "the feeding tube curled back on itself instead of reaching the stomach",
    view: "AP chest and upper abdomen of a newborn cropped above the pelvis",
    keyFindings:
      "a nasogastric tube coiled back on itself within a blind upper oesophageal pouch at the level of the upper chest with gas still present in the stomach below the diaphragm",
    whatYouSee:
      "A feeding tube loops back on itself in a blind pouch high in the chest yet there is still gas in the stomach below.",
    whyItMatters:
      "The gullet ends in a dead end while a second channel joins the windpipe to the stomach so milk can pour into the lungs.",
    treatment: "Surgery closes the abnormal connection and joins the two ends of the gullet.",
    takeaway: "A feeding tube that coils in the chest while the belly still has gas is a tracheo-oesophageal fistula.",
    igTitle: "THE TUBE THAT TURNED BACK",
    igOptions: ["Tube simply misplaced", "Tracheo-oesophageal fistula", "Hiatus hernia"],
    igCorrect: "B",
  },
  {
    diagnosis: "Ectrodactyly",
    aliases: ["split hand malformation", "split hand foot malformation", "lobster claw hand", "central ray deficiency"],
    symptom: "hands that had been shaped like claws since the day of birth",
    hook: "the middle of the hand was split into a deep V",
    view: "PA both hands",
    keyFindings:
      "a deep central V shaped cleft running into the palm with the central rays of the hand absent so the remaining digits are splayed apart to either side of the cleft",
    whatYouSee:
      "A deep V shaped cleft splits the hand where the middle fingers should be and the outer digits face each other across the gap.",
    whyItMatters:
      "The central rays of the hand never form in the womb so the hand divides into two halves and it often runs in families.",
    treatment: "Surgery can narrow the cleft and improve grip while hand therapy builds function.",
    takeaway: "A hand split down the middle with the central fingers missing is ectrodactyly.",
    igTitle: "THE SPLIT HAND",
    igOptions: ["Ectrodactyly", "Amputation injury", "Severe burn contracture"],
    igCorrect: "A",
  },
  {
    diagnosis: "Elephantiasis",
    aliases: ["lymphatic filariasis", "filarial elephantiasis", "chronic lymphoedema"],
    symptom: "a leg that had swollen year after year until the skin turned thick and hard",
    hook: "the soft tissue around the bone had swollen into something that no longer looked like a leg",
    view: "AP both lower legs cropped below the knee with no pelvis or groin in frame",
    keyFindings:
      "a grossly thickened coarse soft tissue envelope ballooning around the lower leg with preserved normal underlying bone and no bone destruction",
    whatYouSee:
      "A huge cuff of thickened soft tissue swallows the lower leg while the bone running through the middle of it stays completely normal.",
    whyItMatters:
      "Tiny worms spread by mosquitoes block the lymph channels so fluid and scar tissue pile up in the limb for years.",
    treatment: "Medication kills the worms while compression and careful skin hygiene control the swelling.",
    takeaway: "Massive soft tissue swelling wrapped around a perfectly normal bone is elephantiasis.",
    igTitle: "THE LEG THAT KEPT GROWING",
    igOptions: ["Bone tumour", "Chronic infection of the bone", "Elephantiasis"],
    igCorrect: "C",
  },
  {
    diagnosis: "Hypertrophic osteoarthropathy",
    aliases: ["HPOA", "hypertrophic pulmonary osteoarthropathy", "periosteal reaction of malignancy"],
    symptom: "deep aching in both shins with fingertips that had slowly widened over months",
    hook: "a second layer of bone had been laid down along both shins",
    view: "AP both lower legs",
    keyFindings:
      "smooth continuous periosteal new bone laid down along the shafts of both tibia and fibula so the cortex appears doubled with a thin lucent line between the layers",
    whatYouSee:
      "A smooth new layer of bone runs along the shafts of both shin bones so the outer cortex looks doubled.",
    whyItMatters:
      "This bone reaction is usually driven by a hidden tumour in the lung so an X-ray of the legs sends you straight to the chest.",
    treatment: "Treating the underlying lung tumour settles the bone pain and the periosteal reaction.",
    takeaway: "A doubled cortex along both shins with widened fingertips means go and hunt the lungs.",
    igTitle: "THE SECOND LAYER OF BONE",
    igOptions: ["Healing stress fractures", "Hypertrophic osteoarthropathy", "Chronic bone infection"],
    igCorrect: "B",
  },
  {
    diagnosis: "Haemophilic arthropathy",
    aliases: ["hemophilic arthropathy", "haemophilia joint disease", "hemophilia arthropathy", "bleeding disorder arthropathy"],
    symptom: "a young man whose knee had swollen with bleeds since he was a small child",
    hook: "the knee looked like it had been slowly eaten from the inside",
    view: "AP knee",
    keyFindings:
      "a widened and deepened intercondylar notch with squaring of the lower patella dense enlarged epiphyses and marked narrowing of the joint space",
    whatYouSee:
      "The notch between the knee condyles is widened and scooped out with a squared off kneecap and a badly worn joint space.",
    whyItMatters:
      "Blood leaks into the joint again and again and the iron in it eats the cartilage and reshapes the growing bone.",
    treatment: "Clotting factor replacement prevents further bleeds while a ruined joint may need replacing.",
    takeaway: "A widened scooped intercondylar notch with a squared patella is haemophilic arthropathy.",
    igTitle: "THE JOINT THAT KEPT BLEEDING",
    igOptions: ["Haemophilic arthropathy", "Septic arthritis", "Ordinary osteoarthritis"],
    igCorrect: "A",
  },
  {
    diagnosis: "Haemochromatosis arthropathy",
    aliases: ["hemochromatosis", "haemochromatosis", "iron overload arthropathy", "hook osteophytes"],
    symptom: "stiff aching knuckles in a man whose skin had turned a bronze colour",
    hook: "little hooks had grown off the sides of the knuckles",
    view: "PA hand",
    keyFindings:
      "hook shaped osteophytes projecting from the radial side of the second and third metacarpal heads with joint space narrowing and fine chondrocalcinosis in the wrist",
    whatYouSee:
      "Small hook shaped spurs curl off the knuckle heads of the index and middle fingers and those joints are narrowed.",
    whyItMatters:
      "The body absorbs and stores far too much iron which settles in the joints and quietly scars the liver and heart.",
    treatment: "Removing blood on a regular schedule drains the excess iron and protects the liver and heart.",
    takeaway: "Hooked spurs on the index and middle knuckles point straight at iron overload.",
    igTitle: "THE BRONZE HANDS",
    igOptions: ["Rheumatoid arthritis", "Psoriatic arthritis", "Haemochromatosis arthropathy"],
    igCorrect: "C",
  },
  {
    diagnosis: "Edwards syndrome",
    aliases: ["trisomy 18", "Edward syndrome", "trisomy eighteen"],
    symptom: "a newborn with fists that would not open and soles that curved outward",
    hook: "the fingers were locked in an overlapping grip that could not be straightened",
    view: "AP both hands of a newborn",
    keyFindings:
      "clenched newborn fists held in a fixed posture with the index finger overlapping the middle finger and the little finger overlapping the ring finger",
    whatYouSee:
      "Both newborn fists stay clenched with the index finger crossing over the middle one and the little finger crossing over the ring.",
    whyItMatters:
      "An extra copy of chromosome 18 affects the whole body and the heart and breathing problems are usually very severe.",
    treatment: "Care centres on comfort and feeding support along with treating the heart problems that can be helped.",
    takeaway: "Newborn fists locked in a crossed overlapping grip point to trisomy 18.",
    igTitle: "THE FISTS THAT WOULD NOT OPEN",
    igOptions: ["Arthrogryposis", "Edwards syndrome", "Birth injury to the nerves"],
    igCorrect: "B",
  },
  {
    diagnosis: "Situs inversus totalis",
    aliases: ["situs inversus", "mirrored organs", "total situs inversus"],
    symptom: "a routine chest X-ray taken before a small planned operation",
    hook: "the heart was sitting on the wrong side of the chest",
    view: "PA chest",
    keyFindings:
      "the cardiac apex pointing into the right hemithorax with the aortic arch on the right and the gastric air bubble sitting under the right hemidiaphragm",
    whatYouSee:
      "The heart points into the right side of the chest and the stomach gas bubble sits under the right half of the diaphragm.",
    whyItMatters:
      "Every organ is mirrored from left to right which is harmless by itself but it changes where a surgeon expects to find things.",
    treatment: "No treatment is needed but the mirrored anatomy must be flagged before any operation.",
    takeaway: "A heart pointing right with the stomach bubble on the right is situs inversus totalis.",
    igTitle: "THE MIRRORED BODY",
    igOptions: ["Situs inversus totalis", "Collapsed right lung pulling the heart", "Film printed back to front"],
    igCorrect: "A",
  },
];

const arr = JSON.parse(readFileSync(FILE, "utf8"));
const have = new Set(arr.map((c) => c.diagnosis.toLowerCase()));
let added = 0;
for (const c of NEW) {
  if (have.has(c.diagnosis.toLowerCase())) {
    console.log(`skip (already in pool): ${c.diagnosis}`);
    continue;
  }
  arr.push(c);
  added++;
  // sanity: the correct option must actually be present at the letter claimed
  const ix = "ABC".indexOf(c.igCorrect);
  const ok = c.igOptions[ix].toLowerCase().includes(c.diagnosis.split(" ")[0].toLowerCase());
  console.log(`added ${c.diagnosis}  (igCorrect ${c.igCorrect} -> "${c.igOptions[ix]}") ${ok ? "" : "  <-- CHECK"}`);
}
writeFileSync(FILE, JSON.stringify(arr, null, 2) + "\n", "utf8");
console.log(`\npool: ${arr.length} conditions (+${added})`);
