// Designed DESCRIPTION panels for The Case File Club Gumroad listing — 3 portrait poster images
// (1024x1536) in the forensic case-file style, telling the story: Hook -> What You Get -> The Deal.
// Text2img via gpt-image-2 (same look as the book howto/closing pages). Resumable.
// Run: npx tsx src/clubdescription.ts [1|2|3|all]
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const DIR = "D:/Projects/xray-poster/products/case-file-club";
mkdirSync(DIR, { recursive: true });
const PORTRAIT = "1024x1536";

const STYLE =
  "A premium portrait panel styled like a forensic 'case file' / medical HUD. Near-black deep navy " +
  "background with a faint blueprint grid and a very faint ghosted skull X-ray watermark. Accent " +
  "palette: electric cyan (#22d3ee) and bold orange (#f59e0b) on dark navy, with white text. TITLES " +
  "use a BIG bold DISTRESSED CONDENSED grunge poster font (worn, stencilled, thriller-title feel). " +
  "Body text is a clean modern sans-serif. A thin cyan EKG heartbeat line as a top accent. Keep the " +
  "SAME template on every panel. CRITICAL: render all text crisply and CORRECTLY SPELLED exactly as " +
  "written, with no extra, missing, or misspelled words. Do not add any words that are not specified.";

const panels: { name: string; prompt: string }[] = [
  {
    name: "desc-1",
    prompt:
      `${STYLE}\nLAYOUT (panel 1 of 3, "the hook"): top-left a small orange folder icon with ` +
      `"WEIRD X-RAY CASE FILES" in bold orange caps; top-right a small cyan tab "PART 01 OF 03". ` +
      `A HUGE distressed white grunge title stacked on two lines: "THIS IS" / "FOR YOU". Below it, three ` +
      `short white lines each on its own row with generous spacing:\n` +
      `"One weird X-ray a day is not enough for some of you."\n` +
      `"I know. You are in my comments every single night."\n` +
      `Then one bold cyan line: "The Case File Club is where the obsessed hang out." ` +
      `A tiny grey footer: "Educational entertainment only. Not medical advice.".`,
  },
  {
    name: "desc-2",
    prompt:
      `${STYLE}\nLAYOUT (panel 2 of 3, "what you get"): top-left orange caps "WEIRD X-RAY CASE FILES" ` +
      `and a thin cyan EKG line; top-right a small cyan tab "PART 02 OF 03". A big distressed white ` +
      `grunge heading: "WHAT YOU GET". Then FIVE rows, each a cyan line icon then one short bold white ` +
      `line inside a dark rounded card with a thin cyan edge, evenly spaced:\n` +
      `(lock icon) "A bonus case every week. Members only."\n` +
      `(stacked documents icon) "A monthly Vault Drop PDF to keep."\n` +
      `(archive drawer icon) "Instant access to 135+ past cases."\n` +
      `(eye icon) "First look before the daily case goes live."\n` +
      `(chat bubble icon) "The Guessing Room members chat."\n` +
      `A tiny grey footer: "Educational entertainment only. Not medical advice.".`,
  },
  {
    name: "desc-3",
    prompt:
      `${STYLE}\nLAYOUT (panel 3 of 3, "the deal"): top-left orange caps "WEIRD X-RAY CASE FILES"; ` +
      `top-right a small cyan tab "PART 03 OF 03". A big distressed white grunge title stacked two lines: ` +
      `"THE WHOLE" / "DEAL". Below it, short white lines each on its own row:\n` +
      `"I am a senior med student."\n` +
      `"Every membership funds my USMLE. Step 1 then 2 then 3."\n` +
      `"You get more of what you love. I get to keep making it."\n` +
      `Then a HUGE bold cyan line: "Guess along with us." Then in bold cyan the handle "@mdnoteslab". ` +
      `A tiny grey footer: "Educational entertainment only. Not medical advice.".`,
  },
];

const only = process.argv[2] ?? "all";
for (const p of panels) {
  if (only !== "all" && !p.name.endsWith(only)) continue;
  const out = `${DIR}/${p.name}.png`;
  if (existsSync(out) && only === "all") { console.log(`= ${p.name} exists, skipping`); continue; }
  try {
    writeFileSync(out, await generateSlideImage(p.prompt, undefined, PORTRAIT));
    console.log(`[+] ${p.name}`);
  } catch (e) {
    console.log(`! ${p.name} failed: ${e instanceof Error ? e.message : e}`);
  }
}
console.log("done");
