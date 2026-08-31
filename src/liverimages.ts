// One-off (favor for Ruth's hepatitis webinar): grossly enlarged fatty livers + a
// portal-hypertension-consequences illustration, via gpt-image-2. These are AI-rendered
// TEACHING ILLUSTRATIONS, not real specimens. Run from xray-poster root:
//   npx tsx src/liverimages.ts
import { writeFileSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const NOTEXT = " Do NOT add any text, labels, arrows, rulers, scale bars or watermark.";

const jobs = [
  {
    id: "liver-fatty-1",
    size: "1024x1024",
    file: "D:/Downloads/liver-fatty-1.png",
    prompt:
      "Realistic medical gross-pathology illustration of a GROSSLY ENLARGED FATTY LIVER (severe hepatic steatosis, the MASLD and MASH spectrum). " +
      "The liver is markedly enlarged and swollen, pale yellow-tan, greasy and soft, with rounded bulging edges instead of a sharp thin margin. " +
      "Realistic glistening moist surface with subtle surface vessels. Anatomically correct with a large right lobe, a smaller left lobe and the gallbladder tucked underneath. " +
      "Presented as a single isolated organ on a clean plain neutral grey background with soft studio medical lighting." +
      NOTEXT,
  },
  {
    id: "liver-fatty-2",
    size: "1024x1024",
    file: "D:/Downloads/liver-fatty-2.png",
    prompt:
      "Realistic medical illustration of a GROSSLY ENLARGED FATTY LIVER (severe hepatic steatosis, MASLD/MASH) seen IN SITU inside the upper abdomen. " +
      "The enlarged pale yellow-tan greasy liver fills the right upper abdomen and bulges well BELOW the rib margin (hepatomegaly), its edges rounded. " +
      "Show the lower ribcage and abdominal wall framing it for scale. Clean educational anatomical illustration, accurate anatomy, muted clinical colors, soft lighting." +
      NOTEXT,
  },
  {
    id: "portal-htn-1",
    size: "1536x1024",
    file: "D:/Downloads/portal-htn-1.png",
    prompt:
      "Realistic educational medical anatomical illustration demonstrating the CONSEQUENCES OF PORTAL HYPERTENSION in a human torso and abdomen, front view. " +
      "The cirrhotic liver must be SMALL, SHRUNKEN and shriveled — clearly TOO SMALL for the body, knobby and nodular, retracted high up under the right rib margin, obviously undersized compared with a normal liver. " +
      "Contrast that tiny liver with a MASSIVELY ENLARGED SPLEEN (splenomegaly) on the left and a hugely swollen fluid-filled ascitic belly, so the shrunken liver looks dwarfed. " +
      "Also show ESOPHAGEAL VARICES as dilated tortuous veins around the lower esophagus and stomach, and a prominent CAPUT MEDUSAE of engorged blue veins radiating from the navel across the distended abdominal wall. " +
      "Clean medical illustration style, anatomically accurate, muted clinical colors, soft even lighting. Leave it clean so labels can be added later." +
      NOTEXT,
  },
  {
    id: "portal-htn-2",
    size: "1536x1024",
    file: "D:/Downloads/portal-htn-2.png",
    prompt:
      "Realistic educational medical illustration of PORTAL HYPERTENSION, front view of a torso, emphasizing a SHRUNKEN CIRRHOTIC LIVER and the porto-systemic collaterals. " +
      "The cirrhotic liver is SMALL, shriveled and knobby, obviously undersized and pulled up high under the right rib cage — clearly much smaller than a healthy liver. " +
      "Around it: a very ENLARGED SPLEEN, dilated ESOPHAGEAL VARICES at the lower esophagus, a striking CAPUT MEDUSAE of tortuous blue veins spreading from the umbilicus, and a tensely swollen ASCITIC abdomen. " +
      "Emphasize the size mismatch: tiny liver, big spleen, huge belly. Clean anatomical illustration, muted clinical palette, accurate." +
      NOTEXT,
  },
];

const only = process.argv[2];
for (const j of jobs) {
  if (only && !j.id.includes(only)) continue;
  process.stdout.write(`gen ${j.id} (${j.size}) ... `);
  try {
    const buf = await generateSlideImage(j.prompt, undefined, j.size);
    writeFileSync(j.file, buf);
    console.log(`ok ${(buf.length / 1024).toFixed(0)} KB -> ${j.file}`);
  } catch (e: any) {
    console.log("FAIL:", e?.message ?? e);
  }
}
console.log("done");
