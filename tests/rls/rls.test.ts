/**
 * RLS & database-rule tests against local Supabase (seeded).
 * Run: SUPABASE_TEST=1 pnpm test:rls   (skipped otherwise)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";

config({ path: path.resolve(import.meta.dirname, "../../.env.local") });

const enabled = process.env.SUPABASE_TEST === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "Demo12345!";
const ORG = "0a000000-0000-4000-8000-000000000001";

type DB = SupabaseClient<Database>;

async function signIn(email: string, password = PASSWORD): Promise<DB> {
  const c = createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

describe.skipIf(!enabled)("RLS", () => {
  let admin: DB, accountant: DB, collector: DB, owner: DB, outsider: DB, service: DB;
  let otherOrg = "";
  let viewer: DB;
  const outsiderEmail = `outsider-${Date.now()}@example.test`;
  const viewerEmail = `viewer-${Date.now()}@example.test`;

  beforeAll(async () => {
    service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
    [admin, accountant, collector, owner] = await Promise.all([
      signIn("admin@demo.test"),
      signIn("accountant@demo.test"),
      signIn("collector@demo.test"),
      signIn("owner@demo.test"),
    ]);
    await service.auth.admin.createUser({
      email: outsiderEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    const v = await service.auth.admin.createUser({
      email: viewerEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    await service
      .from("org_members")
      .insert({ org_id: ORG, user_id: v.data.user!.id, role: "viewer", display_name: "viewer" });
    outsider = await signIn(outsiderEmail);
    viewer = await signIn(viewerEmail);
    const { data } = await outsider.rpc("create_org", { p_name: "مكتب آخر" });
    otherOrg = data as string;
    await outsider.from("properties").insert({ org_id: otherOrg, name: "عقار سري" });
  });

  afterAll(async () => {
    if (!enabled) return;
    await service.from("orgs").delete().eq("id", otherOrg);
    const { data } = await service.auth.admin.listUsers();
    for (const u of data.users.filter(
      (x) => x.email === outsiderEmail || x.email === viewerEmail,
    )) {
      await service.from("org_members").delete().eq("user_id", u.id);
      await service.auth.admin.deleteUser(u.id);
    }
  });

  it("cross-org isolation both ways", async () => {
    const mine = await admin.from("properties").select("id, name");
    expect(mine.data!.map((p) => p.name)).not.toContain("عقار سري");
    expect(mine.data!.length).toBe(4);
    const theirs = await outsider.from("properties").select("name");
    expect(theirs.data!.map((p) => p.name)).toEqual(["عقار سري"]);
    const tenants = await outsider.from("tenants").select("id");
    expect(tenants.data).toEqual([]);
    const ins = await outsider.from("tenants").insert({ org_id: ORG, full_name: "x" });
    expect(ins.error).not.toBeNull();
  });

  it("collector cannot open expenses or deposits but can read collections data", async () => {
    expect((await collector.from("expense_vouchers").select("id")).data).toEqual([]);
    expect((await collector.from("deposits").select("id")).data).toEqual([]);
    expect((await collector.from("beneficiaries").select("id")).data).toEqual([]);
    const v = await collector
      .from("expense_vouchers")
      .insert({ org_id: ORG, voucher_no: "X-1", voucher_date: "2026-09-01" });
    expect(v.error).not.toBeNull();
    expect((await collector.from("contracts").select("id")).data!.length).toBeGreaterThan(20);
    expect(
      (await collector.from("charges").select("id", { count: "exact", head: true })).count,
    ).toBeGreaterThan(100);
    const upd = await collector
      .from("properties")
      .update({ notes: "x" })
      .eq("org_id", ORG)
      .select("id");
    expect(upd.data ?? []).toEqual([]);
  });

  it("collector can record a payment; viewer cannot", async () => {
    const { data: c } = await collector
      .from("contracts")
      .select("id, tenant_id")
      .eq("status", "active")
      .limit(1)
      .single();
    const ok = await collector
      .from("payments")
      .insert({
        org_id: ORG,
        tenant_id: c!.tenant_id,
        contract_id: c!.id,
        amount_fils: 1000,
        received_at: "2026-09-29",
        receipt_no: "T-RLS",
      })
      .select("id")
      .single();
    expect(ok.error).toBeNull();
    const bad = await viewer
      .from("payments")
      .insert({
        org_id: ORG,
        tenant_id: c!.tenant_id,
        contract_id: c!.id,
        amount_fils: 1000,
        received_at: "2026-09-29",
      });
    expect(bad.error).not.toBeNull();
    const del = await collector.rpc("void_payment", { p_payment: ok.data!.id, p_reason: "test" });
    // collectors may not void (update policy is managers only)
    expect(del.error).not.toBeNull();
    const adminVoid = await admin.rpc("void_payment", { p_payment: ok.data!.id, p_reason: "test" });
    expect(adminVoid.error).toBeNull();
  });

  it("viewer is read-only; accountant cannot manage users or org settings", async () => {
    expect((await viewer.from("properties").select("id")).data!.length).toBe(4);
    expect(
      (await viewer.from("properties").insert({ org_id: ORG, name: "x" })).error,
    ).not.toBeNull();
    const org = await accountant.from("orgs").update({ name: "hacked" }).eq("id", ORG).select("id");
    expect(org.data ?? []).toEqual([]);
    const mem = await accountant
      .from("org_members")
      .insert({ org_id: ORG, user_id: "0b000000-0000-4000-8000-000000000003", role: "admin" });
    expect(mem.error).not.toBeNull();
    expect((await accountant.from("expense_vouchers").select("id")).data!.length).toBe(1);
    expect(
      (await accountant.from("audit_log").select("id", { head: true, count: "exact" })).error,
    ).toBeNull();
    expect((await collector.from("audit_log").select("id")).data).toEqual([]);
  });

  it("owner portal sees only own properties and related rows", async () => {
    const props = await owner.from("properties").select("name");
    expect(props.data!.map((p) => p.name).sort()).toEqual(
      ["الجابرية 157", "الري قسيمة 1674", "السالمية 88"].sort(),
    );
    const tenants = await owner.from("tenants").select("id");
    const allTenants = await admin.from("tenants").select("id");
    expect(tenants.data!.length).toBeLessThan(allTenants.data!.length);
    expect((await owner.from("org_members").select("id")).data!.length).toBeGreaterThan(0);
    expect((await owner.from("reminders_log").select("id")).data).toEqual([]);
    expect((await owner.from("legal_cases").select("id")).data).toEqual([]);
    expect(
      (await owner.from("properties").insert({ org_id: ORG, name: "x" })).error,
    ).not.toBeNull();
    const pays = await owner.from("payments").select("contract_id");
    expect(pays.data!.length).toBeGreaterThan(0);
  });

  it("overlapping active contract on the same unit is rejected", async () => {
    const { data: cu } = await admin
      .from("contract_units")
      .select("unit_id, contract_id, contracts(tenant_id, property_id)")
      .eq("is_live", true)
      .limit(1)
      .single();
    const k = cu!.contracts as unknown as { tenant_id: string; property_id: string };
    const { data: c } = await admin
      .from("contracts")
      .insert({
        org_id: ORG,
        contract_no: `T-${Date.now()}`,
        type: "residential",
        tenant_id: k.tenant_id,
        property_id: k.property_id,
        contract_date: "2026-09-01",
        start_date: "2026-09-01",
        first_collection_date: "2026-09-01",
        end_date: "2027-08-31",
        monthly_rent_fils: 1000,
        status: "active",
      })
      .select("id")
      .single();
    const r = await admin
      .from("contract_units")
      .insert({ org_id: ORG, contract_id: c!.id, unit_id: cu!.unit_id });
    expect(r.error?.message).toMatch(/contract_units_no_overlap/);
    await admin.from("contracts").delete().eq("id", c!.id);
  });

  it("closed period rejects writes", async () => {
    const { data: c } = await admin
      .from("contracts")
      .select("id, tenant_id")
      .eq("status", "active")
      .limit(1)
      .single();
    const r = await admin
      .from("payments")
      .insert({
        org_id: ORG,
        tenant_id: c!.tenant_id,
        contract_id: c!.id,
        amount_fils: 1,
        received_at: "2026-07-15",
      });
    expect(r.error?.message).toMatch(/closed/);
  });

  it("next_number is gapless per key and year", async () => {
    const a = await admin.rpc("next_number", { p_org: ORG, p_key: "test_seq", p_year: 2099 });
    const b = await admin.rpc("next_number", { p_org: ORG, p_key: "test_seq", p_year: 2099 });
    expect((b.data as number) - (a.data as number)).toBe(1);
    const denied = await outsider.rpc("next_number", {
      p_org: ORG,
      p_key: "test_seq",
      p_year: 2099,
    });
    expect(denied.error).not.toBeNull();
  });

  it("users only see their own notifications and settings", async () => {
    await service.from("notifications").insert({
      org_id: ORG,
      user_id: "0b000000-0000-4000-8000-000000000001",
      type: "test",
      title_ar: "a",
      title_en: "a",
      body_ar: "b",
      body_en: "b",
    });
    expect(
      (await admin.from("notifications").select("id").eq("type", "test")).data!.length,
    ).toBeGreaterThan(0);
    expect((await collector.from("notifications").select("id").eq("type", "test")).data).toEqual(
      [],
    );
    expect((await collector.from("user_settings").select("user_id")).data!.length).toBe(1);
    await service.from("notifications").delete().eq("type", "test");
  });
});
