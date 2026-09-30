/** Shared domain types (mirrors the DB enums). */
import type { ISODate, Period } from "./dates";
import type { Fils } from "./money";

export const UNIT_TYPES = [
  "apartment",
  "shop",
  "room",
  "basement",
  "basement_front_half",
  "basement_back_half",
  "roof",
  "office",
  "warehouse",
  "plot",
  "other",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_TYPE_LABELS_AR: Record<UnitType, string> = {
  apartment: "شقة",
  shop: "محل",
  room: "غرفة",
  basement: "سرداب",
  basement_front_half: "نصف السرداب الأمامي",
  basement_back_half: "نصف السرداب الخلفي",
  roof: "السطح",
  office: "مكتب",
  warehouse: "مخزن",
  plot: "قسيمة",
  other: "وحدة",
};

export const UNIT_TYPE_PLURAL_AR: Record<UnitType, string> = {
  apartment: "الشقق",
  shop: "المحلات",
  room: "الغرف",
  basement: "السراديب",
  basement_front_half: "أنصاف السرداب",
  basement_back_half: "أنصاف السرداب",
  roof: "الأسطح",
  office: "المكاتب",
  warehouse: "المخازن",
  plot: "القسائم",
  other: "الوحدات",
};

export const UNIT_TYPE_LABELS_EN: Record<UnitType, string> = {
  apartment: "Apartment",
  shop: "Shop",
  room: "Room",
  basement: "Basement",
  basement_front_half: "Basement (front half)",
  basement_back_half: "Basement (back half)",
  roof: "Roof",
  office: "Office",
  warehouse: "Warehouse",
  plot: "Plot",
  other: "Unit",
};

export const CONTRACT_TYPES = ["residential", "investment"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = [
  "draft",
  "active",
  "notice_given",
  "ended",
  "terminated",
  "renewed",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CHARGE_KINDS = [
  "rent",
  "free",
  "electricity_fixed",
  "penalty",
  "maintenance_recharge",
  "other",
] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const PAYMENT_METHODS = ["cash", "knet", "bank_transfer", "cheque", "link"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ADJUSTMENT_KINDS = ["discount", "write_off", "correction"] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const LEGAL_STATUSES = [
  "none",
  "filed",
  "in_progress",
  "judgment",
  "enforcement",
  "closed",
] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export const LEGAL_STATUS_LABELS_AR: Record<LegalStatus, string> = {
  none: "لا يوجد",
  filed: "مرفوعة",
  in_progress: "منظورة",
  judgment: "صدر حكم",
  enforcement: "تنفيذ",
  closed: "مغلقة",
};

export const PERIOD_STATUSES = [
  "paid",
  "partial",
  "unpaid",
  "due",
  "advance",
  "free",
  "vacant",
  "legal",
] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const UNIT_STATUSES = [
  "occupied",
  "vacant",
  "reserved",
  "in_grace",
  "notice",
  "legal",
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const ROLES = ["admin", "accountant", "collector", "viewer", "owner"] as const;
export type Role = (typeof ROLES)[number];

/** A materialized or projected charge. */
export interface Charge {
  id: string;
  contractId: string;
  period: Period;
  kind: ChargeKind;
  amountFils: Fils;
  waivedValueFils: Fils;
  dueDate: ISODate;
  voided?: boolean;
  description?: string | null;
}

export interface Payment {
  id: string;
  contractId: string;
  tenantId?: string;
  amountFils: Fils;
  receivedAt: ISODate;
  receiptNo?: string | null;
  voided?: boolean;
}

export interface Allocation {
  paymentId: string;
  chargeId: string;
  amountFils: Fils;
}

export interface Adjustment {
  id: string;
  contractId: string;
  chargeId: string | null;
  kind: AdjustmentKind;
  amountFils: Fils;
  date: ISODate;
  reason: string;
}
