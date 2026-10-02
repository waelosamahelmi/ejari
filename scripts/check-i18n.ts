/**
 * i18n completeness check (§11, Phase 12): fails when a key exists in one locale
 * but not the other, when a message is empty, or when the ICU arguments differ
 * between Arabic and English (e.g. {amount} missing from a translation).
 *   pnpm i18n:check
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

type Tree = { [k: string]: string | Tree };
const DIR = path.resolve(import.meta.dirname, "../src/messages");

function flatten(t: Tree, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

/** All ICU argument names used anywhere in a message (including inside plural/select branches). */
export function icuArgs(msg: string): string[] {
  const args = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type !== TYPE.literal && el.type !== TYPE.pound && "value" in el && typeof el.value === "string") args.add(el.value);
      if (el.type === TYPE.plural || el.type === TYPE.select) for (const o of Object.values(el.options)) walk(o.value);
      if (el.type === TYPE.tag) walk(el.children);
    }
  };
  walk(parse(msg, { ignoreTag: false }));
  return [...args].sort();
}

export function checkMessages(dir = DIR): string[] {
  const problems: string[] = [];
  const nsAr = readdirSync(path.join(dir, "ar")).filter((f) => f.endsWith(".json"));
  const nsEn = readdirSync(path.join(dir, "en")).filter((f) => f.endsWith(".json"));
  for (const f of new Set([...nsAr, ...nsEn])) {
    if (!nsAr.includes(f)) problems.push(`ar/${f}: missing file`);
    if (!nsEn.includes(f)) problems.push(`en/${f}: missing file`);
    if (!nsAr.includes(f) || !nsEn.includes(f)) continue;
    const ar = flatten(JSON.parse(readFileSync(path.join(dir, "ar", f), "utf8")) as Tree);
    const en = flatten(JSON.parse(readFileSync(path.join(dir, "en", f), "utf8")) as Tree);
    const ns = f.replace(/\.json$/, "");
    for (const k of Object.keys(ar)) if (!(k in en)) problems.push(`en: missing ${ns}.${k}`);
    for (const k of Object.keys(en)) if (!(k in ar)) problems.push(`ar: missing ${ns}.${k}`);
    for (const k of Object.keys(ar)) {
      if (!(k in en)) continue;
      if (!ar[k]!.trim()) problems.push(`ar: empty ${ns}.${k}`);
      if (!en[k]!.trim()) problems.push(`en: empty ${ns}.${k}`);
      let a = "";
      let e = "";
      try {
        a = icuArgs(ar[k]!).join(",");
      } catch (err) {
        problems.push(`ar: invalid ICU in ${ns}.${k}: ${(err as Error).message}`);
      }
      try {
        e = icuArgs(en[k]!).join(",");
      } catch (err) {
        problems.push(`en: invalid ICU in ${ns}.${k}: ${(err as Error).message}`);
      }
      if (a !== e) problems.push(`${ns}.${k}: arguments differ (ar: {${a}} en: {${e}})`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const p = checkMessages();
  if (p.length) {
    console.error(`i18n check failed (${p.length}):\n${p.join("\n")}`);
    process.exit(1);
  }
  console.log("i18n check passed: both locales complete.");
}
