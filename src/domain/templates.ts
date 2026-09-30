/**
 * Contract template engine.
 *  - Placeholders: {{variable}}
 *  - Clause references: {{clause_ref:key}} → final number of clause `key`
 *  - Sections: {{#var}}…{{/var}} (rendered when var is truthy), {{^var}}…{{/var}} (when falsy)
 *  - Clause conditions: tiny safe expression language (no eval):
 *      utilities_party == 'owner' && free_months > 0 || !(unit_paci != '')
 */
import { formatDate, dayNameAr, type ISODate } from "./dates";
import { fromFils, type Fils } from "./money";
import { amountWords, tafqeetDuration, tafqeetKWD } from "./tafqeet";
import {
  UNIT_TYPE_LABELS_AR,
  UNIT_TYPE_PLURAL_AR,
  type ContractType,
  type UnitType,
} from "./types";

export type VarValue = string | number | boolean | null | undefined;
export type Vars = Record<string, VarValue>;

// ================================================================ expressions

type Token =
  | { t: "id"; v: string }
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "op"; v: "==" | "!=" | ">" | ">=" | "<" | "<=" | "&&" | "||" | "!" | "(" | ")" };

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two as "==" });
      i += 2;
      continue;
    }
    if ("><!()".includes(ch)) {
      out.push({ t: "op", v: ch as ">" });
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new TemplateError(`Unterminated string in: ${src}`);
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    throw new TemplateError(`Unexpected character "${ch}" in: ${src}`);
  }
  return out;
}

type Expr =
  | { k: "lit"; v: VarValue }
  | { k: "var"; name: string }
  | { k: "not"; e: Expr }
  | { k: "bin"; op: string; l: Expr; r: Expr };

function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === "op" && t.v === v;
  };
  function primary(): Expr {
    const t = tokens[pos++];
    if (!t) throw new TemplateError(`Unexpected end of expression: ${src}`);
    if (t.t === "num" || t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "id") {
      if (t.v === "true") return { k: "lit", v: true };
      if (t.v === "false") return { k: "lit", v: false };
      return { k: "var", name: t.v };
    }
    if (t.v === "(") {
      const e = or();
      if (!isOp(")")) throw new TemplateError(`Missing ")" in: ${src}`);
      pos++;
      return e;
    }
    if (t.v === "!") return { k: "not", e: primary() };
    throw new TemplateError(`Unexpected "${t.v}" in: ${src}`);
  }
  function cmp(): Expr {
    const l = primary();
    const t = peek();
    if (t?.t === "op" && ["==", "!=", ">", ">=", "<", "<="].includes(t.v)) {
      pos++;
      return { k: "bin", op: t.v, l, r: primary() };
    }
    return l;
  }
  function and(): Expr {
    let l = cmp();
    while (isOp("&&")) {
      pos++;
      l = { k: "bin", op: "&&", l, r: cmp() };
    }
    return l;
  }
  function or(): Expr {
    let l = and();
    while (isOp("||")) {
      pos++;
      l = { k: "bin", op: "||", l, r: and() };
    }
    return l;
  }
  const e = or();
  if (pos !== tokens.length) throw new TemplateError(`Unexpected trailing tokens in: ${src}`);
  return e;
}

export function truthy(v: VarValue): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.trim() !== "" && v !== "0";
  return true;
}

function norm(v: VarValue): string | number | boolean {
  if (v === null || v === undefined) return "";
  return v;
}

function evalExpr(e: Expr, vars: Vars): VarValue {
  switch (e.k) {
    case "lit":
      return e.v;
    case "var":
      return vars[e.name];
    case "not":
      return !truthy(evalExpr(e.e, vars));
    case "bin": {
      if (e.op === "&&") return truthy(evalExpr(e.l, vars)) && truthy(evalExpr(e.r, vars));
      if (e.op === "||") return truthy(evalExpr(e.l, vars)) || truthy(evalExpr(e.r, vars));
      const l = norm(evalExpr(e.l, vars));
      const r = norm(evalExpr(e.r, vars));
      switch (e.op) {
        case "==":
          return String(l) === String(r);
        case "!=":
          return String(l) !== String(r);
        case ">":
          return Number(l) > Number(r);
        case ">=":
          return Number(l) >= Number(r);
        case "<":
          return Number(l) < Number(r);
        case "<=":
          return Number(l) <= Number(r);
      }
      throw new TemplateError(`Unknown operator ${e.op}`);
    }
  }
}

/** Evaluates a clause condition. Empty/null conditions are true. */
export function evaluateCondition(condition: string | null | undefined, vars: Vars): boolean {
  if (!condition || !condition.trim()) return true;
  return truthy(evalExpr(parseExpr(condition), vars));
}

export function isValidCondition(condition: string): boolean {
  try {
    parseExpr(condition);
    return true;
  } catch {
    return false;
  }
}

// ================================================================ text templates

type Node =
  | { k: "text"; v: string }
  | { k: "var"; name: string }
  | { k: "ref"; key: string }
  | { k: "section"; name: string; inverted: boolean; children: Node[] };

const TAG_RE = /\{\{\s*([#^/]?)\s*([A-Za-z0-9_:]+)\s*\}\}/g;

function parseText(src: string): Node[] {
  const root: Node[] = [];
  const stack: { name: string; nodes: Node[] }[] = [{ name: "", nodes: root }];
  let last = 0;
  for (const m of src.matchAll(TAG_RE)) {
    const idx = m.index;
    const top = stack[stack.length - 1]!;
    if (idx > last) top.nodes.push({ k: "text", v: src.slice(last, idx) });
    last = idx + m[0].length;
    const [, sigil, name = ""] = m;
    if (sigil === "#" || sigil === "^") {
      const section: Node = { k: "section", name, inverted: sigil === "^", children: [] };
      top.nodes.push(section);
      stack.push({ name, nodes: section.children });
    } else if (sigil === "/") {
      if (stack.length === 1 || top.name !== name)
        throw new TemplateError(`Unbalanced section {{/${name}}}`);
      stack.pop();
    } else if (name.startsWith("clause_ref:")) {
      top.nodes.push({ k: "ref", key: name.slice("clause_ref:".length) });
    } else {
      top.nodes.push({ k: "var", name });
    }
  }
  if (stack.length !== 1)
    throw new TemplateError(`Unclosed section {{#${stack[stack.length - 1]!.name}}}`);
  if (last < src.length) root.push({ k: "text", v: src.slice(last) });
  return root;
}

function renderNodes(nodes: Node[], vars: Vars, refs: Record<string, number>): string {
  let out = "";
  for (const n of nodes) {
    switch (n.k) {
      case "text":
        out += n.v;
        break;
      case "var": {
        const v = vars[n.name];
        out += v === null || v === undefined || v === false ? "" : String(v);
        break;
      }
      case "ref":
        out += refs[n.key] !== undefined ? String(refs[n.key]) : "—";
        break;
      case "section":
        if (truthy(vars[n.name]) !== n.inverted) out += renderNodes(n.children, vars, refs);
        break;
    }
  }
  return out;
}

/** Renders a text with placeholders, sections and clause references. */
export function renderText(src: string, vars: Vars, refs: Record<string, number> = {}): string {
  return renderNodes(parseText(src), vars, refs);
}

/** Variables referenced in a text (for the template editor's variable checker). */
export function referencedVariables(src: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.k === "var") names.add(n.name);
      if (n.k === "section") {
        names.add(n.name);
        walk(n.children);
      }
    }
  };
  walk(parseText(src));
  return [...names];
}

export function isValidTemplateText(src: string): boolean {
  try {
    parseText(src);
    return true;
  } catch {
    return false;
  }
}

// ================================================================ contracts

export interface TemplateClause {
  key: string;
  position: number;
  body: string;
  condition?: string | null;
  optional?: boolean;
  defaultEnabled?: boolean;
  /** For optional clauses: default on when this condition holds (overrides defaultEnabled). */
  defaultCondition?: string | null;
}

export interface ContractTemplate {
  type: ContractType;
  name: string;
  preamble: string;
  closing?: string | null;
  clauses: readonly TemplateClause[];
}

export interface ClauseOverrides {
  /** Toggle optional clauses (key → enabled). */
  enabled?: Record<string, boolean>;
  /** Per-contract text overrides (key → body). */
  text?: Record<string, string>;
}

export interface CustomClause {
  key: string;
  text: string;
}

export interface RenderedClause {
  number: number;
  key: string;
  text: string;
  custom?: boolean;
}

export interface RenderedContract {
  preamble: string[];
  clauses: RenderedClause[];
  closing: string[];
}

function lines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function clauseDefaultEnabled(c: TemplateClause, vars: Vars): boolean {
  if (c.defaultCondition) return evaluateCondition(c.defaultCondition, vars);
  return c.defaultEnabled ?? true;
}

/** Clauses included for these variables and overrides, in final order. */
export function includedClauses(
  tpl: ContractTemplate,
  vars: Vars,
  overrides: ClauseOverrides = {},
): TemplateClause[] {
  return [...tpl.clauses]
    .sort((a, b) => a.position - b.position)
    .filter((c) => {
      if (!evaluateCondition(c.condition, vars)) return false;
      if (c.optional) return overrides.enabled?.[c.key] ?? clauseDefaultEnabled(c, vars);
      return true;
    });
}

/** Renders a full contract: auto-numbered clauses with resolved clause references. */
export function renderContract(
  tpl: ContractTemplate,
  vars: Vars,
  overrides: ClauseOverrides = {},
  custom: readonly CustomClause[] = [],
): RenderedContract {
  const included: { key: string; body: string; custom?: boolean }[] = [
    ...includedClauses(tpl, vars, overrides).map((c) => ({
      key: c.key,
      body: overrides.text?.[c.key] ?? c.body,
    })),
    ...custom.filter((c) => c.text.trim()).map((c) => ({ key: c.key, body: c.text, custom: true })),
  ];
  const refs: Record<string, number> = {};
  included.forEach((c, i) => (refs[c.key] = i + 1));
  return {
    preamble: lines(renderText(tpl.preamble, vars, refs)),
    clauses: included.map((c, i) => ({
      number: i + 1,
      key: c.key,
      text: renderText(c.body, vars, refs).replace(/\s+/g, " ").trim(),
      ...(c.custom ? { custom: true } : {}),
    })),
    closing: lines(renderText(tpl.closing ?? "", vars, refs)),
  };
}

// ================================================================ variables

export interface PropertyAddress {
  area?: string | null;
  block?: string | null;
  street?: string | null;
  avenue?: string | null;
  houseOrPlot?: string | null;
  paciNo?: string | null;
}

/** Generated property description per contract type (empty parts omitted). */
export function propertyDescription(p: PropertyAddress, type: ContractType): string {
  const part = (label: string, v?: string | null) => (v && v.trim() ? `${label} ${v.trim()}` : "");
  const parts =
    type === "residential"
      ? [
          p.area?.trim() ?? "",
          part("قطعة", p.block),
          part("شارع", p.street),
          part("جادة", p.avenue),
          part("منزل", p.houseOrPlot),
        ]
      : [
          part("القسيمة رقم", p.houseOrPlot),
          p.area?.trim() ? `في ${p.area.trim()}` : "",
          part("قطعة", p.block),
          part("شارع", p.street),
          part("جادة", p.avenue),
        ];
  return parts.filter(Boolean).join(" ");
}

export function unitTypeLabel(types: readonly UnitType[]): string {
  const unique = [...new Set(types)];
  if (unique.length === 0) return "الوحدة";
  if (unique.length > 1) return "الوحدات";
  const t = unique[0]!;
  return types.length > 1 ? UNIT_TYPE_PLURAL_AR[t] : UNIT_TYPE_LABELS_AR[t];
}

export interface TemplateVarsInput {
  contractNo: string;
  type: ContractType;
  contractDate: ISODate;
  startDate: ISODate;
  firstCollectionDate: ISODate;
  endDate: ISODate;
  termMonths: number;
  autoRenew: boolean;
  monthlyRentFils: Fils;
  purpose: string;
  utilitiesParty: "owner" | "tenant";
  electricityFixedFils: Fils;
  freeMonths: number;
  noticePeriodMonths: number;
  securityDepositFils: Fils;
  owner: { name: string; civilId?: string | null; phones?: readonly string[] };
  tenant: { name: string; civilId?: string | null; phones?: readonly string[] };
  property: PropertyAddress & { propertyType?: string | null };
  units: readonly { label: string; type: UnitType; paciNo?: string | null }[];
}

/** Builds every variable available to templates (§8). */
export function buildTemplateVars(i: TemplateVarsInput): Vars {
  const utilitiesOwner = i.utilitiesParty === "owner";
  return {
    contract_no: i.contractNo,
    contract_type: i.type,
    day_name: dayNameAr(i.contractDate),
    contract_date: formatDate(i.contractDate),
    owner_name: i.owner.name,
    owner_civil_id: i.owner.civilId ?? "",
    owner_phones: (i.owner.phones ?? []).join(" - "),
    tenant_name: i.tenant.name,
    tenant_civil_id: i.tenant.civilId ?? "",
    tenant_phones: (i.tenant.phones ?? []).join(" - "),
    property_description: propertyDescription(i.property, i.type),
    property_paci: i.property.paciNo ?? "",
    property_type: i.property.propertyType ?? "",
    unit_type_label: unitTypeLabel(i.units.map((u) => u.type)),
    unit_labels: i.units.map((u) => u.label).join("، "),
    unit_paci: i.units.length === 1 ? (i.units[0]!.paciNo ?? "") : "",
    purpose: i.purpose,
    rent_amount: fromFils(i.monthlyRentFils),
    rent_words: amountWords(i.monthlyRentFils),
    term_months: i.termMonths,
    term_words: tafqeetDuration(i.termMonths),
    start_date: formatDate(i.startDate),
    first_collection_date: formatDate(i.firstCollectionDate),
    first_collection_differs: i.firstCollectionDate !== i.startDate,
    end_date: formatDate(i.endDate),
    auto_renew: i.autoRenew,
    free_months: i.freeMonths,
    free_months_words: i.freeMonths > 0 ? tafqeetDuration(i.freeMonths, { oblique: true }) : "",
    notice_period_months: i.noticePeriodMonths,
    notice_period_words: tafqeetDuration(i.noticePeriodMonths, { oblique: true }),
    utilities_party: i.utilitiesParty,
    utilities_owner: utilitiesOwner,
    utilities_party_label: utilitiesOwner ? "الطرف الأول" : "الطرف الثاني",
    electricity_fixed_fils: i.electricityFixedFils,
    electricity_fixed_amount: i.electricityFixedFils > 0 ? fromFils(i.electricityFixedFils) : "",
    electricity_fixed_words: i.electricityFixedFils > 0 ? tafqeetKWD(i.electricityFixedFils) : "",
    security_deposit_fils: i.securityDepositFils,
    security_deposit_amount: i.securityDepositFils > 0 ? fromFils(i.securityDepositFils) : "",
    security_deposit_words: i.securityDepositFils > 0 ? tafqeetKWD(i.securityDepositFils) : "",
  };
}

/** Variables exposed in the template editor's variable picker. */
export const TEMPLATE_VARIABLES = [
  "day_name",
  "contract_date",
  "contract_no",
  "owner_name",
  "owner_civil_id",
  "owner_phones",
  "tenant_name",
  "tenant_civil_id",
  "tenant_phones",
  "property_description",
  "property_paci",
  "unit_type_label",
  "unit_labels",
  "unit_paci",
  "purpose",
  "rent_amount",
  "rent_words",
  "term_words",
  "start_date",
  "first_collection_date",
  "end_date",
  "free_months",
  "free_months_words",
  "notice_period_words",
  "utilities_party_label",
  "electricity_fixed_amount",
  "electricity_fixed_words",
  "security_deposit_amount",
  "security_deposit_words",
] as const;
