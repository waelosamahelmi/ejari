import { UNIT_TYPE_LABELS_AR, type UnitType } from "./types";

export interface ContractFileUnit {
  label: string;
  type: UnitType;
  typeLabel?: string | null;
}

/** Characters that are unsafe in file names on Windows, macOS or in a Content-Disposition header. */
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u200e\u200f\u202a-\u202e]/g;

function clean(s: string): string {
  return s.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Human file name (without extension) that identifies the property and the unit,
 * with its type (apartment / shop / office ...): "عقد - السالمية 89 - محل 1".
 * Falls back to the contract number when nothing else is known.
 */
export function contractFileName(input: {
  contractNo: string;
  propertyName?: string | null;
  units: readonly ContractFileUnit[];
}): string {
  const units = input.units
    .map((u) =>
      clean(`${clean(u.typeLabel ?? "") || UNIT_TYPE_LABELS_AR[u.type]} ${clean(u.label)}`),
    )
    .filter(Boolean);
  const parts = [
    "عقد",
    clean(input.propertyName ?? ""),
    units.length > 3 ? `${units.slice(0, 3).join(" و")} وغيرها` : units.join(" و"),
    clean(input.contractNo),
  ].filter(Boolean);
  const name = parts.join(" - ");
  return name.length > 150 ? name.slice(0, 150).trim() : name;
}
