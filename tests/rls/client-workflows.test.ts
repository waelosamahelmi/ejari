import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
config({ path: ".env.local" });
const enabled = process.env.SUPABASE_TEST === "1";
type DB = SupabaseClient<Database>;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const password = "Demo12345!";
const stamp = Date.now();
describe.skipIf(!enabled)("client workflows and property scope", () => {
  let service: DB, admin: DB, staff: DB;
  let org = "",
    adminId = "",
    staffId = "",
    memberId = "",
    a = "",
    b = "",
    tenantA = "",
    tenantB = "",
    contractA = "",
    contractB = "",
    chargeA = "",
    chargeB = "",
    paymentA = "",
    sourceUnit = "";
  beforeAll(async () => {
    expect(new URL(url).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    service = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    async function user(name: string) {
      const email = `${name}-${stamp}@example.test`;
      const r = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (r.error) throw r.error;
      const db = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
      const login = await db.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      return { db, id: r.data.user.id };
    }
    const u = await user("client-admin");
    admin = u.db;
    adminId = u.id;
    const v = await user("client-entry");
    staff = v.db;
    staffId = v.id;
    const created = await admin.rpc("create_org", { p_name: "Workflow QA" });
    if (created.error) throw created.error;
    org = created.data;
    const cats = await admin.from("expense_categories").select("id").eq("org_id", org).limit(1);
    if (!cats.data?.length) {
      const cat = await admin
        .from("expense_categories")
        .insert({ org_id: org, name_ar: "صيانة", name_en: "Maintenance", type: "operating" });
      if (cat.error) throw cat.error;
    }
    const props = await admin
      .from("properties")
      .insert([
        { org_id: org, name: "Allowed A" },
        { org_id: org, name: "Hidden B" },
      ])
      .select("id,name");
    if (props.error) throw props.error;
    a = props.data.find((p) => p.name === "Allowed A")!.id;
    b = props.data.find((p) => p.name === "Hidden B")!.id;
    const mem = await admin
      .from("org_members")
      .insert({ org_id: org, user_id: staffId, role: "collector", property_ids: [a] })
      .select("id")
      .single();
    if (mem.error) throw mem.error;
    memberId = mem.data.id;
    const tenants = await admin
      .from("tenants")
      .insert([
        { org_id: org, full_name: "Tenant A", nationality: "كويتي" },
        { org_id: org, full_name: "Tenant B", nationality: "كويتي" },
      ])
      .select("id,full_name");
    if (tenants.error) throw tenants.error;
    tenantA = tenants.data.find((t) => t.full_name === "Tenant A")!.id;
    tenantB = tenants.data.find((t) => t.full_name === "Tenant B")!.id;
    for (const [property, tenant, no] of [
      [a, tenantA, "A"],
      [b, tenantB, "B"],
    ] as const) {
      const c = await admin
        .from("contracts")
        .insert({
          org_id: org,
          property_id: property,
          tenant_id: tenant,
          contract_no: no,
          type: "residential",
          contract_date: "2026-01-01",
          start_date: "2026-01-01",
          first_collection_date: "2026-01-01",
          end_date: "2026-12-31",
          term_months: 12,
          monthly_rent_fils: 300000,
          status: "active",
        })
        .select("id")
        .single();
      if (c.error) throw c.error;
      const ch = await admin
        .from("charges")
        .insert({
          org_id: org,
          contract_id: c.data.id,
          period: "2026-11",
          kind: "rent",
          amount_fils: 300000,
          due_date: "2026-11-01",
        })
        .select("id")
        .single();
      if (ch.error) throw ch.error;
      if (no === "A") {
        contractA = c.data.id;
        chargeA = ch.data.id;
      } else {
        contractB = c.data.id;
        chargeB = ch.data.id;
      }
    }
    const unit = await admin
      .from("units")
      .insert({
        org_id: org,
        property_id: a,
        label: "Source",
        type: "shop",
        paci_no: "21643734",
        asking_rent_fils: 300000,
      })
      .select("id")
      .single();
    if (unit.error) throw unit.error;
    sourceUnit = unit.data.id;
  }, 30000);
  afterAll(async () => {
    if (!service) return;
    if (org) {
      await service.from("audit_log").delete().eq("org_id", org);
      await service.from("orgs").delete().eq("id", org);
    }
    for (const id of [adminId, staffId].filter(Boolean)) await service.auth.admin.deleteUser(id);
  });
  it("hides all other property/tenant/contract/charge data and signed file access", async () => {
    expect((await staff.from("properties").select("id")).data?.map((p) => p.id)).toEqual([a]);
    expect((await staff.from("tenants").select("id")).data?.map((t) => t.id)).toEqual([tenantA]);
    expect((await staff.from("contracts").select("id")).data?.map((c) => c.id)).toEqual([
      contractA,
    ]);
    expect((await staff.from("charges").select("id")).data?.map((c) => c.id)).toEqual([chargeA]);
    expect((await staff.from("properties").select("id").eq("id", b)).data).toEqual([]);
    const object = await staff.rpc("scoped_object_allowed", {
      p_bucket: "media",
      p_name: `${org}/property/${b}/photo.jpg`,
    });
    expect(object.data).toBe(false);
  });
  it("allows a new collection for the assigned property but cannot update/void/delete it or allocate to a hidden charge", async () => {
    const good = await staff
      .from("payments")
      .insert({
        org_id: org,
        contract_id: contractA,
        tenant_id: tenantA,
        amount_fils: 300000,
        received_at: "2026-11-01",
        method: "cash",
      })
      .select("id")
      .single();
    expect(good.error).toBeNull();
    paymentA = good.data!.id;
    expect(
      (
        await staff.from("payments").insert({
          org_id: org,
          contract_id: contractB,
          tenant_id: tenantB,
          amount_fils: 1000,
          received_at: "2026-11-01",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await staff.from("payments").update({ amount_fils: 1 }).eq("id", paymentA).select("id"))
        .data,
    ).toEqual([]);
    expect((await staff.from("payments").delete().eq("id", paymentA).select("id")).data).toEqual(
      [],
    );
    expect(
      (
        await staff
          .from("payment_allocations")
          .insert({ org_id: org, payment_id: paymentA, charge_id: chargeB, amount_fils: 1000 })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await staff
          .from("payment_allocations")
          .insert({ org_id: org, payment_id: paymentA, charge_id: chargeA, amount_fils: 300000 })
      ).error,
    ).toBeNull();
  });
  it("permits a posted expense entry but no changes to it", async () => {
    const cat = await admin
      .from("expense_categories")
      .select("id")
      .eq("org_id", org)
      .limit(1)
      .single();
    expect(cat.error).toBeNull();
    const v = await staff
      .from("expense_vouchers")
      .insert({ org_id: org, voucher_no: "ENTRY-1", voucher_date: "2026-11-02", status: "posted" })
      .select("id")
      .single();
    expect(v.error).toBeNull();
    const l = await staff
      .from("expense_lines")
      .insert({
        org_id: org,
        voucher_id: v.data!.id,
        position: 1,
        amount_fils: 1000,
        category_id: cat.data!.id,
        description: "Entry",
        allocation_mode: "single",
      })
      .select("id")
      .single();
    expect(l.error).toBeNull();
    expect(
      (
        await staff
          .from("expense_allocations")
          .insert({ org_id: org, expense_line_id: l.data!.id, property_id: a, amount_fils: 1000 })
      ).error,
    ).toBeNull();
    expect(
      (
        await staff
          .from("expense_vouchers")
          .update({ status: "void" })
          .eq("id", v.data!.id)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (await staff.from("expense_lines").delete().eq("id", l.data!.id).select("id")).data,
    ).toEqual([]);
  });
  it("applies monthly discounts once to existing/future charges, returning overpayments to credit", async () => {
    const d = await admin
      .from("contract_discounts")
      .insert({
        org_id: org,
        contract_id: contractA,
        from_period: "2026-11",
        to_period: "2026-12",
        amount_fils: 20000,
        reason: "Temporary concession",
      })
      .select("id")
      .single();
    expect(d.error).toBeNull();
    const adj = await admin.from("adjustments").select("amount_fils").eq("charge_id", chargeA);
    expect(adj.data?.map((x) => x.amount_fils)).toEqual([20000]);
    const allocations = await admin
      .from("payment_allocations")
      .select("amount_fils")
      .eq("payment_id", paymentA);
    expect(allocations.data?.reduce((sum, x) => sum + x.amount_fils, 0)).toBe(280000);
    const next = await admin
      .from("charges")
      .insert({
        org_id: org,
        contract_id: contractA,
        period: "2026-12",
        kind: "rent",
        amount_fils: 300000,
        due_date: "2026-12-01",
      })
      .select("id")
      .single();
    expect(next.error).toBeNull();
    expect(
      (await admin.from("adjustments").select("id").eq("charge_id", next.data!.id)).data,
    ).toHaveLength(1);
    expect(
      (
        await admin.from("contract_discounts").insert({
          org_id: org,
          contract_id: contractA,
          from_period: "2026-12",
          to_period: "2026-12",
          amount_fils: 1000,
          reason: "overlap",
        })
      ).error,
    ).not.toBeNull();
  });
  it("applies ongoing concessions to future rent, rejects overlaps and respects lease expiry", async () => {
    const d = await admin
      .from("contract_discounts")
      .insert({
        org_id: org,
        contract_id: contractB,
        from_period: "2026-11",
        to_period: null,
        amount_fils: 10000,
        reason: "Ongoing concession",
      })
      .select("id")
      .single();
    expect(d.error).toBeNull();
    expect(
      (await admin.from("adjustments").select("amount_fils").eq("charge_id", chargeB)).data?.map(
        (x) => x.amount_fils,
      ),
    ).toEqual([10000]);
    for (const period of ["2026-12", "2027-01"]) {
      const ch = await admin
        .from("charges")
        .insert({
          org_id: org,
          contract_id: contractB,
          period,
          due_date: period + "-01",
          kind: "rent",
          amount_fils: 300000,
        })
        .select("id")
        .single();
      expect(ch.error).toBeNull();
      const adj = await admin
        .from("adjustments")
        .select("amount_fils")
        .eq("charge_id", ch.data!.id);
      expect(adj.data?.map((x) => x.amount_fils)).toEqual(period === "2026-12" ? [10000] : []);
    }
    expect(
      (
        await admin
          .from("contract_discounts")
          .insert({
            org_id: org,
            contract_id: contractB,
            from_period: "2026-12",
            to_period: "2026-12",
            amount_fils: 1000,
            reason: "Overlap",
          })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await admin
          .from("contract_discounts")
          .insert({
            org_id: org,
            contract_id: contractB,
            from_period: "2027-02",
            to_period: null,
            amount_fils: 1000,
            reason: "Outside lease",
          })
      ).error,
    ).not.toBeNull();
  });
  it("splits/merges units atomically, shares PACI and retains originals", async () => {
    const result = await admin.rpc("restructure_units", {
      p_property: a,
      p_sources: [sourceUnit],
      p_reason: "Split shop",
      p_units: [
        { label: "1A", type: "shop", floor: 0, askingRentFils: 150000, paciNo: "21643734" },
        { label: "1B", type: "shop", floor: 0, askingRentFils: 150000, paciNo: "21643734" },
      ],
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(
      (await admin.from("units").select("active").eq("id", sourceUnit).single()).data?.active,
    ).toBe(false);
    const merged = await admin.rpc("restructure_units", {
      p_property: a,
      p_sources: result.data!,
      p_reason: "Merge shop",
      p_units: [
        { label: "Source", type: "shop", floor: 0, askingRentFils: 300000, paciNo: "21643734" },
      ],
    });
    expect(merged.error).toBeNull();
    expect(merged.data).toHaveLength(1);
    const bad = await admin.rpc("restructure_units", {
      p_property: a,
      p_sources: merged.data!,
      p_reason: "invalid labels",
      p_units: [
        { label: "duplicate", type: "shop", floor: 0, askingRentFils: 1 },
        { label: "duplicate", type: "shop", floor: 0, askingRentFils: 1 },
      ],
    });
    expect(bad.error).not.toBeNull();
    expect(
      (await admin.from("units").select("active").eq("id", merged.data![0]!).single()).data?.active,
    ).toBe(true);
  });
  it("preserves shared ledger tenants, forbids archiving a live party", async () => {
    const update = await admin
      .from("contracts")
      .update({ co_tenant_ids: [tenantB] })
      .eq("id", contractA);
    expect(update.error).toBeNull();
    expect(
      (
        await admin
          .from("tenants")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", tenantB)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await admin
          .from("contracts")
          .update({ co_tenant_ids: [tenantA] })
          .eq("id", contractA)
      ).error,
    ).not.toBeNull();
  });
  it("reassignment and membership removal revoke access immediately", async () => {
    expect(
      (await admin.from("org_members").update({ property_ids: [] }).eq("id", memberId)).error,
    ).toBeNull();
    expect((await staff.from("properties").select("id")).data).toEqual([]);
    expect((await staff.from("payments").select("id")).data).toEqual([]);
    expect((await admin.from("org_members").delete().eq("id", memberId)).error).toBeNull();
    expect((await staff.from("properties").select("id")).data).toEqual([]);
    expect(
      (
        await staff.from("payments").insert({
          org_id: org,
          contract_id: contractA,
          tenant_id: tenantA,
          amount_fils: 1,
          received_at: "2026-11-03",
        })
      ).error,
    ).not.toBeNull();
  });
});
