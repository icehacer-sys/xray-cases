// One-off: Facebook page art for "Weird X-Ray Case Files".
// Profile picture (square, circle-safe icon) + a simple modern bold cover banner.
// Cover is generated 1536x1024 then center-cropped to a Facebook banner ratio.
// Run from xray-poster root: npx tsx src/fbassets.ts
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateSlideImage } from "./openai.js";

const profilePrompt = `Design a bold modern logo icon for a faceless medical X-ray page called Weird X-Ray Case Files.
It will be shown as a small CIRCULAR profile picture so put the whole design in the CENTER and keep the four corners empty and dark.
Deep near-black navy background (#0a0f1e).
In the exact center a single striking human SKULL rendered like a clean glowing X-ray in bright electric cyan (#22d3ee) with a soft cyan glow. Simple bold and instantly readable even when tiny. Not gory. Just the bright bones on navy.
A thin bold cyan ring runs near the edge as a circular border.
Use ONLY cyan and navy. NO orange and no other colors. No dots and no extra accent shapes anywhere.
Modern minimal high-contrast flat design. NO text and no letters anywhere.`;

const coverPrompt = `Design a SIMPLE MODERN and BOLD Facebook cover banner for a page called Weird X-Ray Case Files. Wide banner.
Deep near-black navy background (#0a0f1e) with a very subtle darker grid.
CRITICAL LAYOUT: a round profile picture will later sit over the CENTER-BOTTOM of this banner, so the entire MIDDLE of the banner must stay EMPTY dark navy. Push the text to the FAR LEFT and the skull to the FAR RIGHT with a big clear empty navy gap between them in the center.
FAR LEFT third, aligned to the left edge with a small margin: a big bold modern CONDENSED title on three tight lines "WEIRD" then "X-RAY" then "CASE FILES" in clean white, with the word "X-RAY" filled bright electric cyan (#22d3ee). Directly under it one short line in cyan "Can you guess what is hiding inside?". Keep ALL of this text inside the left third and away from the center.
FAR RIGHT third: one striking human SKULL rendered like a clean glowing cyan X-ray on the navy with a soft glow, pushed toward the right edge.
A single thin cyan EKG heartbeat line crossing the middle horizontally. One small orange (#f59e0b) radiation-symbol accent near the right edge.
The whole CENTER column stays clean and empty navy. Modern minimal and uncluttered with strong contrast.
CRITICAL: render every letter crisply and CORRECTLY SPELLED exactly as written, no extra or missing or misspelled words.`;

const only = process.argv[2]; // "profile" | "cover" | undefined (both)

if (!only || only === "profile") {
  process.stdout.write("gen profile (1024x1024) ... ");
  const profile = await generateSlideImage(profilePrompt, undefined, "1024x1024");
  writeFileSync("D:/Downloads/fb-profile.png", profile);
  console.log(`ok ${(profile.length / 1024).toFixed(0)} KB`);
}

if (!only || only === "cover") {
  process.stdout.write("gen cover (1536x1024) ... ");
  const coverFull = await generateSlideImage(coverPrompt, undefined, "1536x1024");
  writeFileSync("D:/Downloads/fb-cover-full.png", coverFull);
  // center-crop to a Facebook cover ratio (1536x576 = 2.67:1) keeping the central band
  await sharp(coverFull).extract({ left: 0, top: 224, width: 1536, height: 576 }).toFile("D:/Downloads/fb-cover.png");
  console.log(`ok ${(coverFull.length / 1024).toFixed(0)} KB -> cropped to 1536x576`);
}

console.log("done");
