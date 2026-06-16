// Render the three Instagram carousel slides (question / answer / cta) from a
// deterministic SVG template, then rasterize to PNG with @resvg/resvg-js. Image
// models garble slide text, so ONLY the X-ray is AI-generated — everything on the
// slides here is laid out by hand from the vetted Case/Condition fields.
//
// Design language ("Lightbox Clinical"): a deep near-black panel with a soft
// gradient, the X-ray spotlit on a subtle glow inside a thin precise frame, one
// confident cyan accent for the quiz, amber reserved for the answer reveal, and a
// clean type hierarchy. No busy grid, no heavy pills — restraint is the point.

import { Resvg } from "@resvg/resvg-js";
import { config } from "./config.js";
import type { Case, Condition } from "./types.js";

// ---------------------------------------------------------------------------
// Palette + geometry
// ---------------------------------------------------------------------------

const SIZE = 1080; // logical SVG canvas (square); raster is scaled to config.slideSize
const MARGIN = 72; // outer text margin
const CONTENT = SIZE - MARGIN * 2; // usable inner width

const COL = {
  bgTop: "#0b1019", // gradient top
  bgBot: "#05070d", // gradient bottom
  panel: "#0e1626", // card fill
  panelLine: "#1d2942", // card / hairline stroke
  ink: "#f5f8fc", // primary text
  sub: "#9aa7bd", // secondary text
  faint: "#5b6886", // disclaimers / least-important
  accent: "#2dd4ef", // primary cyan (quiz)
  amber: "#fbbf24", // answer reveal accent
  onAmber: "#1a1204", // text on amber fill
  imgBg: "#02040a", // behind the X-ray
};

const FONT =
  "Segoe UI, Inter, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";

const HANDLE = "@mdnoteslab";

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
  const parts: string[] = [];

  // Header: wordmark (left) + case number (right) + hairline.
  parts.push(text(MARGIN, 96, "WEIRD X-RAY CASE FILES", 26, COL.ink, 800, "start", 3));
  parts.push(text(SIZE - MARGIN, 96, `CASE ${pad2(c.number)}`, 26, COL.accent, 800, "end", 2));
  parts.push(divider(MARGIN, SIZE - MARGIN, 122, COL.panelLine));

  // Hook title (the igTitle), capped at 2 lines so the layout never overflows.
  const titleFont = 54;
  const titleLh = 62;
  const titleLines = wrap(cond.igTitle.toUpperCase(), 17).slice(0, 2);
  const titleBaseline = 192;
  parts.push(textBlock(titleLines, MARGIN, titleBaseline, titleFont, titleLh, COL.ink, 800));
  const titleBottom = titleBaseline + (titleLines.length - 1) * titleLh + 10;

  // X-ray hero, spotlit and centered.
  const frame = 372;
  const frameTop = titleBottom + 26;
  parts.push(xrayPanel(SIZE / 2, frameTop, frame, xrayHref, true));
  const imgBottom = frameTop + frame;

  // Quiz prompt.
  const promptY = imgBottom + 64;
  parts.push(text(SIZE / 2, promptY, "WHAT'S THE DIAGNOSIS?", 34, COL.accent, 800, "middle", 2));

  // Options, bottom-anchored just above the swipe cue so wrapping never collides.
  const cueTop = SIZE - 122;
  const optFont = 28;
  const optLh = 36;
  const chip = 46;
  const rowGap = 14;
  const options = optionLines(cond);
  const measured = options.map((o) => {
    const lines = wrap(o.text, 30);
    return { lines, h: Math.max(chip, lines.length * optLh + 8) };
  });
  const blockH =
    measured.reduce((s, m) => s + m.h, 0) + rowGap * (measured.length - 1);
  let oy = Math.max(promptY + 34, cueTop - 30 - blockH);
  measured.forEach((m, i) => {
    parts.push(letterChip(MARGIN, oy, chip, options[i].letter));
    const textTop = oy + (m.h - (m.lines.length - 1) * optLh) / 2 + optFont / 2 - 4;
    parts.push(textBlock(m.lines, MARGIN + chip + 22, textTop, optFont, optLh, COL.ink, 600));
    oy += m.h + rowGap;
  });

  // Swipe cue.
  parts.push(swipeCue(SIZE / 2, cueTop));

  return svgDoc(parts.join("\n"), { cx: SIZE / 2, cy: frameTop + frame / 2 });
}

// ---------------------------------------------------------------------------
// Slide: ANSWER
// ---------------------------------------------------------------------------

function answerSvg(c: Case, cond: Condition, xrayHref: string): string {
  const parts: string[] = [];

  // Header: wordmark + amber ANSWER tag + hairline.
  parts.push(text(MARGIN, 96, "WEIRD X-RAY CASE FILES", 26, COL.ink, 800, "start", 3));
  parts.push(filledPill(SIZE - MARGIN, 70, "ANSWER", 24, "right", COL.amber, COL.onAmber));
  parts.push(divider(MARGIN, SIZE - MARGIN, 122, COL.panelLine));

  // Hero answer card: big diagnosis on the left, X-ray thumbnail on the right.
  const cardY = 146;
  const cardH = 212;
  parts.push(panel(MARGIN, cardY, CONTENT, cardH, COL.panel, COL.panelLine, 2, 20));

  const thumb = 168;
  const thumbX = MARGIN + CONTENT - 24 - thumb;
  const thumbY = cardY + (cardH - thumb) / 2;
  parts.push(xrayPanel(thumbX + thumb / 2, thumbY, thumb, xrayHref, false));

  const leftX = MARGIN + 32;
  const leftW = thumbX - 24 - leftX;
  parts.push(text(leftX, cardY + 52, "DIAGNOSIS", 22, COL.amber, 800, "start", 3));
  const dxFont = 44;
  const dxLh = 50;
  const dxLines = wrap(c.diagnosis, Math.max(10, Math.floor(leftW / (dxFont * 0.6)))).slice(0, 2);
  parts.push(textBlock(dxLines, leftX, cardY + 104, dxFont, dxLh, COL.ink, 800, leftW));
  parts.push(
    text(leftX, cardY + cardH - 34, `Correct answer: ${cond.igCorrect}`, 24, COL.sub, 600, "start"),
  );

  // Breakdown: four vetted sections with accent headings + readable body.
  let y = cardY + cardH + 50;
  const bodyFont = 23;
  const bodyLh = 31;
  const headGap = 34;
  const trailGap = 28;
  const sections: Array<{ color: string; head: string; body: string }> = [
    { color: COL.accent, head: "WHAT YOU SEE", body: cond.whatYouSee },
    { color: COL.amber, head: "WHY IT MATTERS", body: cond.whyItMatters },
    { color: COL.accent, head: "WHAT DOCTORS LOOK FOR", body: cond.treatment },
    { color: COL.amber, head: "SIMPLE TAKEAWAY", body: cond.takeaway },
  ];
  for (const s of sections) {
    parts.push(`<rect x="${MARGIN}" y="${y - 18}" width="6" height="22" rx="3" fill="${s.color}"/>`);
    parts.push(text(MARGIN + 20, y, s.head, 24, s.color, 800, "start", 1));
    y += headGap;
    const lines = wrap(s.body, 76);
    parts.push(textBlock(lines, MARGIN, y, bodyFont, bodyLh, COL.ink, 400, CONTENT));
    y += (lines.length - 1) * bodyLh + trailGap;
  }

  // Footer disclaimer + handle.
  parts.push(text(SIZE / 2, SIZE - 50, "Educational entertainment only. Not medical advice.", 22, COL.faint, 400, "middle"));

  return svgDoc(parts.join("\n"), { cx: thumbX + thumb / 2, cy: thumbY + thumb / 2 });
}

// ---------------------------------------------------------------------------
// Slide: CTA (no X-ray)
// ---------------------------------------------------------------------------

function ctaSvg(): string {
  const parts: string[] = [];
  const cx = SIZE / 2;

  parts.push(text(cx, 312, "WEIRD X-RAY CASE FILES", 30, COL.sub, 800, "middle", 4));

  parts.push(text(cx, 452, "A NEW CASE", 80, COL.ink, 900, "middle", 1));
  parts.push(text(cx, 548, "EVERY DAY", 80, COL.accent, 900, "middle", 1));

  // Short accent rule.
  parts.push(`<rect x="${cx - 48}" y="592" width="96" height="5" rx="2.5" fill="${COL.amber}"/>`);

  parts.push(text(cx, 678, "Can you think like a doctor?", 32, COL.sub, 500, "middle"));

  parts.push(outlinePill(cx, 728, `FOLLOW ${HANDLE}`, 30, COL.accent));

  parts.push(text(cx, SIZE - 50, "Educational entertainment only. Not medical advice.", 22, COL.faint, 400, "middle"));

  return svgDoc(parts.join("\n"), { cx, cy: 500 });
}

// ---------------------------------------------------------------------------
// SVG document scaffold: gradient background + soft spotlight + thin keyline
// ---------------------------------------------------------------------------

function svgDoc(body: string, glow?: { cx: number; cy: number }): string {
  const spotlight = glow
    ? `<ellipse cx="${glow.cx}" cy="${glow.cy}" rx="520" ry="520" fill="url(#glow)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${COL.bgTop}"/>
      <stop offset="1" stop-color="${COL.bgBot}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${COL.accent}" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="${COL.accent}" stop-opacity="0.05"/>
      <stop offset="1" stop-color="${COL.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  ${spotlight}
  <rect x="22" y="22" width="${SIZE - 44}" height="${SIZE - 44}" fill="none" stroke="${COL.panelLine}" stroke-width="1.5" rx="26"/>
${body}
</svg>`;
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/** The X-ray on a soft glow inside a thin cyan frame with small corner ticks. */
function xrayPanel(cx: number, topY: number, size: number, href: string, withGlow: boolean): string {
  const x = cx - size / 2;
  const y = topY;
  const rx = 16;
  const clip = `xc${Math.round(x)}-${Math.round(y)}`;
  const parts: string[] = [];
  if (withGlow) {
    parts.push(`<ellipse cx="${cx}" cy="${y + size / 2}" rx="${size * 0.74}" ry="${size * 0.74}" fill="url(#glow)"/>`);
  }
  parts.push(`<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}"/></clipPath>`);
  parts.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="${COL.imgBg}"/>`);
  parts.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="${href}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`);
  parts.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="none" stroke="${COL.accent}" stroke-width="2" stroke-opacity="0.55"/>`);
  const arm = size > 250 ? 26 : 18;
  const off = 13;
  const sw = 3;
  const tick = (px: number, py: number, dx: number, dy: number) =>
    `<path d="M ${px + dx * arm} ${py} L ${px} ${py} L ${px} ${py + dy * arm}" fill="none" stroke="${COL.accent}" stroke-width="${sw}" stroke-linecap="round"/>`;
  parts.push(tick(x + off, y + off, 1, 1));
  parts.push(tick(x + size - off, y + off, -1, 1));
  parts.push(tick(x + off, y + size - off, 1, -1));
  parts.push(tick(x + size - off, y + size - off, -1, -1));
  return parts.join("\n");
}

/** Outlined rounded-square letter marker (A/B/C). (x, y) is the top-left. */
function letterChip(x: number, y: number, size: number, letter: string): string {
  return [
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="12" fill="none" stroke="${COL.accent}" stroke-width="2"/>`,
    `<text x="${x + size / 2}" y="${y + size / 2}" font-family="${FONT}" font-size="${Math.round(size * 0.5)}" font-weight="800" fill="${COL.accent}" text-anchor="middle" dominant-baseline="central">${esc(letter)}</text>`,
  ].join("\n");
}

/** Outlined pill (cue / follow button). (cx, top) = center-x, top edge. */
function outlinePill(cx: number, top: number, label: string, fontSize: number, color: string): string {
  const padX = 30;
  const h = fontSize + 30;
  const w = approxTextWidth(label, fontSize) + padX * 2;
  const left = cx - w / 2;
  return [
    `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${color}" stroke-width="2"/>`,
    `<text x="${cx}" y="${top + h / 2}" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="${color}" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${esc(label)}</text>`,
  ].join("\n");
}

/** Outlined cue pill with a solid triangle arrow: "SWIPE TO REVEAL >". */
function swipeCue(cx: number, top: number): string {
  const label = "SWIPE TO REVEAL";
  const fs = 26;
  const padX = 30;
  const arrow = 26;
  const tw = approxTextWidth(label, fs) + fs * 0.4; // includes letter-spacing slack
  const w = tw + padX * 2 + arrow;
  const h = fs + 30;
  const left = cx - w / 2;
  const cy = top + h / 2;
  const textCx = left + padX + tw / 2;
  const ax = left + padX + tw + 16;
  return [
    `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${COL.accent}" stroke-width="2"/>`,
    `<text x="${textCx}" y="${cy}" font-family="${FONT}" font-size="${fs}" font-weight="800" fill="${COL.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="2">${esc(label)}</text>`,
    `<path d="M ${ax} ${cy - 8} L ${ax + 13} ${cy} L ${ax} ${cy + 8} Z" fill="${COL.accent}"/>`,
  ].join("\n");
}

/** A solid-color pill with contrasting text (used for the amber ANSWER tag). */
function filledPill(x: number, y: number, label: string, fontSize: number, align: "left" | "right" | "center", fill: string, textColor: string): string {
  const padX = 22;
  const h = fontSize + 22;
  const w = approxTextWidth(label, fontSize) + padX * 2;
  let left: number;
  if (align === "left") left = x;
  else if (align === "right") left = x - w;
  else left = x - w / 2;
  return [
    `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>`,
    `<text x="${left + w / 2}" y="${y + h / 2}" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="${textColor}" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${esc(label)}</text>`,
  ].join("\n");
}

function panel(x: number, y: number, w: number, h: number, fill: string, stroke: string, sw: number, rx: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function divider(x1: number, x2: number, y: number, color: string): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`;
}

/** A single line of text. (x, y) is the baseline anchor per `anchor`. */
function text(
  x: number,
  y: number,
  s: string,
  fontSize: number,
  fill: string,
  weight: number,
  anchor: "start" | "middle" | "end" = "start",
  letterSpacing = 0,
): string {
  const ls = letterSpacing ? ` letter-spacing="${letterSpacing}"` : "";
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${esc(s)}</text>`;
}

/** A stack of pre-wrapped lines from baseline (x, firstBaselineY), advancing by lineHeight. */
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
