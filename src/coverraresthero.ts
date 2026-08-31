// One-off: redesign the Rarest Findings landscape cover so the VANISHING BONE X-ray is the single
// hero image (was a 3-up: ribbon ribs / vanishing bone / hollowed hand). Edits FROM the existing
// landscape cover so gpt-image-2 reuses the REAL vanishing-bone femur already in it (the femur with
// the dark dissolved-out gap) rather than generating that anatomy from scratch, which it renders
// poorly. Output overwrites the landscape cover; the 3-up is kept as *-3up-backup.png.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { requireEnv, config } from "./config.js";

// Edit FROM the v1 single-hero (good composition) to fix: too-dark background, femur floating in a
// black void, and a distal end drawn like a second hip instead of a knee.
const REF = "D:/Downloads/covers-redesign/landscape/rarest-findings-hero-v1.png";
const OUT = "D:/Downloads/covers-redesign/landscape/rarest-findings.png";

const prompt = `Improve this existing single-hero product cover. Keep the same layout and brand style \
but make three specific changes.

CHANGE 1 — BRIGHTER BACKGROUND: the background is currently almost pure black and reads too dark \
next to the rest of the cover series. Lift it to a LIGHTER charcoal / slate-navy medical-dossier \
tone (a clearly visible mid-dark blue-grey, not near-black), keeping the faint blueprint grid, \
ghosted skeleton and classified-archive annotations. Overall the image should be noticeably \
brighter and less murky.

CHANGE 2 — BIGGER HERO X-RAY: the femur X-ray currently floats in a large black void inside its \
frame. ENLARGE the X-ray so it nearly fills the cyan HUD scanner frame with only a thin margin.

CHANGE 3 — FIX THE FEMUR ANATOMY: the bone must read as ONE correct femur (thigh bone). At the TOP, \
the proximal femur: a rounded femoral head, the angled neck, and the greater trochanter beside it. \
A long straight shaft in the middle. At the BOTTOM, the distal femur that WIDENS into the two \
rounded condyles of the KNEE joint. Right now the bottom end is wrongly drawn as a second rounded \
hip/ball — replace it with a proper knee (two condyles). The vanishing-bone finding stays a dark \
hollowed-out gap in the MID-SHAFT where the bone has dissolved away.

Keep everything else exactly: the silver grunge "RAREST FINDINGS" title, orange "WEIRD X-RAY CASE \
FILES" badge, cyan "10 OF THE RAREST CASES IN RADIOLOGY" subtitle, orange "EXTREMELY RARE" stamp, \
the cyan "VANISHING BONE" label plate under the frame, the red "1 IN A MILLION" stamp, the corner \
brackets, ruler ticks, "R"/"L" markers, "kV 75 / mAs 4.0" readout, "XR-01" tag, the cyan \
"@mdnoteslab" handle and the tiny grey "Educational entertainment only. Not medical advice.". \
Render every word crisply and spelled EXACTLY as written. Still only ONE X-ray of a single femur.`;

async function main(): Promise<void> {
  const ref = await sharp(REF).png().toBuffer();
  const form = new FormData();
  form.append("model", config.imageModel);
  form.append("prompt", prompt);
  form.append("size", "1536x1024");
  form.append("quality", "high");
  form.append("n", "1");
  form.append("image", new Blob([new Uint8Array(ref)], { type: "image/png" }), "ref.png");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
    body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI edits ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`no image: ${JSON.stringify(json).slice(0, 300)}`);
  writeFileSync(OUT, Buffer.from(b64, "base64"));
  console.log(`wrote ${OUT} (${Math.round(Buffer.from(b64, "base64").length / 1024)}KB)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
