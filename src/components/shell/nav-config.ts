import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Building2, FileSignature, Gavel, HandCoins, History, Landmark, LayoutGrid, Receipt, Settings, UserRound, Users, Wallet,
} from "lucide-react";
import type { Role } from "@/domain/types";
import { can, type Capability } from "@/lib/permissions";

export type NavKey =
  | "dashboard" | "collections" | "properties" | "tenants" | "contracts" | "payments" | "expenses" | "deposits" | "reports"
  | "owners" | "legal" | "settings" | "audit";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  section: "work" | "finance" | "records" | "admin";
  capability?: Capability;
  tone: "ink" | "green" | "gulf" | "indigo" | "orange" | "teal" | "sand" | "red" | "gray" | "rose";
}

export const NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutGrid, section: "work", tone: "ink" },
  { key: "collections", href: "/collections", icon: HandCoins, section: "work", tone: "green" },
  { key: "properties", href: "/properties", icon: Building2, section: "work", tone: "gulf" },
  { key: "tenants", href: "/tenants", icon: Users, section: "work", tone: "indigo" },
  { key: "contracts", href: "/contracts", icon: FileSignature, section: "work", tone: "teal" },
  { key: "payments", href: "/payments", icon: Receipt, section: "finance", tone: "green" },
  { key: "expenses", href: "/expenses", icon: Wallet, section: "finance", capability: "view_expenses", tone: "orange" },
  { key: "deposits", href: "/deposits", icon: Landmark, section: "finance", capability: "view_expenses", tone: "sand" },
  { key: "reports", href: "/reports", icon: BarChart3, section: "finance", capability: "view_late_units", tone: "gulf" },
  { key: "owners", href: "/owners", icon: UserRound, section: "records", capability: "view_reports", tone: "rose" },
  { key: "legal", href: "/legal", icon: Gavel, section: "records", capability: "view_legal", tone: "red" },
  { key: "settings", href: "/settings", icon: Settings, section: "admin", tone: "gray" },
  { key: "audit", href: "/audit", icon: History, section: "admin", capability: "view_audit", tone: "gray" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => !n.capability || can(role, n.capability));
}

export const TAB_KEYS: NavKey[] = ["dashboard", "collections", "properties", "reports"];
