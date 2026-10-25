import type { ContractTextPart, RenderedContract } from "./templates";
export type { RenderedContract } from "./templates";

/** Recover variable boundaries in old snapshots without replacing their legal wording or values. */
function recoverParts(text: string, parts?: ContractTextPart[]): ContractTextPart[] | undefined {
  if (!parts) return undefined;
  const pattern = parts
    .map((p) =>
      p.variable
        ? "([\\s\\S]*?)"
        : p.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"),
    )
    .join("");
  const match = new RegExp(`^${pattern}$`).exec(text);
  if (!match) return undefined;
  let capture = 1;
  return parts.map((p) => (p.variable ? { ...p, text: match[capture++] ?? "" } : { ...p }));
}

/** Fill only missing owner fields; preserve existing owner identities and every saved clause. */
export function restoreContractPresentation(
  saved: RenderedContract,
  current: RenderedContract,
): RenderedContract {
  const preambleParts = saved.preamble.map((text, i) => {
    const parts = recoverParts(text, saved.preambleParts?.[i] ?? current.preambleParts?.[i]);
    return parts?.map((part) => {
      if (!part.variable?.startsWith("owner_") || part.text.trim()) return part;
      const value = current.preambleParts?.flat().find((p) => p.variable === part.variable)?.text;
      return value ? { ...part, text: value } : part;
    });
  });
  return {
    ...saved,
    preamble: saved.preamble.map(
      (text, i) => preambleParts[i]?.map((p) => p.text).join("") ?? text,
    ),
    preambleParts: preambleParts.map((parts, i) => parts ?? [{ text: saved.preamble[i]! }]),
    clauses: saved.clauses.map((clause) => ({
      ...clause,
      parts:
        clause.parts ??
        recoverParts(clause.text, current.clauses.find((c) => c.key === clause.key)?.parts),
    })),
    closingParts: saved.closing.map(
      (text, i) =>
        saved.closingParts?.[i] ?? recoverParts(text, current.closingParts?.[i]) ?? [{ text }],
    ),
  };
}
