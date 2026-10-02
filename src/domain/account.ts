/** Signup & first-run onboarding logic (pure, unit-tested). */

/** Returns why a password is unacceptable, or null when it is fine. */
export function passwordProblem(pwd: string): "short" | "weak" | null {
  if (pwd.length < 8) return "short";
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return "weak";
  return null;
}

export interface SetupCounts {
  orgNamed: boolean;
  hasLogo: boolean;
  properties: number;
  units: number;
  tenants: number;
  contracts: number;
  payments: number;
  members: number;
}

export type ChecklistKey =
  | "profile"
  | "property"
  | "units"
  | "tenant"
  | "contract"
  | "payment"
  | "team"
  | "tour";

export interface ChecklistItem {
  key: ChecklistKey;
  done: boolean;
  /** Where the row takes the user. `?tour=1` starts the guided tour. */
  href: string;
}

/** Dashboard activation checklist. The tour row is always actionable and never blocks completion. */
export function setupChecklist(c: SetupCounts): ChecklistItem[] {
  return [
    { key: "profile", done: c.orgNamed && c.hasLogo, href: "/settings/org" },
    { key: "property", done: c.properties > 0, href: "/properties?new=1" },
    { key: "units", done: c.units > 0, href: "/properties" },
    { key: "tenant", done: c.tenants > 0, href: "/tenants?new=1" },
    { key: "contract", done: c.contracts > 0, href: "/contracts/new" },
    { key: "payment", done: c.payments > 0, href: "/collections" },
    { key: "team", done: c.members > 1, href: "/settings/users" },
    { key: "tour", done: false, href: "?tour=1" },
  ];
}

/** True when every setup step except the optional tour is done. */
export function checklistComplete(items: readonly ChecklistItem[]): boolean {
  return items.every((i) => i.done || i.key === "tour");
}

/** Ratio 0..1 for the checklist progress ring (tour excluded). */
export function checklistProgress(items: readonly ChecklistItem[]): number {
  const main = items.filter((i) => i.key !== "tour");
  if (main.length === 0) return 1;
  return main.filter((i) => i.done).length / main.length;
}
