-- NULL preserves office-wide access for existing members; [] explicitly grants no properties.
alter table public.org_members add column property_ids uuid[];
update public.org_members set property_ids='{}' where role='collector';
create function public.staff_all_properties(p_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.org_members where org_id=p_org and user_id=auth.uid() and active and (role='admin' or (role<>'owner' and property_ids is null)));
$$;
create function public.staff_can_property(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.properties p join public.org_members m on m.org_id=p.org_id where p.id=p_id and m.user_id=auth.uid() and m.active and m.role<>'owner' and (m.role='admin' or m.property_ids is null or p_id=any(m.property_ids)));
$$;
create function public.staff_can_contract(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contracts where id=p_id and public.staff_can_property(property_id));
$$;
create function public.staff_can_tenant(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contracts c where (c.tenant_id=p_id or p_id=any(c.co_tenant_ids)) and public.staff_can_property(c.property_id))
 or exists(select 1 from public.tenants t where t.id=p_id and t.created_by=auth.uid() and public.is_staff(t.org_id) and not exists(select 1 from public.contracts c where c.tenant_id=p_id or p_id=any(c.co_tenant_ids)));
$$;
create function public.scope_allows(p_org uuid,p_table text,p_row jsonb) returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_id uuid; v_parent uuid;
begin
 -- Existing permissive policies still determine role capabilities. Portal rules remain independent.
 if public.has_role(p_org,array['owner']::public.member_role[]) then return true; end if;
 if public.staff_all_properties(p_org) then return true; end if;
 if not public.is_staff(p_org) then return false; end if;
 v_id:=(p_row->>'id')::uuid;
 if p_table='properties' then return public.staff_can_property(v_id); end if;
 if p_row ? 'property_id' then return public.staff_can_property((p_row->>'property_id')::uuid); end if;
 if p_table='tenants' then return public.staff_can_tenant(v_id); end if;
 if p_table='owners' then return exists(select 1 from public.property_owners po where po.owner_id=v_id and public.staff_can_property(po.property_id)); end if;
 if p_table='contracts' then return public.staff_can_property((p_row->>'property_id')::uuid); end if;
 if p_row ? 'contract_id' then return public.staff_can_contract((p_row->>'contract_id')::uuid); end if;
 if p_row ? 'tenant_id' then return public.staff_can_tenant((p_row->>'tenant_id')::uuid); end if;
 if p_table='payment_allocations' then return exists(select 1 from public.payments p where p.id=(p_row->>'payment_id')::uuid and public.staff_can_contract(p.contract_id)); end if;
 if p_table='expense_vouchers' then
  return ((p_row->>'created_by')::uuid=auth.uid() and not exists(select 1 from public.expense_lines l where l.voucher_id=v_id))
  or (exists(select 1 from public.expense_lines l join public.expense_allocations a on a.expense_line_id=l.id where l.voucher_id=v_id)
      and not exists(select 1 from public.expense_lines l join public.expense_allocations a on a.expense_line_id=l.id where l.voucher_id=v_id and not public.staff_can_property(a.property_id)));
 end if;
 if p_table='expense_lines' then
  return exists(select 1 from public.expense_vouchers v where v.id=(p_row->>'voucher_id')::uuid and (public.scope_allows(p_org,'expense_vouchers',to_jsonb(v)) or (v.created_by=auth.uid() and not exists(select 1 from public.expense_allocations a where a.expense_line_id=v_id))));
 end if;
 if p_table='deposits' then return exists(select 1 from public.deposit_properties dp where dp.deposit_id=v_id) and not exists(select 1 from public.deposit_properties dp where dp.deposit_id=v_id and not public.staff_can_property(dp.property_id)); end if;
 if p_table='legal_case_events' then return exists(select 1 from public.legal_cases c where c.id=(p_row->>'case_id')::uuid and public.staff_can_contract(c.contract_id)); end if;
 if p_table='attachments' then
  if p_row->>'entity_type'='property' then return public.staff_can_property((p_row->>'entity_id')::uuid); end if;
  if p_row->>'entity_type'='unit' then return exists(select 1 from public.units u where u.id=(p_row->>'entity_id')::uuid and public.staff_can_property(u.property_id)); end if;
  if p_row->>'entity_type'='tenant' then return public.staff_can_tenant((p_row->>'entity_id')::uuid); end if;
  if p_row->>'entity_type'='contract' then return public.staff_can_contract((p_row->>'entity_id')::uuid); end if;
  if p_row->>'entity_type'='payment' then return exists(select 1 from public.payments p where p.id=(p_row->>'entity_id')::uuid and public.staff_can_contract(p.contract_id)); end if;
  if p_row->>'entity_type'='voucher' then return exists(select 1 from public.expense_vouchers v where v.id=(p_row->>'entity_id')::uuid and public.scope_allows(v.org_id,'expense_vouchers',to_jsonb(v))); end if;
  return false;
 end if;
 return false;
end $$;
-- Restrictive policies AND with every existing permissive role policy, on reads and writes.
do $$ declare t text; begin
 foreach t in array array['properties','property_owners','property_commissions','units','tenants','owners','contracts','contract_units','contract_rent_revisions','charges','payments','payment_allocations','adjustments','legal_cases','legal_case_events','expense_vouchers','expense_lines','expense_allocations','deposits','deposit_properties','reminders_log','attachments','contract_discounts','unit_restructures'] loop
  execute format('create policy property_scope on public.%1$I as restrictive for all to authenticated using(public.scope_allows(org_id,%2$L,to_jsonb(%1$I))) with check(public.scope_allows(org_id,%2$L,to_jsonb(%1$I)))',t,t);
 end loop;
end $$;
create function public.entry_owns_voucher(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.expense_vouchers v where v.id=p_id and v.created_by=auth.uid() and public.has_role(v.org_id,array['collector']::public.member_role[]));
$$;
create function public.entry_owns_line(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.expense_lines l where l.id=p_id and public.entry_owns_voucher(l.voucher_id));
$$;
-- Entry-only collectors can INSERT their own expense documents, never UPDATE or DELETE.
create policy entry_vouchers_select on public.expense_vouchers for select to authenticated using(public.has_role(org_id,array['collector']::public.member_role[]));
create policy entry_lines_select on public.expense_lines for select to authenticated using(public.has_role(org_id,array['collector']::public.member_role[]));
create policy entry_allocations_select on public.expense_allocations for select to authenticated using(public.has_role(org_id,array['collector']::public.member_role[]));
create policy entry_categories_select on public.expense_categories for select to authenticated using(public.has_role(org_id,array['collector']::public.member_role[]));
create policy entry_beneficiaries_select on public.beneficiaries for select to authenticated using(public.has_role(org_id,array['collector']::public.member_role[]));
create policy entry_vouchers_insert on public.expense_vouchers for insert to authenticated with check(public.has_role(org_id,array['collector']::public.member_role[]) and created_by=auth.uid() and status='posted');
create policy entry_lines_insert on public.expense_lines for insert to authenticated with check(public.has_role(org_id,array['collector']::public.member_role[]) and public.entry_owns_voucher(voucher_id));
create policy entry_allocations_insert on public.expense_allocations for insert to authenticated with check(public.has_role(org_id,array['collector']::public.member_role[]) and public.entry_owns_line(expense_line_id));
-- Do not expose other staff members' property assignments to collectors.
drop policy members_select on public.org_members;
create policy members_select on public.org_members for select to authenticated using(user_id=auth.uid() or public.has_role(org_id,array['admin','accountant']::public.member_role[]));
-- Scope financial views are security_invoker; underlying policies apply automatically.

-- Apply property scope to private objects too, including signed-URL creation.
create function public.scoped_object_allowed(p_bucket text,p_name text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_parts text[]; v_org uuid; v_id uuid; v_entity text;
begin
 v_parts:=string_to_array(p_name,'/');
 if v_parts[1] !~* '^[0-9a-f-]{36}$' then return false; end if;
 v_org:=v_parts[1]::uuid;
 if not public.is_member(v_org) then return false; end if;
 if p_bucket='branding' or public.staff_all_properties(v_org) then return true; end if;
 if v_parts[3] !~* '^[0-9a-f-]{36}$' then return false; end if;
 v_id:=v_parts[3]::uuid; v_entity:=v_parts[2];
 if public.has_role(v_org,array['owner']::public.member_role[]) then
  if v_entity='property' then return public.owner_can_see_property(v_id); end if;
  if v_entity='unit' then return exists(select 1 from public.units u where u.id=v_id and public.owner_can_see_property(u.property_id)); end if;
  if v_entity='contract' then return public.owner_can_see_contract(v_id); end if;
  if v_entity='payment' then return exists(select 1 from public.payments p where p.id=v_id and public.owner_can_see_contract(p.contract_id)); end if;
  return false;
 end if;
 if v_entity='property' then return public.staff_can_property(v_id); end if;
 if v_entity='unit' then return exists(select 1 from public.units u where u.id=v_id and public.staff_can_property(u.property_id)); end if;
 if v_entity='tenant' then return public.staff_can_tenant(v_id); end if;
 if v_entity='contract' then return public.staff_can_contract(v_id); end if;
 if v_entity='payment' then return exists(select 1 from public.payments p where p.id=v_id and public.staff_can_contract(p.contract_id)); end if;
 if v_entity='voucher' then return exists(select 1 from public.expense_vouchers v where v.id=v_id and public.scope_allows(v.org_id,'expense_vouchers',to_jsonb(v))); end if;
 return false;
exception when invalid_text_representation then return false;
end $$;
create policy property_object_scope on storage.objects as restrictive for all to authenticated
 using(public.scoped_object_allowed(bucket_id,name)) with check(public.scoped_object_allowed(bucket_id,name));

-- Parent IDs cannot cross organisations, even when guessed through a direct API request.
create function public.validate_org_references() returns trigger language plpgsql security definer set search_path=public as $$
declare i int; ref_id uuid; ref_org uuid;
begin
 for i in 0..tg_nargs/2-1 loop
  ref_id:=(to_jsonb(new)->>tg_argv[i*2])::uuid;
  if ref_id is null then continue; end if;
  execute format('select org_id from public.%I where id=$1',tg_argv[i*2+1]) into ref_org using ref_id;
  if ref_org is distinct from new.org_id then raise exception 'cross_org_reference' using errcode='23514'; end if;
 end loop;
 return new;
end $$;
create trigger validate_contract_org before insert or update on public.contracts for each row execute function public.validate_org_references('property_id','properties','tenant_id','tenants','owner_id','owners');
create trigger validate_payment_org before insert or update on public.payments for each row execute function public.validate_org_references('contract_id','contracts','tenant_id','tenants');
create trigger validate_charge_org before insert or update on public.charges for each row execute function public.validate_org_references('contract_id','contracts');
create trigger validate_allocation_org before insert or update on public.payment_allocations for each row execute function public.validate_org_references('payment_id','payments','charge_id','charges');
create trigger validate_expense_line_org before insert or update on public.expense_lines for each row execute function public.validate_org_references('voucher_id','expense_vouchers','category_id','expense_categories','beneficiary_id','beneficiaries');
create trigger validate_expense_allocation_org before insert or update on public.expense_allocations for each row execute function public.validate_org_references('expense_line_id','expense_lines','property_id','properties','unit_id','units');
create function public.validate_allocation_contract() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.payments p join public.charges c on c.contract_id=p.contract_id where p.id=new.payment_id and c.id=new.charge_id) then raise exception 'allocation_contract_mismatch' using errcode='23514'; end if;
 return new;
end $$;
create trigger validate_allocation_contract before insert or update on public.payment_allocations for each row execute function public.validate_allocation_contract();

-- Owner portals can also read the named joint tenants of their own leases.
drop policy owner_tenants on public.tenants;
create policy owner_tenants on public.tenants for select to authenticated using (
 exists(select 1 from public.contracts c where (c.tenant_id=tenants.id or tenants.id=any(c.co_tenant_ids)) and public.owner_can_see_property(c.property_id))
);

-- Revoking office membership also revokes owner-portal access with an existing JWT.
create or replace function public.owner_property_ids() returns setof uuid language sql stable security definer set search_path=public as $$
 select po.property_id from public.property_owners po
 join public.owners o on o.id=po.owner_id
 join public.org_members m on m.org_id=po.org_id and m.user_id=auth.uid() and m.active and m.role='owner'
 where o.portal_user_id=auth.uid();
$$;
create policy collector_payment_identity on public.payments as restrictive for insert to authenticated with check(
 not public.has_role(org_id,array['collector']::public.member_role[])
 or (created_by=auth.uid() and coalesce(collected_by,auth.uid())=auth.uid())
);
create policy scoped_audit on public.audit_log as restrictive for select to authenticated using(
 public.staff_all_properties(org_id) or public.scope_allows(org_id,entity_type,coalesce(after,before))
);
create policy scoped_reconciliations on public.cash_reconciliations as restrictive for all to authenticated
 using(public.staff_all_properties(org_id)) with check(public.staff_all_properties(org_id));
create function public.entry_owns_payment(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.payments p where p.id=p_id and p.created_by=auth.uid() and public.has_role(p.org_id,array['collector']::public.member_role[]));
$$;
create policy entry_attachments on public.attachments as restrictive for insert to authenticated with check(
 not public.has_role(org_id,array['collector']::public.member_role[])
 or (entity_type='payment' and public.entry_owns_payment(entity_id))
 or (entity_type='voucher' and public.entry_owns_voucher(entity_id))
);
-- Previously delivered notifications may mention now-unassigned properties.
delete from public.notifications n using public.org_members m
 where n.org_id=m.org_id and n.user_id=m.user_id and m.role='collector' and m.property_ids is not null;
