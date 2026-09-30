"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import {
  allocateExpenseLine,
  ALLOCATION_MODES,
  voucherTotal,
  type AllocationTarget,
} from "@/domain/expenses";
import { formatSequenceNo } from "@/domain/contracts";
import { makeDate, periodOf, parsePeriod } from "@/domain/dates";
import { isoDate } from "@/lib/schemas/common";
import { notifyEvent } from "@/server/notify/events";

const reval = () => revalidatePath("/[locale]", "layout");

const targetSchema = z.object({
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  percent: z.number().min(0).max(100).optional(),
  amountFils: z.number().int().min(0).optional(),
});

const lineSchema = z.object({
  amountFils: z.number().int().positive("positive"),
  categoryId: z.string().uuid({ message: "required" }),
  beneficiaryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500, "tooLong"),
  mode: z.enum(ALLOCATION_MODES),
  targets: z.array(targetSchema).min(1, "required"),
});

const voucherSchema = z.object({
  voucherNo: z.string().trim().max(40).optional().nullable(),
  voucherDate: isoDate,
  paidFrom: z.enum(["cash_box", "bank", "cheque"]),
  reference: z.string().trim().max(120).optional().nullable(),
  recipientName: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(lineSchema).min(1, "required"),
});
export type VoucherInput = z.input<typeof voucherSchema>;

/** Resolves allocation weights (unit counts / expected rent of the voucher month) and splits each line. */
async function computeAllocations(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  voucherDate: string,
  lines: z.output<typeof lineSchema>[],
) {
  const propIds = [...new Set(lines.flatMap((l) => l.targets.map((t) => t.propertyId)))];
  const needUnits = lines.some((l) => l.mode === "split_by_units");
  const needRent = lines.some((l) => l.mode === "split_by_rent");
  const unitCounts = new Map<string, number>();
  const rent = new Map<string, number>();
  if (needUnits) {
    const { data } = await db
      .from("units")
      .select("property_id")
      .in("property_id", propIds)
      .eq("active", true);
    for (const u of data ?? [])
      unitCounts.set(u.property_id, (unitCounts.get(u.property_id) ?? 0) + 1);
  }
  if (needRent) {
    const { data } = await db
      .from("v_property_month_summary")
      .select("property_id, expected_fils")
      .eq("period", periodOf(voucherDate))
      .in("property_id", propIds);
    for (const r of data ?? []) rent.set(r.property_id!, r.expected_fils ?? 0);
  }
  return lines.map((l) =>
    allocateExpenseLine(
      l.amountFils,
      l.mode,
      l.targets.map((t): AllocationTarget => ({
        propertyId: t.propertyId,
        unitId: t.unitId ?? null,
        unitCount: unitCounts.get(t.propertyId) ?? 0,
        expectedRentFils: rent.get(t.propertyId) ?? 0,
        percent: t.percent,
        amountFils: t.amountFils,
      })),
    ),
  );
}

/** Creates/updates a voucher (draft or posted). Posted vouchers are locked (void instead). */
export async function saveVoucher(id: string | null, input: VoucherInput, post: boolean) {
  return run(async () => {
    const ctx = await requireActionContext("manage_expenses");
    const d = voucherSchema.parse(input);
    const db = await supabaseServer();
    const allocations = await computeAllocations(db, d.voucherDate, d.lines);
    if (id) {
      const { data: cur } = await db
        .from("expense_vouchers")
        .select("status")
        .eq("id", id)
        .single();
      if (cur?.status !== "draft") throw new ActionError("invalid_transition");
    }
    let voucherNo = d.voucherNo?.trim() || null;
    if (!voucherNo && (post || !id)) {
      const year = Number(d.voucherDate.slice(0, 4));
      const { data: seq, error } = await db.rpc("next_number", {
        p_org: ctx.orgId,
        p_key: "voucher",
        p_year: year,
      });
      if (error) throw error;
      voucherNo = formatSequenceNo(ctx.settings.numbering.voucher, year, seq as number);
    }
    const header = {
      org_id: ctx.orgId,
      voucher_date: d.voucherDate,
      paid_from: d.paidFrom,
      reference: d.reference || null,
      recipient_name: d.recipientName || null,
      notes: d.notes || null,
      status: post ? ("posted" as const) : ("draft" as const),
      ...(voucherNo ? { voucher_no: voucherNo } : {}),
    };
    let vid = id;
    if (id) {
      const u = await db.from("expense_vouchers").update(header).eq("id", id);
      if (u.error) throw u.error;
      const del = await db.from("expense_lines").delete().eq("voucher_id", id);
      if (del.error) throw del.error;
    } else {
      const ins = await db
        .from("expense_vouchers")
        .insert({ ...header, voucher_no: voucherNo! })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      vid = ins.data.id;
    }
    for (const [i, l] of d.lines.entries()) {
      const { data: line, error } = await db
        .from("expense_lines")
        .insert({
          org_id: ctx.orgId,
          voucher_id: vid!,
          position: i + 1,
          amount_fils: l.amountFils,
          category_id: l.categoryId,
          beneficiary_id: l.beneficiaryId ?? null,
          description: l.description,
          allocation_mode: l.mode,
        })
        .select("id")
        .single();
      if (error) throw error;
      const al = await db
        .from("expense_allocations")
        .insert(
          allocations[i]!.map((a) => ({
            org_id: ctx.orgId,
            expense_line_id: line.id,
            property_id: a.propertyId,
            unit_id: a.unitId,
            amount_fils: a.amountFils,
          })),
        );
      if (al.error) throw al.error;
    }
    const total = voucherTotal(d.lines);
    if (post && total >= ctx.settings.voucherThresholdFils) {
      await notifyEvent(ctx, "voucher_threshold", {
        url: `/expenses/${vid}`,
        entityId: vid,
        amountFils: total,
        voucher: voucherNo ?? "",
        propertyId: d.lines[0]!.targets[0]!.propertyId,
      }).catch(() => {});
    }
    reval();
    return vid!;
  });
}

export async function voidVoucher(id: string, reason: string) {
  return run(async () => {
    await requireActionContext("manage_expenses");
    if (!reason.trim()) throw new ActionError("validation");
    const db = await supabaseServer();
    const { error } = await db
      .from("expense_vouchers")
      .update({ status: "void", void_reason: reason.trim() })
      .eq("id", id);
    if (error) throw error;
    reval();
  });
}

export async function deleteDraftVoucher(id: string) {
  return run(async () => {
    await requireActionContext("manage_expenses");
    const db = await supabaseServer();
    const { data } = await db.from("expense_vouchers").select("status").eq("id", id).single();
    if (data?.status !== "draft") throw new ActionError("invalid_transition");
    const { error } = await db.from("expense_vouchers").delete().eq("id", id);
    if (error) throw error;
    reval();
  });
}

// ---------------------------------------------------------------- recurring
const recurringSchema = z.object({
  categoryId: z.string().uuid(),
  beneficiaryId: z.string().uuid().nullable().optional(),
  amountFils: z.number().int().positive(),
  description: z.string().trim().max(300),
  mode: z.enum(ALLOCATION_MODES),
  targets: z.array(targetSchema).min(1),
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean(),
});
export type RecurringInput = z.input<typeof recurringSchema>;

export async function saveRecurring(id: string | null, input: RecurringInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_expenses");
    const d = recurringSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      category_id: d.categoryId,
      beneficiary_id: d.beneficiaryId ?? null,
      amount_fils: d.amountFils,
      description: d.description,
      allocation: { mode: d.mode, targets: d.targets },
      day_of_month: d.dayOfMonth,
      active: d.active,
    };
    const res = id
      ? await db.from("recurring_expenses").update(row).eq("id", id)
      : await db.from("recurring_expenses").insert(row);
    if (res.error) throw res.error;
    reval();
  });
}

/** "Generate this month's vouchers": one draft voucher per active template not yet generated for the period. */
export async function generateRecurring(period: string) {
  return run(async () => {
    const ctx = await requireActionContext("manage_expenses");
    const db = await supabaseServer();
    const { data: templates } = await db
      .from("recurring_expenses")
      .select("*, beneficiaries(name)")
      .eq("active", true);
    const { y, m } = parsePeriod(period);
    let created = 0;
    for (const tpl of templates ?? []) {
      if (tpl.last_generated_period && tpl.last_generated_period >= period) continue;
      const alloc = tpl.allocation as {
        mode: z.infer<typeof lineSchema>["mode"];
        targets: z.infer<typeof targetSchema>[];
      };
      const r = await saveVoucher(
        null,
        {
          voucherDate: makeDate(y, m, tpl.day_of_month),
          paidFrom: "cash_box",
          recipientName: (tpl.beneficiaries as unknown as { name: string } | null)?.name ?? null,
          lines: [
            {
              amountFils: tpl.amount_fils,
              categoryId: tpl.category_id,
              beneficiaryId: tpl.beneficiary_id,
              description: tpl.description,
              mode: alloc.mode,
              targets: alloc.targets,
            },
          ],
        },
        false,
      );
      if (!r.ok) throw new ActionError(r.error);
      await db
        .from("recurring_expenses")
        .update({ last_generated_period: period })
        .eq("id", tpl.id);
      created++;
    }
    void ctx;
    reval();
    return created;
  });
}

// ---------------------------------------------------------------- deposits
const depositSchema = z.object({
  date: isoDate,
  amountFils: z.number().int().positive("positive"),
  destination: z.enum(["owner_bank", "office_bank", "cash_to_owner"]),
  ownerId: z.string().uuid().nullable().optional(),
  bankName: z.string().trim().max(120).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  properties: z
    .array(z.object({ propertyId: z.string().uuid(), amountFils: z.number().int().min(0) }))
    .default([]),
});
export type DepositInput = z.input<typeof depositSchema>;

export async function saveDeposit(id: string | null, input: DepositInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_deposits");
    const d = depositSchema.parse(input);
    if (d.properties.length && d.properties.reduce((a, p) => a + p.amountFils, 0) !== d.amountFils)
      throw new ActionError("amount_sum");
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      deposit_date: d.date,
      amount_fils: d.amountFils,
      destination: d.destination,
      owner_id: d.ownerId ?? null,
      bank_name: d.bankName || null,
      reference: d.reference || null,
      notes: d.notes || null,
    };
    const res = id
      ? await db.from("deposits").update(row).eq("id", id).select("id").single()
      : await db.from("deposits").insert(row).select("id").single();
    if (res.error) throw res.error;
    const depId = res.data.id;
    await db.from("deposit_properties").delete().eq("deposit_id", depId);
    if (d.properties.length) {
      const ins = await db
        .from("deposit_properties")
        .insert(
          d.properties
            .filter((p) => p.amountFils > 0)
            .map((p) => ({
              org_id: ctx.orgId,
              deposit_id: depId,
              property_id: p.propertyId,
              amount_fils: p.amountFils,
            })),
        );
      if (ins.error) throw ins.error;
    }
    if (!id) {
      const firstProp = d.properties[0]?.propertyId ?? null;
      await notifyEvent(ctx, "deposit_recorded", {
        url: "/deposits",
        entityId: depId,
        amountFils: d.amountFils,
        date: d.date,
        propertyId: firstProp,
        userIds: undefined,
      }).catch(() => {});
    }
    reval();
    return depId;
  });
}

export async function deleteDeposit(id: string) {
  return run(async () => {
    await requireActionContext("manage_deposits");
    const db = await supabaseServer();
    const { error } = await db.from("deposits").delete().eq("id", id);
    if (error) throw error;
    reval();
  });
}

export async function saveReconciliationNote(
  period: string,
  note: string,
  ownerId?: string | null,
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_deposits");
    const db = await supabaseServer();
    const base = db.from("cash_reconciliations").select("id").eq("period", period);
    const { data: existing } = await (
      ownerId ? base.eq("owner_id", ownerId) : base.is("owner_id", null)
    ).maybeSingle();
    const res = existing
      ? await db.from("cash_reconciliations").update({ note }).eq("id", existing.id)
      : await db
          .from("cash_reconciliations")
          .insert({ org_id: ctx.orgId, period, owner_id: ownerId ?? null, note });
    if (res.error) throw res.error;
    reval();
  });
}
