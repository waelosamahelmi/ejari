/**
 * Generates every icon / splash / photo size from the master SVGs and photos (§18.6, §19.1).
 *
 *   pnpm brand:assets
 *
 * Inputs:  public/brand/*.svg (built by scripts/brand/build-brand.ts), brand-src/photos/*.jpg
 * Outputs: src/app/{favicon.ico,icon.svg,apple-icon.png}, public/icons/*, public/splash/*,
 *          public/brand/photos/*, src/config/generated-assets.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND = path.join(ROOT, "public/brand");
const ICONS = path.join(ROOT, "public/icons");
const SPLASH = path.join(ROOT, "public/splash");
const PHOTOS_OUT = path.join(ROOT, "public/brand/photos");
const PHOTOS_SRC = path.join(ROOT, "brand-src/photos");
for (const d of [ICONS, SPLASH, PHOTOS_OUT]) mkdirSync(d, { recursive: true });

const INK = "#0E0F12";

const svgBuf = (file: string) => readFileSync(path.join(BRAND, file));

async function png(input: Buffer, size: number, out: string) {
  await sharp(input, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
}

/** Minimal ICO writer with embedded PNGs. */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach((p, i) => {
    const o = i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(p.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

async function icons() {
  const app = svgBuf("app-icon.svg");
  const square = svgBuf("app-icon-square.svg");
  const maskable = svgBuf("app-icon-maskable.svg");
  await png(square, 192, path.join(ICONS, "icon-192.png"));
  await png(square, 512, path.join(ICONS, "icon-512.png"));
  await png(maskable, 192, path.join(ICONS, "maskable-192.png"));
  await png(maskable, 512, path.join(ICONS, "maskable-512.png"));
  await png(app, 1024, path.join(ICONS, "icon-1024.png"));
  // apple-touch-icon: iOS masks its own squircle → use the square variant.
  await png(square, 180, path.join(ROOT, "src/app/apple-icon.png"));
  // monochrome (badge): white mark on transparent, 96px.
  const mono = Buffer.from(
    readFileSync(path.join(BRAND, "mark-mono.svg"), "utf8").replace(/currentColor/g, "#FFFFFF"),
  );
  await sharp(mono, { density: 512 }).resize(72, 72).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(ICONS, "monochrome-96.png"));
  // favicon.ico (16/32/48) from the plain mark on a light tile for legibility on any tab.
  const favSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${INK}"/>${readFileSync(path.join(BRAND, "mark-white.svg"), "utf8").replace(/^<svg[^>]*>/, '<g transform="translate(6 4) scale(0.82)">').replace(/<\/svg>\s*$/, "</g>")}</svg>`,
  );
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(async (size) => ({ size, data: await sharp(favSvg, { density: 512 }).resize(size, size).png().toBuffer() })));
  writeFileSync(path.join(ROOT, "src/app/favicon.ico"), ico(pngs));
  copyFileSync(path.join(BRAND, "icon.svg"), path.join(ROOT, "src/app/icon.svg"));

  // Shortcut icons: lucide glyph in white on an ink circle.
  const shortcuts: Record<string, string> = {
    "shortcut-payment": "hand-coins",
    "shortcut-collections": "calendar-check",
    "shortcut-voucher": "file-plus-2",
    "shortcut-late": "clock-alert",
  };
  for (const [name, glyph] of Object.entries(shortcuts)) {
    const inner = readFileSync(path.join(ROOT, "node_modules/lucide-static/icons", `${glyph}.svg`), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "");
    const s = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${INK}"/><g transform="translate(24 24) scale(2)" fill="none" stroke="#FFFFFF" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`,
    );
    await sharp(s, { density: 384 }).resize(96, 96).png().toFile(path.join(ICONS, `${name}.png`));
  }
}

/** iOS startup images (portrait), light and dark: dusk gradient + centered bilingual lockup. */
export const SPLASH_DEVICES = [
  { w: 1320, h: 2868, dw: 440, dh: 956, r: 3 },
  { w: 1206, h: 2622, dw: 402, dh: 874, r: 3 },
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 },
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 },
  { w: 1080, h: 2340, dw: 360, dh: 780, r: 3 },
  { w: 1242, h: 2688, dw: 414, dh: 896, r: 3 },
  { w: 828, h: 1792, dw: 414, dh: 896, r: 2 },
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 },
  { w: 1242, h: 2208, dw: 414, dh: 736, r: 3 },
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 },
  { w: 640, h: 1136, dw: 320, dh: 568, r: 2 },
  { w: 2048, h: 2732, dw: 1024, dh: 1366, r: 2 },
  { w: 1668, h: 2388, dw: 834, dh: 1194, r: 2 },
  { w: 1640, h: 2360, dw: 820, dh: 1180, r: 2 },
  { w: 1668, h: 2224, dw: 834, dh: 1112, r: 2 },
  { w: 1620, h: 2160, dw: 810, dh: 1080, r: 2 },
  { w: 1536, h: 2048, dw: 768, dh: 1024, r: 2 },
  { w: 1488, h: 2266, dw: 744, dh: 1133, r: 2 },
] as const;

async function splash() {
  const light = readFileSync(path.join(BRAND, "lockup-bilingual.svg"));
  const dark = readFileSync(path.join(BRAND, "lockup-bilingual-white.svg"));
  const meta = await sharp(light).metadata();
  const ratio = (meta.height ?? 1) / (meta.width ?? 1);
  for (const d of SPLASH_DEVICES) {
    for (const mode of ["light", "dark"] as const) {
      const [top, bottom] = mode === "light" ? ["#C9D4E3", "#D8CCD6"] : ["#1A1F2B", "#241C24"];
      const bg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
      );
      const lw = Math.round(Math.min(d.w, d.h) * 0.34);
      const lockup = await sharp(mode === "light" ? light : dark, { density: 600 }).resize(lw, Math.round(lw * ratio)).png().toBuffer();
      await sharp(bg)
        .composite([{ input: lockup, gravity: "center" }])
        .png({ compressionLevel: 9 })
        .toFile(path.join(SPLASH, `splash-${d.w}x${d.h}-${mode}.png`));
    }
  }
}

async function photos(): Promise<Record<string, { blur: string; width: number; height: number }>> {
  const out: Record<string, { blur: string; width: number; height: number }> = {};
  for (const f of readdirSync(PHOTOS_SRC).filter((x) => x.endsWith(".jpg"))) {
    const name = f.replace(/\.jpg$/, "");
    const src = sharp(path.join(PHOTOS_SRC, f)).rotate();
    const meta = await src.metadata();
    await src.clone().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(PHOTOS_OUT, `${name}.jpg`));
    for (const w of [640, 1280, 2048]) {
      await src.clone().resize({ width: w, withoutEnlargement: true }).avif({ quality: 55 }).toFile(path.join(PHOTOS_OUT, `${name}-${w}.avif`));
      await src.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(PHOTOS_OUT, `${name}-${w}.webp`));
    }
    const tiny = await src.clone().resize(16, 12, { fit: "cover" }).blur(1).jpeg({ quality: 50 }).toBuffer();
    const w = Math.min(2000, meta.width ?? 2000);
    out[name] = { blur: `data:image/jpeg;base64,${tiny.toString("base64")}`, width: w, height: Math.round((w * (meta.height ?? 1)) / (meta.width ?? 1)) };
  }
  return out;
}

async function main() {
  await icons();
  await splash();
  const p = await photos();
  const ts = `// Generated by scripts/generate-brand-assets.ts — do not edit.
export const PHOTOS = ${JSON.stringify(
    Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { src: `/brand/photos/${k}.jpg`, ...v }])),
    null,
    2,
  )} as const;

export type PhotoName = keyof typeof PHOTOS;

export const SPLASH_SCREENS = ${JSON.stringify(
    SPLASH_DEVICES.flatMap((d) =>
      (["light", "dark"] as const).map((mode) => ({
        href: `/splash/splash-${d.w}x${d.h}-${mode}.png`,
        media: `(device-width: ${d.dw}px) and (device-height: ${d.dh}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait) and (prefers-color-scheme: ${mode})`,
      })),
    ),
    null,
    2,
  )} as const;
`;
  writeFileSync(path.join(ROOT, "src/config/generated-assets.ts"), ts);
  console.log("brand assets generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
