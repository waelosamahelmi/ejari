import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "@/lib/supabase/types";
config({ path: ".env.local" });
type DB = SupabaseClient<Database>;
const enabled = process.env.SUPABASE_TEST === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
describe.skipIf(!enabled)("prepared receipts, owner numbering and print audit", () => {
  let svc: DB,
    admin: DB,
    staff: DB,
    org: string,
    _adminId: string,
    staffId: string,
    _member: string;
  let ownerA: string,
    ownerB: string,
    a: string,
    a2: string,
    b: string,
    lease: string,
    receipt: string;
  const users: string[] = [];
  async function user(tag: string) {
    const email = `receipt-${tag}-${Date.now()}@example.test`;
    const r = await svc.auth.admin.createUser({
      email,
      password: "Demo12345!",
      email_confirm: true,
    });
    if (r.error) throw r.error;
    users.push(r.data.user.id);
    const db = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const sign = await db.auth.signInWithPassword({ email, password: "Demo12345!" });
    if (sign.error) throw sign.error;
    return { db, id: r.data.user.id };
  }
  async function newLease(property: string, owner: string, label = crypto.randomUUID()) {
    const t = await admin
      .from("tenants")
      .insert({ org_id: org, full_name: "Receipt tenant " + label })
      .select("id")
      .single();
    if (t.error) throw t.error;
    const u = await admin
      .from("units")
      .insert({ org_id: org, property_id: property, label, type: "apartment" })
      .select("id")
      .single();
    if (u.error) throw u.error;
    const c = await admin
      .from("contracts")
      .insert({
        org_id: org,
        owner_id: owner,
        property_id: property,
        tenant_id: t.data.id,
        contract_no: label,
        type: "residential",
        status: "active",
        contract_date: "2026-11-01",
        start_date: "2026-11-01",
        first_collection_date: "2026-11-01",
        end_date: "2027-10-31",
        term_months: 12,
        monthly_rent_fils: 300000,
      })
      .select("id")
      .single();
    if (c.error) throw c.error;
    expect(
      (
        await admin.from("contract_units").insert({
          org_id: org,
          contract_id: c.data.id,
          unit_id: u.data.id,
          rent_share_fils: 300000,
        })
      ).error,
    ).toBeNull();
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
    return { id: c.data.id, tenant: t.data.id, charge: ch.data.id };
  }
  beforeAll(async () => {
    expect(new URL(url).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    svc = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    const u = await user("admin");
    admin = u.db;
    _adminId = u.id;
    const g = await user("guard");
    staff = g.db;
    staffId = g.id;
    const o = await admin.rpc("create_org", { p_name: "Receipt workflow QA" });
    if (o.error) throw o.error;
    org = o.data;
    const owners = await admin
      .from("owners")
      .insert([
        { org_id: org, full_name: "Owner A" },
        { org_id: org, full_name: "Owner B" },
      ])
      .select("id,full_name");
    if (owners.error) throw owners.error;
    ownerA = owners.data.find((v) => v.full_name === "Owner A")!.id;
    ownerB = owners.data.find((v) => v.full_name === "Owner B")!.id;
    const props = await admin
      .from("properties")
      .insert(["A", "A2", "B"].map((name) => ({ org_id: org, name })))
      .select("id,name");
    if (props.error) throw props.error;
    a = props.data.find((p) => p.name === "A")!.id;
    a2 = props.data.find((p) => p.name === "A2")!.id;
    b = props.data.find((p) => p.name === "B")!.id;
    expect(
      (
        await admin.from("property_owners").insert([
          { org_id: org, owner_id: ownerA, property_id: a, share_pct: 100 },
          { org_id: org, owner_id: ownerA, property_id: a2, share_pct: 100 },
          { org_id: org, owner_id: ownerB, property_id: b, share_pct: 100 },
        ])
      ).error,
    ).toBeNull();
    const m = await admin
      .from("org_members")
      .insert({ org_id: org, user_id: staffId, role: "collector", property_ids: [a, a2] })
      .select("id")
      .single();
    if (m.error) throw m.error;
    _member = m.data.id;
  });
  afterAll(async () => {
    if (org) {
      await svc.from("contracts").update({ status: "ended" }).eq("org_id", org);
      await svc.from("collection_receipts").update({ payment_id: null }).eq("org_id", org);
      // Remove audited children while their office still exists; audit triggers also run on cascades.
      for (const table of [
        "payments",
        "collection_receipts",
        "document_prints",
        "expense_vouchers",
        "contracts",
        "properties",
        "tenants",
        "owner_document_sequences",
        "owners",
        "org_members",
      ] as const) {
        const result = await svc.from(table).delete().eq("org_id", org);
        expect(result.error).toBeNull();
      }
      const r = await svc.from("orgs").delete().eq("id", org);
      expect(r.error).toBeNull();
    }
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });
  it("prepares one discounted document idempotently without receiving any money", async () => {
    const c = await newLease(a, ownerA, "first");
    lease = c.id;
    expect(
      (
        await admin.from("adjustments").insert({
          org_id: org,
          contract_id: c.id,
          charge_id: c.charge,
          kind: "discount",
          amount_fils: 50000,
          reason: "Approved concession",
          adjustment_date: "2026-11-01",
        })
      ).error,
    ).toBeNull();
    const prepared = await staff.rpc("prepare_collection_receipt", {
      p_contract: lease,
      p_period: "2026-11",
    });
    expect(prepared.error).toBeNull();
    receipt = prepared.data!;
    expect(
      (await staff.rpc("prepare_collection_receipt", { p_contract: lease, p_period: "2026-11" }))
        .data,
    ).toBe(receipt);
    const row = await staff
      .from("collection_receipts")
      .select("amount_fils,status,document_no")
      .eq("id", receipt)
      .single();
    expect(row.data).toMatchObject({
      amount_fils: 250000,
      status: "prepared",
      document_no: "RC-2026-00001",
    });
    expect((await admin.from("payments").select("id").eq("contract_id", lease)).data).toEqual([]);
    expect(
      (
        await staff
          .from("collection_receipts")
          .update({ amount_fils: 1 })
          .eq("id", receipt)
          .select("id")
      ).error?.code,
    ).toBe("42501");
  });
  it("continues numbering across an owner's buildings and isolates another owner's sequence", async () => {
    const c = await newLease(a2, ownerA, "second");
    const hidden = await newLease(b, ownerB, "hidden");
    const two = await staff.rpc("prepare_collection_receipt", {
      p_contract: c.id,
      p_period: "2026-11",
    });
    expect(two.error).toBeNull();
    expect(
      (await staff.from("collection_receipts").select("document_no").eq("id", two.data!).single())
        .data?.document_no,
    ).toBe("RC-2026-00002");
    expect(
      (
        await staff.rpc("prepare_collection_receipt", {
          p_contract: hidden.id,
          p_period: "2026-11",
        })
      ).error?.code,
    ).toBe("42501");
    const r = await admin.rpc("prepare_collection_receipt", {
      p_contract: hidden.id,
      p_period: "2026-11",
    });
    expect(r.error).toBeNull();
    expect(
      (await admin.from("collection_receipts").select("document_no").eq("id", r.data!).single())
        .data?.document_no,
    ).toBe("RC-2026-00001");
    expect((await staff.from("collection_receipts").select("id").eq("id", r.data!)).data).toEqual(
      [],
    );
    const pay = await staff
      .from("payments")
      .insert({
        org_id: org,
        contract_id: c.id,
        tenant_id: c.tenant,
        amount_fils: 10000,
        method: "cash",
        received_at: "2026-11-02",
        receipt_no: "OVERRIDE",
      })
      .select("receipt_no,system_no")
      .single();
    expect(pay.error).toBeNull();
    expect(pay.data).toEqual({ receipt_no: "RC-2026-00003", system_no: "RC-2026-00003" });
  });
  it("collects exactly once atomically, with the same reserved number and net amount", async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        staff.rpc("collect_prepared_receipt", {
          p_receipt: receipt,
          p_method: "cash",
          p_date: "2026-11-02",
          p_reference: "KNET-QA-42",
          p_collected_by: _adminId,
        }),
      ),
    );
    for (const r of results) expect(r.error).toBeNull();
    expect(results[0]!.data).toMatchObject({ systemNo: "RC-2026-00001" });
    const p = await admin
      .from("payments")
      .select("id,amount_fils,receipt_no,reference,collected_by,payment_allocations(amount_fils)")
      .eq("collection_receipt_id", receipt)
      .single();
    expect(p.error).toBeNull();
    expect(p.data?.amount_fils).toBe(250000);
    expect(p.data?.reference).toBe("KNET-QA-42");
    expect(p.data?.collected_by).toBe(staffId);
    expect(p.data?.payment_allocations.reduce((s, a) => s + a.amount_fils, 0)).toBe(250000);
    expect(
      (
        await staff
          .from("collection_receipts")
          .select("status,payment_id")
          .eq("id", receipt)
          .single()
      ).data,
    ).toEqual({ status: "collected", payment_id: p.data!.id });
  });
  it("logs print attempts once per job and counts prepared/paid reprints as one document", async () => {
    const job = crypto.randomUUID();
    for (let i = 0; i < 2; i++)
      expect(
        (
          await staff.rpc("record_document_print", {
            p_kind: "collection",
            p_ids: [receipt],
            p_job: job,
          })
        ).error,
      ).toBeNull();
    const pay = (
      await staff.from("collection_receipts").select("payment_id").eq("id", receipt).single()
    ).data!.payment_id!;
    expect(
      (
        await staff.rpc("record_document_print", {
          p_kind: "payment",
          p_ids: [pay],
          p_job: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await staff
          .from("v_document_print_counts")
          .select("print_count")
          .eq("document_id", receipt)
          .single()
      ).data?.print_count,
    ).toBe(2);
    const hidden = (
      await admin.from("collection_receipts").select("id").eq("property_id", b).single()
    ).data!.id;
    expect(
      (
        await staff.rpc("record_document_print", {
          p_kind: "collection",
          p_ids: [receipt, hidden],
          p_job: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("42501");
    expect(
      (
        await staff
          .from("v_document_print_counts")
          .select("print_count")
          .eq("document_id", receipt)
          .single()
      ).data?.print_count,
    ).toBe(2);
    expect(
      (
        await staff
          .from("document_prints")
          .update({ document_no: "FAKE" })
          .eq("document_id", receipt)
          .select("id")
      ).error?.code,
    ).toBe("42501");
  });
  it("refuses stale amounts without posting a payment; void and reissue retain history", async () => {
    const c = await newLease(a, ownerA, "stale");
    const r = await staff.rpc("prepare_collection_receipt", {
      p_contract: c.id,
      p_period: "2026-11",
    });
    expect(r.error).toBeNull();
    expect(
      (await admin.from("charges").update({ amount_fils: 200000 }).eq("id", c.charge)).error,
    ).toBeNull();
    expect(
      (
        await staff.rpc("collect_prepared_receipt", {
          p_receipt: r.data!,
          p_method: "cash",
          p_date: "2026-11-02",
          p_reference: "KNET-QA-42",
          p_collected_by: _adminId,
        })
      ).error?.message,
    ).toContain("receipt_changed");
    expect((await admin.from("payments").select("id").eq("contract_id", c.id)).data).toEqual([]);
    for (const reason of ["", "  ", null]) {
      const invalid = await staff.rpc("void_collection_receipt", {
        p_id: r.data!,
        p_reason: reason as unknown as string,
      });
      expect(invalid.error?.message).toContain("invalid_transition");
    }
    expect(
      (await staff.rpc("void_collection_receipt", { p_id: r.data!, p_reason: "Amount changed" }))
        .error,
    ).toBeNull();
    const next = await staff.rpc("prepare_collection_receipt", {
      p_contract: c.id,
      p_period: "2026-11",
    });
    expect(next.error).toBeNull();
    expect(next.data).not.toBe(r.data);
    expect(
      (await staff.from("collection_receipts").select("amount_fils").eq("id", next.data!).single())
        .data?.amount_fils,
    ).toBe(200000);
  });
  it("numbers expenses per owner automatically and does not let staff use a hidden owner", async () => {
    const a1 = await admin
      .from("expense_vouchers")
      .insert({
        org_id: org,
        owner_id: ownerA,
        voucher_no: "MANUAL",
        voucher_date: "2026-11-01",
        status: "draft",
      })
      .select("id,voucher_no")
      .single();
    expect(a1.error).toBeNull();
    expect(a1.data?.voucher_no).toBe("EX-2026-00001");
    const a2r = await admin
      .from("expense_vouchers")
      .insert({
        org_id: org,
        owner_id: ownerA,
        voucher_no: "MANUAL",
        voucher_date: "2026-11-01",
        status: "draft",
      })
      .select("voucher_no")
      .single();
    expect(a2r.data?.voucher_no).toBe("EX-2026-00002");
    const b1 = await admin
      .from("expense_vouchers")
      .insert({
        org_id: org,
        owner_id: ownerB,
        voucher_no: "MANUAL",
        voucher_date: "2026-11-01",
        status: "draft",
      })
      .select("voucher_no")
      .single();
    expect(b1.data?.voucher_no).toBe("EX-2026-00001");
    expect(
      (
        await staff.from("expense_vouchers").insert({
          org_id: org,
          owner_id: ownerB,
          voucher_no: "MANUAL",
          voucher_date: "2026-11-01",
          status: "posted",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await admin
          .from("expense_vouchers")
          .update({ voucher_no: "CHANGED", owner_id: ownerB })
          .eq("id", a1.data!.id)
          .select("voucher_no,owner_id")
          .single()
      ).data,
    ).toEqual({ voucher_no: "EX-2026-00001", owner_id: ownerA });
  });
});
