import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  buildTemplateVars,
  renderContract,
  type ContractTemplate,
  type RenderedContract,
  type TemplateVarsInput,
} from "@/domain/templates";
import type { ContractType, UnitType } from "@/domain/types";

type DB = SupabaseClient<Database>;

export interface LoadedTemplate extends ContractTemplate {
  id: string;
  version: number;
}

/** Loads a template by id, or the org default for the type, falling back to the system template. */
export async function loadTemplate(
  db: DB,
  type: ContractType,
  templateId?: string | null,
): Promise<LoadedTemplate> {
  let q = db
    .from("contract_templates")
    .select(
      "id, type, name, version, preamble, closing, org_id, is_default, active, template_clauses(key, position, body, condition, default_condition, optional, default_enabled)",
    );
  if (templateId) q = q.eq("id", templateId);
  else q = q.eq("type", type).eq("active", true).eq("is_default", true);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const t = templateId
    ? rows[0]
    : (rows.find((r) => r.org_id !== null) ?? rows.find((r) => r.org_id === null));
  if (!t) throw new Error(`No template for ${type}`);
  return {
    id: t.id,
    version: t.version,
    type: t.type,
    name: t.name,
    preamble: t.preamble,
    closing: t.closing,
    clauses: (t.template_clauses ?? [])
      .map((c) => ({
        key: c.key,
        position: c.position,
        body: c.body,
        condition: c.condition,
        defaultCondition: c.default_condition,
        optional: c.optional,
        defaultEnabled: c.default_enabled,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

export interface ContractPartyData {
  owner: { name: string; civilId: string | null; phones: string[] };
  tenant: { name: string; civilId: string | null; phones: string[] };
  property: {
    area: string | null;
    block: string | null;
    street: string | null;
    avenue: string | null;
    houseOrPlot: string | null;
    paciNo: string | null;
    propertyType: string;
  };
  units: { label: string; type: UnitType; paciNo: string | null }[];
}

export async function loadParties(
  db: DB,
  input: { ownerId?: string | null; tenantId: string; propertyId: string; unitIds: string[] },
): Promise<ContractPartyData> {
  const [{ data: tenant }, { data: property }, { data: units }] = await Promise.all([
    db.from("tenants").select("full_name, civil_id, phones").eq("id", input.tenantId).single(),
    db
      .from("properties")
      .select(
        "area, block, street, avenue, house_or_plot, paci_no, property_type, property_owners(owner_id, share_pct)",
      )
      .eq("id", input.propertyId)
      .single(),
    db.from("units").select("id, label, type, paci_no, sort_order").in("id", input.unitIds),
  ]);
  const ownerId =
    input.ownerId ??
    [...(property?.property_owners ?? [])].sort(
      (a, b) => Number(b.share_pct) - Number(a.share_pct),
    )[0]?.owner_id;
  const { data: owner } = ownerId
    ? await db.from("owners").select("full_name, civil_id, phones").eq("id", ownerId).single()
    : { data: null };
  const ordered = [...(units ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return {
    owner: {
      name: owner?.full_name ?? "",
      civilId: owner?.civil_id ?? null,
      phones: owner?.phones ?? [],
    },
    tenant: {
      name: tenant?.full_name ?? "",
      civilId: tenant?.civil_id ?? null,
      phones: tenant?.phones ?? [],
    },
    property: {
      area: property?.area ?? null,
      block: property?.block ?? null,
      street: property?.street ?? null,
      avenue: property?.avenue ?? null,
      houseOrPlot: property?.house_or_plot ?? null,
      paciNo: property?.paci_no ?? null,
      propertyType: property?.property_type ?? "residential",
    },
    units: ordered.map((u) => ({ label: u.label, type: u.type, paciNo: u.paci_no })),
  };
}

export function varsInput(
  c: Omit<TemplateVarsInput, "owner" | "tenant" | "property" | "units">,
  parties: ContractPartyData,
): TemplateVarsInput {
  return {
    ...c,
    owner: parties.owner,
    tenant: parties.tenant,
    property: { ...parties.property },
    units: parties.units,
  };
}

export function renderWith(
  tpl: ContractTemplate,
  input: TemplateVarsInput,
  overrides: { enabled?: Record<string, boolean>; text?: Record<string, string> },
  custom: { key: string; text: string }[],
): RenderedContract {
  return renderContract(tpl, buildTemplateVars(input), overrides, custom);
}
