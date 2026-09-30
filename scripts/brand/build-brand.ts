/**
 * Builds the master brand SVGs in public/brand/ (§18.2).
 * The mark is geometric (circles + straight lines). Wordmarks are real glyph
 * outlines shaped by HarfBuzz from IBM Plex Sans Arabic Bold / Inter SemiBold,
 * with the brand tweaks: taller alif in إيجاري, short flat final ي tail, and a
 * tiny arch replacing the dot of the i in "Ejari".
 *
 *   pnpm tsx scripts/brand/build-brand.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as hb from "harfbuzzjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "public/brand");
const FONTS = path.join(import.meta.dirname, "fonts");
mkdirSync(OUT, { recursive: true });

const INK = "#0E0F12";
const SAND = "#C9A66B";

// ---------------------------------------------------------------- mark
/** Mark geometry in a 64×64 box: arch with an alif-shaped door slot, hamza below the threshold. */
export const MARK = {
  arch: "M14 50V24a18 18 0 0 1 36 0v26h-14.5V23.5a3.5 3.5 0 0 0-7 0V50z",
  slot: "M28.5 50V23.5a3.5 3.5 0 0 1 7 0V50z",
  hamza: { cx: 32, cy: 57.5, r: 3 },
  // inner opening height (clear-space unit) = 50 - 20 = 30 of 64
};

function markGroup(fill: string) {
  return `<path d="${MARK.arch}" fill="${fill}"/><circle cx="${MARK.hamza.cx}" cy="${MARK.hamza.cy}" r="${MARK.hamza.r}" fill="${fill}"/>`;
}

// ---------------------------------------------------------------- glyph outlines
type Cmd = { c: string; p: number[] };

function parsePath(d: string): Cmd[] {
  const out: Cmd[] = [];
  const re = /([MLQCZ])([^MLQCZ]*)/gi;
  for (const m of d.matchAll(re)) {
    const nums = (m[2] ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
    out.push({ c: m[1]!.toUpperCase(), p: nums });
  }
  return out;
}

function mapPath(cmds: Cmd[], f: (x: number, y: number) => [number, number]): Cmd[] {
  return cmds.map(({ c, p }) => {
    const q: number[] = [];
    for (let i = 0; i < p.length; i += 2) q.push(...f(p[i]!, p[i + 1]!));
    return { c, p: q };
  });
}

function toD(cmds: Cmd[]): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return cmds.map(({ c, p }) => c + p.map(r).join(" ")).join("");
}

function bounds(cmds: Cmd[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const { p } of cmds)
    for (let i = 0; i < p.length; i += 2) {
      minX = Math.min(minX, p[i]!);
      maxX = Math.max(maxX, p[i]!);
      minY = Math.min(minY, p[i + 1]!);
      maxY = Math.max(maxY, p[i + 1]!);
    }
  return { minX, minY, maxX, maxY };
}

interface Shaped {
  cmds: Cmd[]; // font units, y-up, laid out left→right in visual order
  upem: number;
}

function shape(
  fontFile: string,
  text: string,
  opts: {
    variations?: Record<string, number>;
    features?: string[];
    tracking?: number;
    tweak?: (gid: number, cluster: number, cmds: Cmd[], index: number) => Cmd[];
  } = {},
): Shaped & { glyphBounds: ReturnType<typeof bounds>[] } {
  const blob = new hb.Blob(readFileSync(path.join(FONTS, fontFile)));
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  if (opts.variations) font.setVariations(Object.entries(opts.variations).map(([tag, value]) => new hb.Variation(tag, value)));
  const upem = face.upem;
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer, (opts.features ?? []).map((f) => hb.Feature.fromString(f)!).filter(Boolean));
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  let x = 0;
  const all: Cmd[] = [];
  const glyphBounds: ReturnType<typeof bounds>[] = [];
  infos.forEach((g, i) => {
    const pos = positions[i]!;
    let cmds = parsePath(font.glyphToPath(g.codepoint));
    if (opts.tweak) cmds = opts.tweak(g.codepoint, g.cluster, cmds, i);
    const ox = x + pos.xOffset;
    const oy = pos.yOffset;
    const placed = mapPath(cmds, (px, py) => [px + ox, py + oy]);
    glyphBounds.push(bounds(placed));
    all.push(...placed);
    x += pos.xAdvance + (opts.tracking ?? 0) * upem;
  });
  return { cmds: all, upem, glyphBounds };
}

/** Normalizes shaped outlines to SVG coords (y-down) with baseline at `baseline`, scaled to `capHeight` px per upem. */
function place(s: Shaped, scale: number, dx: number, baseline: number): { d: string; w: number; top: number; bottom: number } {
  const b = bounds(s.cmds);
  const cmds = mapPath(s.cmds, (x, y) => [(x - b.minX) * scale + dx, baseline - y * scale]);
  return { d: toD(cmds), w: (b.maxX - b.minX) * scale, top: baseline - b.maxY * scale, bottom: baseline - b.minY * scale };
}

// Arabic: إيجاري — alif taller (+12 %), final ي descender flattened.
const arabic = shape("IBMPlexSansArabic-Bold.ttf", "إيجاري", {
  tweak: (_gid, cluster, cmds) => {
    // cluster 0 = إ (alif with hamza below). Stretch the stem upward only.
    if (cluster === 0) return mapPath(cmds, (x, y) => [x, y > 0 ? y * 1.12 : y]);
    // last cluster = final ي: compress everything below the baseline to a short flat tail.
    if (cluster >= 10) return mapPath(cmds, (x, y) => [x, y < 0 ? y * 0.55 : y]);
    return cmds;
  },
});

// English: Ejar + dotless ı, Inter SemiBold, tracking −2 %.
const english = shape("Inter.ttf", "Ejarı", { variations: { wght: 600, opsz: 32 }, tracking: -0.02 });

// ---------------------------------------------------------------- compose
function svg(w: number, h: number, body: string, extra = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}" width="${round(w)}" height="${round(h)}"${extra}>${body}</svg>\n`;
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}

const markTag = (x: number, y: number, s: number, fill: string) =>
  `<g transform="translate(${round(x)} ${round(y)}) scale(${round(s)})">${markGroup(fill)}</g>`;

// Wordmark sizes: x-height/cap tuned so Arabic and English feel equal next to the 64px mark.
const arScale = 44 / arabic.upem; // Arabic body ~44px per em
const enScale = 44 / english.upem;
const baseline = 50; // aligned with the mark threshold

const ar = place(arabic, arScale, 0, baseline);
const en = place(english, enScale, 0, baseline);

// tiny arch replacing the dot of ı: stem-wide, sitting where Inter's i-dot sits.
const enBounds = bounds(english.cmds);
const dotless = english.glyphBounds.at(-1)!;
const stemW = (dotless.maxX - dotless.minX) * enScale;
const archCx = ((dotless.minX + dotless.maxX) / 2 - enBounds.minX) * enScale;
const xHeightTop = baseline - dotless.maxY * enScale;
const archW = stemW * 1.08;
const archH = archW * 1.25;
const archTop = xHeightTop - archH - stemW * 0.62;
const tinyArch = (cx: number, top: number, fill: string) => {
  const r = archW / 2;
  return `<path d="M${round(cx - r)} ${round(top + archH)}V${round(top + r)}a${round(r)} ${round(r)} 0 0 1 ${round(archW)} 0V${round(top + archH)}z" fill="${fill}"/>`;
};

function wordmarkAr(fill: string) {
  return { body: `<path d="${ar.d}" fill="${fill}"/>`, w: ar.w, top: ar.top, bottom: ar.bottom };
}
function wordmarkEn(fill: string) {
  return { body: `<path d="${en.d}" fill="${fill}"/>${tinyArch(archCx, archTop, fill)}`, w: en.w, top: Math.min(en.top, archTop), bottom: en.bottom };
}

const files: Record<string, string> = {};

files["mark.svg"] = svg(64, 64, markGroup(INK));
files["mark-mono.svg"] = svg(64, 64, markGroup("currentColor"));
files["mark-white.svg"] = svg(64, 64, markGroup("#FFFFFF"));

{
  const a = wordmarkAr(INK);
  const pad = 2;
  files["wordmark-ar.svg"] = svg(a.w + pad * 2, a.bottom - a.top + pad * 2, `<g transform="translate(${pad} ${round(pad - a.top)})">${a.body}</g>`);
  const e = wordmarkEn(INK);
  files["wordmark-en.svg"] = svg(e.w + pad * 2, e.bottom - e.top + pad * 2, `<g transform="translate(${pad} ${round(pad - e.top)})">${e.body}</g>`);
}

// Arabic lockup: mark on the RIGHT.
function lockupAr(fill: string) {
  const a = wordmarkAr(fill);
  const gap = 14;
  const top = Math.min(0, a.top);
  const bottom = Math.max(64, a.bottom);
  const w = a.w + gap + 64;
  return svg(w, bottom - top, `<g transform="translate(0 ${round(-top)})">${a.body}${markTag(a.w + gap, 0, 1, fill)}</g>`);
}
// English lockup: mark on the LEFT.
function lockupEn(fill: string) {
  const e = wordmarkEn(fill);
  const gap = 12;
  const top = Math.min(0, e.top);
  const bottom = Math.max(64, e.bottom);
  const w = 64 + gap + e.w;
  return svg(w, bottom - top, `<g transform="translate(0 ${round(-top)})">${markTag(0, 0, 1, fill)}<g transform="translate(${64 + gap} 0)">${e.body}</g></g>`);
}
// Bilingual stacked: mark, إيجاري above Ijari.
function lockupBi(fill: string, sub = fill) {
  const a = wordmarkAr(fill);
  const e = wordmarkEn(sub);
  const eS = 0.62;
  const markS = 1.5;
  const markW = 64 * markS;
  const w = Math.max(a.w, e.w * eS, markW) + 16;
  const yA = markW + 8;
  const yE = yA + (a.bottom - a.top) + 10;
  const h = yE + (e.bottom - e.top) * eS + 4;
  return svg(
    w,
    h,
    markTag((w - markW) / 2, 0, markS, fill) +
      `<g transform="translate(${round((w - a.w) / 2)} ${round(yA - a.top)})">${a.body}</g>` +
      `<g transform="translate(${round((w - e.w * eS) / 2)} ${round(yE - e.top * eS)}) scale(${eS})">${e.body}</g>`,
  );
}

files["lockup-ar.svg"] = lockupAr(INK);
files["lockup-en.svg"] = lockupEn(INK);
files["lockup-ar-white.svg"] = lockupAr("#FFFFFF");
files["lockup-en-white.svg"] = lockupEn("#FFFFFF");
files["lockup-bilingual.svg"] = lockupBi(INK);
files["lockup-bilingual-white.svg"] = lockupBi("#FFFFFF");

// App icon master (1024): ink squircle, white mark ≈ 58 % width, warm light in the door slot.
function appIcon(size: number, markRatio: number, rounded: boolean) {
  const s = (size * markRatio) / 36; // arch is 36 units wide
  const mx = size / 2 - 32 * s;
  const my = size / 2 - 33 * s;
  const r = rounded ? size * 0.2237 : 0;
  return svg(
    size,
    size,
    `<defs><radialGradient id="dusk" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="#2A2530"/><stop offset="1" stop-color="${INK}"/></radialGradient>` +
      `<linearGradient id="light" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${SAND}" stop-opacity=".95"/><stop offset=".55" stop-color="#E9C98F" stop-opacity=".45"/><stop offset="1" stop-color="#FFF4DE" stop-opacity=".08"/></linearGradient></defs>` +
      `<rect width="${size}" height="${size}" rx="${round(r)}" fill="url(#dusk)"/>` +
      `<g transform="translate(${round(mx)} ${round(my)}) scale(${round(s)})"><path d="${MARK.slot}" fill="url(#light)"/>${markGroup("#FFFFFF")}</g>`,
  );
}
files["app-icon.svg"] = appIcon(1024, 0.58, true);
files["app-icon-square.svg"] = appIcon(1024, 0.58, false);
files["app-icon-maskable.svg"] = appIcon(1024, 0.46, false); // mark within the 80 % safe zone

// Favicon that adapts to dark mode.
files["icon.svg"] = svg(
  64,
  64,
  `<style>path,circle{fill:${INK}}@media (prefers-color-scheme:dark){path,circle{fill:#F5F5F7}}</style>${markGroup(INK)}`,
);

// Arch pattern tile (mashrabiya feel) — used ≤ 4 % opacity.
files["arch-pattern.svg"] = svg(
  48,
  56,
  `<g fill="none" stroke="${INK}" stroke-width="1.2"><path d="M4 52V22a20 20 0 0 1 40 0v30"/><path d="M16 52V26a8 8 0 0 1 16 0v26"/><circle cx="24" cy="8" r="2"/></g>`,
);

for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), content);
}
console.log(`brand: wrote ${Object.keys(files).length} SVGs to public/brand`);
