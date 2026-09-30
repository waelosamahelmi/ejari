import type { Role } from "@/domain/types";

export type Capability =
  | "manage_org"
  | "manage_users"
  | "manage_master_data"
  | "manage_contracts"
  | "record_payment"
  | "void_payment"
  | "manage_expenses"
  | "view_expenses"
  | "manage_deposits"
  | "view_reports"
  | "view_late_units"
  | "close_month"
  | "reopen_month"
  | "view_audit"
  | "send_reminder"
  | "manage_legal"
  | "view_legal"
  | "manage_templates";

const MATRIX: Record<Role, readonly Capability[]> = {
  admin: [
    "manage_org", "manage_users", "manage_master_data", "manage_contracts", "record_payment", "void_payment", "manage_expenses",
    "view_expenses", "manage_deposits", "view_reports", "view_late_units", "close_month", "reopen_month", "view_audit",
    "send_reminder", "manage_legal", "view_legal", "manage_templates",
  ],
  accountant: [
    "manage_master_data", "manage_contracts", "record_payment", "void_payment", "manage_expenses", "view_expenses",
    "manage_deposits", "view_reports", "view_late_units", "close_month", "view_audit", "send_reminder", "manage_legal",
    "view_legal", "manage_templates",
  ],
  collector: ["record_payment", "view_late_units", "send_reminder"],
  viewer: ["view_expenses", "view_reports", "view_late_units", "view_legal"],
  owner: [],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return !!role && MATRIX[role].includes(cap);
}
