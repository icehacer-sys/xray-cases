// Discord welcome cover for "The Case File Club" server — one landscape gpt-image-2 image
// (1536x1024) in the same forensic case-file brand style as the Gumroad listing, meant to sit
// under the pinned welcome message in #announcements.
// Run: npx tsx src/discordcover.ts
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { generateSlideImage } from "./openai.js";

const DIR = "D:/Projects/xray-poster/products/case-file-club";
mkdirSync(DIR, { recursive: true });
const LANDSCAPE = "1536x1024";

const STYLE =
  "A premium landscape panel styled like a forensic 'case file' / medical HUD. Near-black deep navy " +
  "background with a faint blueprint grid and a very faint ghosted skull X-ray watermark. Accent " +
  "palette: electric cyan (#22d3ee) and bold orange (#f59e0b) on dark navy, with white text. TITLES " +
  "use a BIG bold DISTRESSED CONDENSED grunge poster font (worn, stencilled, thriller-title feel). " +
  "Body text is a clean modern sans-serif. A thin cyan EKG heartbeat line as a top accent. CRITICAL: " +
  "render all text crisply and CORRECTLY SPELLED exactly as written, no extra, missing, or misspelled words.";

const prompt =
  `${STYLE}\nLAYOUT (Discord welcome banner, 3:2 landscape): top-left a small orange folder icon with ` +
  `"THE CASE FILE CLUB" in bold orange caps; top-right a small cyan tab "MEMBERS ONLY". LEFT half a HUGE ` +
  `distressed white grunge title stacked two lines: "YOU FOUND" / "THE ROOM". Under it a cyan subtitle on ` +
  `its own row, using ONLY periods between clauses and NO commas anywhere: "Guess along. Argue diagnoses. ` +
  `Hang with Mr. M." RIGHT half a fanned stack of several X-ray case file ` +
  `cards in cyan HUD scanner frames overlapping like a deck (grayscale X-rays: a skull, a chest, a jaw). ` +
  `Bottom bar: bold cyan "@mdnoteslab" and a tiny grey footer "Educational entertainment only. Not medical advice.".`;

async function main(): Promise<void> {
  const out = `${DIR}/discord-welcome-cover.png`;
  if (existsSync(out)) {
    console.log(`= discord-welcome-cover exists, skipping`);
    return;
  }
  try {
    writeFileSync(out, await generateSlideImage(prompt, undefined, LANDSCAPE));
    console.log(`[+] wrote ${out}`);
  } catch (e) {
    console.log(`! failed: ${e instanceof Error ? e.message : e}`);
  }
}
await main();
