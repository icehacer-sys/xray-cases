// Render the three Instagram carousel slides (question / answer / cta) from a
// deterministic SVG template, then rasterize to PNG with @resvg/resvg-js. Image
// models garble slide text, so ONLY the X-ray is AI-generated — everything on the
// slides here is laid out by hand from the vetted Case/Condition fields. The look
// matches the @mdnoteslab account: near-black navy HUD, faint grid, a cyan scanner
// frame with corner brackets, orange tags/pills, clean white sans-serif text.

import { Resvg } from "@resvg/resvg-js";
import { config } from "./config.js";
import type { Case, Condition } from "./types.js";

// ---------------------------------------------------------------------------
// Palette + geometry
// ---------------------------------------------------------------------------

const SIZE = 1080; // logical SVG canvas (square); raster is scaled to config.slideSize
const MARGIN = 80; // outer text margin
const CONTENT = SIZE - MARGIN * 2; // usable inner width

const COL = {
  bg: "#070b16", // near-black navy
  grid: "#0f1a2e", // faint grid lines
  panel: "#0c1322", // slightly lighter card fill
  panelStroke: "#1c2740",
  cyan: "#22d3ee",
  orange: "#f59e0b",
  white: "#f8fafc",
  grey: "#7e8aa3",
  dark: "#0a0f1c", // text drawn on top of orange pills
};

const FONT =
  "Segoe UI, Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderSlides(
  c: Case,
  cond: Condition,
  xrayPng: Buffer,
): { question: Buffer; answer: Buffer; cta: Buffer } {
  const xrayHref = `data:image/png;base64,${xrayPng.toString("base64")}`;
  return {
    question: rasterize(questionSvg(c, cond, xrayHref)),
    answer: rasterize(answerSvg(c, cond, xrayHref)),
    cta: rasterize(ctaSvg()),
  };
}

/** Rasterize an SVG string to a PNG Buffer at config.slideSize px wide. */
function rasterize(svg: string): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: config.slideSize },
    font: { loadSystemFonts: true },
  });
  return Buffer.from(r.render().asPng());
}

// ---------------------------------------------------------------------------
// Slide: QUESTION
// ---------------------------------------------------------------------------

function questionSvg(c: Case, cond: Condition, xrayHref: string): string {
  const caseTag = `CASE FILE ${pad2(c.number)}`;
  const options = optionLines(cond);

  // Title (wrapped) sits under the tag; the X-ray frame is centered; options stack
  // below it; a "SWIPE TO REVEAL" pill anchors the bottom.
  const titleLines = wrap(cond.igTitle.toUpperCase(), 18);
  const titleFont = 60;
  const titleLh = 70;

  let y = 150;
  const parts: string[] = [];

  // Orange "CASE FILE NN" tag pill (top-left).
  parts.push(pill(MARGIN, y - 34, caseTag, 24, "left"));
  y += 24;

  // Bold white title.
  parts.push(textBlock(titleLines, MARGIN, y + titleFont, titleFont, titleLh, COL.white, 800));
  y += titleLines.length * titleLh + 26;

  // Cyan scanner frame holding the X-ray. Shrunk from 470 so a 2-line title (the
  // common case for this pool) plus three wrapped options and the bottom pill all
  // fit inside the 1080 canvas with margin to spare.
  const frameSize = 320;
  const frameX = (SIZE - frameSize) / 2;
  const frameY = y;
  parts.push(scannerFrame(frameX, frameY, frameSize, frameSize, xrayHref));
  // Tiny AI-generated tag under the frame (right-aligned to the frame edge).
  parts.push(
    text(
      frameX + frameSize,
      frameY + frameSize + 24,
      "AI-generated illustration",
      18,
      COL.grey,
      400,
      "end",
    ),
  );
  y = frameY + frameSize + 30;

  // Cyan prompt line.
  parts.push(text(SIZE / 2, y + 30, "WHAT IS THE DIAGNOSIS?", 36, COL.cyan, 700, "middle"));
  const optionsTop = y + 48;

  // The "SWIPE TO REVEAL" pill is anchored at a fixed bottom position; the option
  // block is laid out to END just above it. Bottom-anchoring (rather than letting the
  // options run top-down into the pill) guarantees no overlap and a clean bottom edge
  // regardless of how tall the title/options wrap. Measure each option's height first.
  const optFont = 30;
  const optLh = 38;
  const optGap = 16; // space between consecutive options
  const optHeights = options.map((opt) => {
    const lines = wrap(opt.text, 34);
    return { lines, h: Math.max(54, lines.length * optLh + 12) };
  });
  const optionsBlockH =
    optHeights.reduce((sum, o) => sum + o.h, 0) + optGap * (optHeights.length - 1);

  const pillTop = SIZE - 96; // fixed home, matching the established design
  // Start the block so its last option ends ~28px above the pill; never start it
  // higher than optionsTop (a short title leaves a larger, harmless gap below the
  // prompt line instead).
  let optY = Math.max(optionsTop, pillTop - 28 - optionsBlockH);
  optHeights.forEach((o, i) => {
    const cy = optY + 22;
    parts.push(circledLetter(MARGIN + 26, cy, options[i].letter));
    parts.push(textBlock(o.lines, MARGIN + 72, optY + 32, optFont, optLh, COL.white, 500));
    optY += o.h + optGap;
  });

  // Bottom "SWIPE TO REVEAL" pill, centered.
  parts.push(pill(SIZE / 2, pillTop, "SWIPE TO REVEAL", 28, "center"));

  return svgDoc(parts.join("\n"));
}

// ---------------------------------------------------------------------------
// Slide: ANSWER
// ---------------------------------------------------------------------------

function answerSvg(c: Case, cond: Condition, xrayHref: string): string {
  const parts: string[] = [];
  let y = 96;

  // Wordmark + cyan ANSWER tab on the same header row.
  parts.push(text(MARGIN, y, "WEIRD X-RAY CASE FILES", 30, COL.white, 800, "start"));
  parts.push(pill(SIZE - MARGIN, y - 26, "ANSWER", 24, "right"));
  y += 34;

  // Tighter X-ray in a cyan frame (right side), correct-answer box (left side).
  const frameSize = 300;
  const frameX = SIZE - MARGIN - frameSize;
  const frameY = y;
  parts.push(scannerFrame(frameX, frameY, frameSize, frameSize, xrayHref));
  parts.push(
    text(
      frameX + frameSize,
      frameY + frameSize + 24,
      "AI-generated illustration",
      16,
      COL.grey,
      400,
      "end",
    ),
  );

  // Correct-answer card to the left of the X-ray.
  const boxW = frameX - MARGIN - 30;
  const answerText = `Correct answer: ${cond.igCorrect}. ${c.diagnosis}`;
  const ansLines = wrap(answerText, 22);
  const boxH = ansLines.length * 40 + 48;
  parts.push(roundRect(MARGIN, frameY, boxW, boxH, COL.panel, COL.cyan, 2));
  parts.push(
    textBlock(ansLines, MARGIN + 26, frameY + 50, 32, 40, COL.white, 700, boxW - 52),
  );

  // Resume the breakdown below whichever of the X-ray frame or the answer card is
  // taller, so a long (multi-line) diagnosis box never overlaps the WHAT YOU SEE
  // heading.
  const boxBottom = frameY + boxH;
  y = Math.max(frameY + frameSize, boxBottom) + 56;

  // Breakdown sections: alternating cyan / orange headings + wrapped body lines.
  // Body is sized down (22/28, wrap 78 — the original 64@26 physical line width) and
  // the gaps are tuned so all four sections plus the footer fit above SIZE-56 even
  // with the longest vetted facts in the pool. headGap (heading -> its own body) is
  // kept smaller than trailGap (body -> next heading) so each heading groups visually
  // with the paragraph it introduces rather than orphaning onto the previous one.
  const bodyLh = 28;
  const headGap = 32; // baseline advance from a heading to its first body line
  const trailGap = 26; // gap from a body's last line to the next heading
  const sections: Array<{ color: string; head: string; body: string }> = [
    { color: COL.cyan, head: "WHAT YOU SEE", body: cond.whatYouSee },
    { color: COL.orange, head: "WHY IT MATTERS", body: cond.whyItMatters },
    { color: COL.cyan, head: "WHAT DOCTORS LOOK FOR", body: cond.treatment },
    { color: COL.orange, head: "SIMPLE TAKEAWAY", body: cond.takeaway },
  ];

  for (const s of sections) {
    parts.push(text(MARGIN, y, s.head, 26, s.color, 800, "start"));
    y += headGap;
    const bodyLines = wrap(s.body, 78);
    parts.push(textBlock(bodyLines, MARGIN, y, 22, bodyLh, COL.white, 400, CONTENT));
    y += (bodyLines.length - 1) * bodyLh + trailGap;
  }

  // Grey footer disclaimer.
  parts.push(
    text(
      SIZE / 2,
      SIZE - 56,
      "Educational entertainment only. Not medical advice.",
      22,
      COL.grey,
      400,
      "middle",
    ),
  );

  return svgDoc(parts.join("\n"));
}

// ---------------------------------------------------------------------------
// Slide: CTA (no X-ray)
// ---------------------------------------------------------------------------

function ctaSvg(): string {
  const parts: string[] = [];
  const cx = SIZE / 2;

  // Centered wordmark.
  parts.push(text(cx, 380, "WEIRD X-RAY CASE FILES", 38, COL.white, 800, "middle"));

  // Bold headline.
  parts.push(text(cx, 480, "A NEW CASE EVERY DAY", 72, COL.white, 900, "middle"));

  // Orange "FOLLOW FOR MORE" pill, centered.
  parts.push(pill(cx, 560, "FOLLOW FOR MORE", 34, "center"));

  // Sub-line.
  parts.push(text(cx, 700, "Can you think like a doctor?", 34, COL.cyan, 600, "middle"));

  // Grey footer disclaimer.
  parts.push(
    text(
      cx,
      SIZE - 56,
      "Educational entertainment only. Not medical advice.",
      22,
      COL.grey,
      400,
      "middle",
    ),
  );

  return svgDoc(parts.join("\n"));
}

// ---------------------------------------------------------------------------
// SVG document scaffold: navy background + faint grid + everything else
// ---------------------------------------------------------------------------

function svgDoc(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M60 0 L0 0 0 60" fill="none" stroke="${COL.grid}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${COL.bg}"/>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#grid)"/>
  <rect x="20" y="20" width="${SIZE - 40}" height="${SIZE - 40}" fill="none" stroke="${COL.panelStroke}" stroke-width="2" rx="22"/>
${body}
</svg>`;
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/** A cyan rounded scanner frame with corner brackets enclosing the X-ray image. */
function scannerFrame(x: number, y: number, w: number, h: number, href: string): string {
  const pad = 14;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const clipId = `frameclip-${Math.round(x)}-${Math.round(y)}`;
  const b = 36; // corner-bracket arm length
  const bracket = (px: number, py: number, dx: number, dy: number) =>
    `<path d="M ${px + dx * b} ${py} L ${px} ${py} L ${px} ${py + dy * b}" fill="none" stroke="${COL.cyan}" stroke-width="6" stroke-linecap="round"/>`;

  return [
    `<clipPath id="${clipId}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="10"/></clipPath>`,
    `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="10" fill="#000000"/>`,
    `<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" href="${href}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="${COL.cyan}" stroke-width="3"/>`,
    bracket(x + 6, y + 6, 1, 1),
    bracket(x + w - 6, y + 6, -1, 1),
    bracket(x + 6, y + h - 6, 1, -1),
    bracket(x + w - 6, y + h - 6, -1, -1),
  ].join("\n");
}

/** Orange circled capital letter (option marker). */
function circledLetter(cx: number, cy: number, letter: string): string {
  return [
    `<circle cx="${cx}" cy="${cy}" r="24" fill="${COL.orange}"/>`,
    `<text x="${cx}" y="${cy}" font-family="${FONT}" font-size="28" font-weight="800" fill="${COL.dark}" text-anchor="middle" dominant-baseline="central">${esc(letter)}</text>`,
  ].join("\n");
}

/**
 * An orange pill with dark text. `align` controls how (x, y) is interpreted:
 * "left" = x is the left edge, "right" = x is the right edge, "center" = x is the
 * horizontal center. y is the pill top.
 */
function pill(x: number, y: number, label: string, fontSize: number, align: "left" | "right" | "center"): string {
  const padX = 22;
  const h = fontSize + 24;
  const w = approxTextWidth(label, fontSize) + padX * 2;
  let left: number;
  if (align === "left") left = x;
  else if (align === "right") left = x - w;
  else left = x - w / 2;
  const cx = left + w / 2;
  const cy = y + h / 2;
  return [
    `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${COL.orange}"/>`,
    `<text x="${cx}" y="${cy}" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="${COL.dark}" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${esc(label)}</text>`,
  ].join("\n");
}

function roundRect(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

/** A single line of text. (x, y) is the text baseline anchor per `anchor`. */
function text(
  x: number,
  y: number,
  s: string,
  fontSize: number,
  fill: string,
  weight: number,
  anchor: "start" | "middle" | "end" = "start",
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

/**
 * A stack of pre-wrapped lines starting at baseline (x, firstBaselineY), advancing
 * by `lineHeight`. Optionally pre-wraps to `maxWidthPx` (when the caller passes raw
 * single-element lines that may still overflow).
 */
function textBlock(
  lines: string[],
  x: number,
  firstBaselineY: number,
  fontSize: number,
  lineHeight: number,
  fill: string,
  weight: number,
  _maxWidthPx?: number,
): string {
  return lines
    .map((line, i) => text(x, firstBaselineY + i * lineHeight, line, fontSize, fill, weight, "start"))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

interface Option {
  letter: "A" | "B" | "C";
  text: string;
}

function optionLines(cond: Condition): Option[] {
  const letters: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  return cond.igOptions.map((opt, i) => ({ letter: letters[i], text: opt }));
}

/** Two-digit zero-padded case number. */
function pad2(n?: number): string {
  return String(n ?? 1).padStart(2, "0");
}

/**
 * Greedy word-wrap to at most `maxChars` characters per line. Long single words
 * that exceed maxChars are hard-split so nothing overflows the margins.
 */
function wrap(s: string, maxChars: number): string[] {
  const words = String(s ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (w.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let rest = w;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      line = rest;
      continue;
    }
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Rough text width estimate (px) for pill sizing — ~0.6em per char average. */
function approxTextWidth(s: string, fontSize: number): number {
  return s.length * fontSize * 0.62;
}

/** Escape the five XML-significant characters so the SVG stays well-formed. */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
