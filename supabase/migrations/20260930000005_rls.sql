-- Ijari: Row Level Security on every table.
-- Roles: admin (everything), accountant (everything except users/org settings),
-- collector (read operational data, create payments/reminders; no finance),
-- viewer (read-only), owner (read-only portal, own properties only).

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- orgs & members
create policy orgs_select on public.orgs for select to authenticated using (public.is_member(id));
create policy orgs_update on public.orgs for update to authenticated
  using (public.has_role(id, array['admin']::public.member_role[]))
  with check (public.has_role(id, array['admin']::public.member_role[]));

create policy members_select on public.org_members for select to authenticated using (public.is_member(org_id));
create policy members_admin_write on public.org_members for all to authenticated
  using (public.has_role(org_id, array['admin']::public.member_role[]))
  with check (public.has_role(org_id, array['admin']::public.member_role[]));

-- ---------------------------------------------------------------- operational master data
-- read: staff; write: admin/accountant
do $$
declare t text;
begin
  foreach t in array array[
    'owners','properties','property_owners','property_commissions','units','tenants','contracts','contract_units',
    'contract_rent_revisions','legal_cases','legal_case_events','charges','adjustments'
  ] loop
    execute format('create policy %1$s_staff_select on public.%1$I for select to authenticated using (public.is_staff(org_id))', t);
    execute format('create policy %1$s_manager_insert on public.%1$I for insert to authenticated with check (public.is_manager(org_id))', t);
    execute format('create policy %1$s_manager_update on public.%1$I for update to authenticated using (public.is_manager(org_id)) with check (public.is_manager(org_id))', t);
    execute format('create policy %1$s_manager_delete on public.%1$I for delete to authenticated using (public.is_manager(org_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- payments & reminders (collectors may create)
create policy payments_staff_select on public.payments for select to authenticated using (public.is_staff(org_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_role(org_id, array['admin','accountant','collector']::public.member_role[]));
create policy payments_manager_update on public.payments for update to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy allocations_staff_select on public.payment_allocations for select to authenticated using (public.is_staff(org_id));
create policy allocations_insert on public.payment_allocations for insert to authenticated
  with check (public.has_role(org_id, array['admin','accountant','collector']::public.member_role[]));
create policy allocations_manager_delete on public.payment_allocations for delete to authenticated using (public.is_manager(org_id));

create policy reminders_staff_select on public.reminders_log for select to authenticated using (public.is_staff(org_id));
create policy reminders_insert on public.reminders_log for insert to authenticated
  with check (public.has_role(org_id, array['admin','accountant','collector']::public.member_role[]));

create policy attachments_staff_select on public.attachments for select to authenticated using (public.is_staff(org_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.has_role(org_id, array['admin','accountant','collector']::public.member_role[]));
create policy attachments_manager_delete on public.attachments for delete to authenticated using (public.is_manager(org_id));

-- ---------------------------------------------------------------- finance (no collectors)
do $$
declare t text;
begin
  foreach t in array array[
    'expense_categories','beneficiaries','expense_vouchers','expense_lines','expense_allocations','recurring_expenses',
    'deposits','deposit_properties','monthly_closings'
  ] loop
    execute format($f$create policy %1$s_finance_select on public.%1$I for select to authenticated
      using (public.has_role(org_id, array['admin','accountant','viewer']::public.member_role[]))$f$, t);
    execute format('create policy %1$s_manager_insert on public.%1$I for insert to authenticated with check (public.is_manager(org_id))', t);
    execute format('create policy %1$s_manager_update on public.%1$I for update to authenticated using (public.is_manager(org_id)) with check (public.is_manager(org_id))', t);
    execute format('create policy %1$s_manager_delete on public.%1$I for delete to authenticated using (public.is_manager(org_id))', t);
  end loop;
end $$;

-- Reopening a closed month is admin-only.
drop policy monthly_closings_manager_delete on public.monthly_closings;
create policy monthly_closings_admin_delete on public.monthly_closings for delete to authenticated
  using (public.has_role(org_id, array['admin']::public.member_role[]));
-- Collectors need to know whether a month is closed (offline sync conflicts).
create policy monthly_closings_member_select on public.monthly_closings for select to authenticated using (public.is_member(org_id));

-- ---------------------------------------------------------------- templates (system rows have org_id null)
create policy templates_select on public.contract_templates for select to authenticated
  using (org_id is null or public.is_member(org_id));
create policy templates_manager_write on public.contract_templates for all to authenticated
  using (org_id is not null and public.is_manager(org_id)) with check (org_id is not null and public.is_manager(org_id));
create policy clauses_select on public.template_clauses for select to authenticated
  using (org_id is null or public.is_member(org_id));
create policy clauses_manager_write on public.template_clauses for all to authenticated
  using (org_id is not null and public.is_manager(org_id)) with check (org_id is not null and public.is_manager(org_id));

-- ---------------------------------------------------------------- audit & sequences
create policy audit_manager_select on public.audit_log for select to authenticated using (public.is_manager(org_id));
-- number_sequences: no policies; accessed only via next_number() (security definer).

-- ---------------------------------------------------------------- per-user tables
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(org_id));
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy prefs_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(org_id));
create policy settings_own on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- owner portal (read-only, own properties)
create policy owner_properties on public.properties for select to authenticated using (public.owner_can_see_property(id));
create policy owner_units on public.units for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_property_owners on public.property_owners for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_commissions on public.property_commissions for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_self on public.owners for select to authenticated using (portal_user_id = auth.uid());
create policy owner_contracts on public.contracts for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_contract_units on public.contract_units for select to authenticated using (public.owner_can_see_contract(contract_id));
create policy owner_charges on public.charges for select to authenticated using (public.owner_can_see_contract(contract_id));
create policy owner_payments on public.payments for select to authenticated using (public.owner_can_see_contract(contract_id));
create policy owner_adjustments on public.adjustments for select to authenticated using (public.owner_can_see_contract(contract_id));
create policy owner_allocations on public.payment_allocations for select to authenticated using (
  exists (select 1 from public.payments p where p.id = payment_id and public.owner_can_see_contract(p.contract_id))
);
create policy owner_tenants on public.tenants for select to authenticated using (
  exists (select 1 from public.contracts c where c.tenant_id = tenants.id and public.owner_can_see_property(c.property_id))
);
create policy owner_deposits on public.deposits for select to authenticated using (
  owner_id in (select id from public.owners where portal_user_id = auth.uid())
  or exists (select 1 from public.deposit_properties dp where dp.deposit_id = deposits.id and public.owner_can_see_property(dp.property_id))
);
create policy owner_deposit_properties on public.deposit_properties for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_expense_allocations on public.expense_allocations for select to authenticated using (public.owner_can_see_property(property_id));
create policy owner_expense_lines on public.expense_lines for select to authenticated using (
  exists (select 1 from public.expense_allocations ea where ea.expense_line_id = expense_lines.id and public.owner_can_see_property(ea.property_id))
);
create policy owner_expense_vouchers on public.expense_vouchers for select to authenticated using (
  status = 'posted' and exists (
    select 1 from public.expense_lines el join public.expense_allocations ea on ea.expense_line_id = el.id
    where el.voucher_id = expense_vouchers.id and public.owner_can_see_property(ea.property_id)
  )
);
create policy owner_categories on public.expense_categories for select to authenticated
  using (public.has_role(org_id, array['owner']::public.member_role[]));
create policy owner_attachments on public.attachments for select to authenticated using (
  public.has_role(org_id, array['owner']::public.member_role[])
  and entity_type = 'property' and public.owner_can_see_property(entity_id)
);

-- ---------------------------------------------------------------- grants for views/functions
revoke execute on function public.next_number(uuid, text, int) from public, anon;
revoke execute on function public.create_org(text, text) from public, anon;
revoke execute on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.next_number(uuid, text, int) to authenticated, service_role;
grant execute on function public.create_org(text, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.is_period_closed(uuid, text) to authenticated;
