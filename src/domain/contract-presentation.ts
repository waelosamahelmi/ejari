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
    const parts = saved.preambleParts?.[i]
      ? recoverParts(text, saved.preambleParts[i])
      : current.preambleParts?.map((p) => recoverParts(text, p)).find((p) => p !== undefined);
    return parts?.map((part) => {
      if (!part.variable?.startsWith("owner_") || part.text.trim()) return part;
      const value = current.preambleParts?.flat().find((p) => p.variable === part.variable)?.text;
      return value ? { ...part, text: value } : part;
    });
  });
  const present = new Set(
    preambleParts.flatMap((parts) => parts?.map((p) => p.variable).filter(Boolean) ?? []),
  );
  const supplement = (current.preambleParts ?? []).filter((parts) =>
    parts.some(
      (p) =>
        p.variable &&
        /^(tenant_licence_no|tenant_signatory_name|co_tenants)$/.test(p.variable) &&
        !present.has(p.variable) &&
        p.text.trim(),
    ),
  );
  const oldPreamble = saved.preamble.map(
    (text, i) =>
      preambleParts[i]
        ?.map((p) => p.text)
        .join("")
        .trim() ?? text,
  );
  const completeParts = preambleParts.map((parts, i) => parts ?? [{ text: saved.preamble[i]! }]);
  const insertion = oldPreamble.findIndex(
    (line) => line.startsWith("حيث إن") || line.startsWith("حيث ان"),
  );
  oldPreamble.splice(
    insertion < 0 ? oldPreamble.length : insertion,
    0,
    ...supplement.map((parts) =>
      parts
        .map((p) => p.text)
        .join("")
        .trim(),
    ),
  );
  completeParts.splice(insertion < 0 ? completeParts.length : insertion, 0, ...supplement);
  return {
    ...saved,
    preamble: oldPreamble,
    preambleParts: completeParts,
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
