/** Contract lifecycle rules: defaults, numbering, notice, renewal, termination, unit status. */
import { addDays, addMonths, contractEndDate, periodOf, type ISODate, type Period } from "./dates";
import type { Fils } from "./money";
import type { ContractStatus, ContractType, UnitStatus } from "./types";

export const PURPOSE_PRESETS: Record<ContractType, readonly string[]> = {
  residential: ["سكن عائلي", "سكن عزاب", "سكن موظفين"],
  investment: ["مكتب عقاري", "محل تجاري", "ورشة", "مخزن", "مطعم", "صالون"],
};

export interface ContractDefaults {
  termMonths: number;
  autoRenew: boolean;
  noticePeriodMonths: number;
  freeMonthsPenaltyWindowMonths: number;
}

export function contractDefaults(type: ContractType): ContractDefaults {
  return {
    termMonths: 60,
    autoRenew: type === "investment",
    noticePeriodMonths: type === "investment" ? 1 : 2,
    freeMonthsPenaltyWindowMonths: 12,
  };
}

/** R-2026-0001 / I-2026-0001 */
export function formatContractNo(type: ContractType, year: number, seq: number): string {
  return `${type === "residential" ? "R" : "I"}-${year}-${String(seq).padStart(4, "0")}`;
}

/** Generic sequence formatter: RC-2026-00001, EX-2026-00001. */
export function formatSequenceNo(prefix: string, year: number, seq: number, width = 5): string {
  return `${prefix}-${year}-${String(seq).padStart(width, "0")}`;
}

// ---------------------------------------------------------------- lifecycle

export type ContractAction = "activate" | "record_notice" | "revise_rent" | "renew" | "terminate" | "end" | "edit";

const TRANSITIONS: Record<ContractStatus, readonly ContractAction[]> = {
  draft: ["activate", "edit"],
  active: ["record_notice", "revise_rent", "renew", "terminate", "end"],
  notice_given: ["revise_rent", "renew", "terminate", "end"],
  ended: [],
  terminated: [],
  renewed: [],
};

export function canPerform(status: ContractStatus, action: ContractAction): boolean {
  return TRANSITIONS[status].includes(action);
}

export function allowedActions(status: ContractStatus): readonly ContractAction[] {
  return TRANSITIONS[status];
}

export function isLive(status: ContractStatus): boolean {
  return status === "active" || status === "notice_given";
}

// ---------------------------------------------------------------- validation

export interface ContractTermsInput {
  type: ContractType;
  contractDate: ISODate;
  startDate: ISODate;
  firstCollectionDate: ISODate;
  termMonths: number;
  monthlyRentFils: Fils;
  freeMonths?: number;
}

export type TermsWarning =
  | "first_collection_before_start"
  | "free_months_mismatch"
  | "contract_after_start"
  | "zero_rent"
  | "invalid_term";

export function validateTerms(t: ContractTermsInput): TermsWarning[] {
  const w: TermsWarning[] = [];
  if (t.firstCollectionDate < t.startDate) w.push("first_collection_before_start");
  if (t.contractDate > t.startDate) w.push("contract_after_start");
  if (t.monthlyRentFils <= 0) w.push("zero_rent");
  if (!Number.isInteger(t.termMonths) || t.termMonths <= 0) w.push("invalid_term");
  if (t.type === "investment" && (t.freeMonths ?? 0) > 0) {
    const expected = addMonths(t.startDate, t.freeMonths ?? 0);
    if (periodOf(expected) !== periodOf(t.firstCollectionDate)) w.push("free_months_mismatch");
  }
  return w;
}

/** Default first collection date for N free months. */
export function firstCollectionFor(startDate: ISODate, freeMonths: number): ISODate {
  return addMonths(startDate, Math.max(0, freeMonths));
}

export { contractEndDate };

// ---------------------------------------------------------------- overlap

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

// ---------------------------------------------------------------- notice

export function expectedMoveOut(noticeDate: ISODate, noticePeriodMonths: number): ISODate {
  return addMonths(noticeDate, noticePeriodMonths);
}

// ---------------------------------------------------------------- renewal

export interface RenewalInput {
  endDate: ISODate;
  termMonths: number;
  renewalTermMonths?: number | null;
  monthlyRentFils: Fils;
  newRentFils?: Fils | null;
}

export function renewalTerms(c: RenewalInput): {
  startDate: ISODate;
  firstCollectionDate: ISODate;
  termMonths: number;
  endDate: ISODate;
  monthlyRentFils: Fils;
} {
  const startDate = addDays(c.endDate, 1);
  const termMonths = c.renewalTermMonths && c.renewalTermMonths > 0 ? c.renewalTermMonths : c.termMonths;
  return {
    startDate,
    firstCollectionDate: startDate,
    termMonths,
    endDate: contractEndDate(startDate, termMonths),
    monthlyRentFils: c.newRentFils ?? c.monthlyRentFils,
  };
}

// ---------------------------------------------------------------- termination

export interface PenaltyInput {
  type: ContractType;
  startDate: ISODate;
  freeMonths: number;
  freeMonthsPenaltyWindowMonths: number;
  monthlyRentFils: Fils;
}

/**
 * Early-exit penalty (investment): leaving before start + window while free
 * months were granted → pay back the value of the free months.
 */
export function earlyExitPenalty(c: PenaltyInput, moveOutDate: ISODate): Fils {
  if (c.type !== "investment" || c.freeMonths <= 0) return 0;
  const windowEnd = addMonths(c.startDate, c.freeMonthsPenaltyWindowMonths);
  return moveOutDate < windowEnd ? c.freeMonths * c.monthlyRentFils : 0;
}

export interface SettlementInput {
  arrearsFils: Fils;
  penaltyFils: Fils;
  securityDepositFils: Fils;
}

export interface Settlement {
  /** Deposit applied against arrears + penalty. */
  depositAppliedFils: Fils;
  /** Deposit refunded to the tenant (never negative). */
  refundFils: Fils;
  /** Still owed by the tenant after applying the deposit. */
  remainingDueFils: Fils;
  depositStatus: "held" | "refunded" | "forfeited_partially" | "forfeited";
}

export function terminationSettlement(s: SettlementInput): Settlement {
  const owed = Math.max(0, s.arrearsFils) + Math.max(0, s.penaltyFils);
  const deposit = Math.max(0, s.securityDepositFils);
  const applied = Math.min(owed, deposit);
  const refund = deposit - applied;
  const remaining = owed - applied;
  let depositStatus: Settlement["depositStatus"] = "refunded";
  if (deposit === 0) depositStatus = "refunded";
  else if (applied === 0) depositStatus = "refunded";
  else if (refund === 0) depositStatus = "forfeited";
  else depositStatus = "forfeited_partially";
  return { depositAppliedFils: applied, refundFils: refund, remainingDueFils: remaining, depositStatus };
}

/** Periods after the move-out month whose charges must be voided. */
export function periodsToVoidAfter(moveOutDate: ISODate, chargePeriods: readonly Period[]): Period[] {
  const last = periodOf(moveOutDate);
  return chargePeriods.filter((p) => p > last);
}

// ---------------------------------------------------------------- unit status

export interface UnitContractView {
  status: ContractStatus;
  startDate: ISODate;
  endDate: ISODate;
  firstCollectionDate: ISODate;
  moveOutDate?: ISODate | null;
  hasOpenLegalCase?: boolean;
}

/**
 * Unit status is derived, never stored:
 * legal > notice > in_grace > occupied > reserved > vacant.
 */
export function deriveUnitStatus(today: ISODate, contracts: readonly UnitContractView[]): UnitStatus {
  const current = contracts.find((c) => {
    if (!isLive(c.status)) return false;
    const end = c.moveOutDate && c.moveOutDate < c.endDate ? c.moveOutDate : c.endDate;
    return c.startDate <= today && today <= end;
  });
  if (current) {
    if (current.hasOpenLegalCase) return "legal";
    if (current.status === "notice_given") return "notice";
    if (today < current.firstCollectionDate) return "in_grace";
    return "occupied";
  }
  const future = contracts.some((c) => isLive(c.status) && c.startDate > today);
  return future ? "reserved" : "vacant";
}

/** Whether a contract occupies a unit at some point during a period. */
export function coversPeriod(
  c: Pick<UnitContractView, "startDate" | "endDate" | "moveOutDate" | "status">,
  period: Period,
): boolean {
  if (c.status === "draft") return false;
  const end = c.moveOutDate && c.moveOutDate < c.endDate ? c.moveOutDate : c.endDate;
  return periodOf(c.startDate) <= period && period <= periodOf(end);
}
