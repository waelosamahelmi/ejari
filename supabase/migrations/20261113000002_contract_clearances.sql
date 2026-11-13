create table public.contract_clearances (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.orgs(id) on delete cascade,
 contract_id uuid not null unique references public.contracts(id) on delete cascade,
 property_id uuid not null references public.properties(id),
 unit_ids uuid[] not null,
 issued_at date not null default (now() at time zone 'Asia/Kuwait')::date,
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users default auth.uid()
);
alter table public.contract_clearances enable row level security;
create policy clearance_read on public.contract_clearances for select to authenticated using (
 (public.is_staff(org_id) and public.staff_can_property(property_id)) or public.owner_can_see_property(property_id)
);
create trigger audit_clearances after insert on public.contract_clearances for each row execute function public.audit_row();

-- Only a manager of the visible lease can freeze a clearance. The snapshot is never updated.
create function public.issue_contract_clearance(p_contract uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare c public.contracts; p public.properties; v_id uuid; v_units jsonb; v_unit_ids uuid[]; v_owners jsonb; v_tenants jsonb; v_last date;
begin
 select * into strict c from public.contracts where id=p_contract for update;
 if coalesce(auth.role(),'') <> 'service_role' and not (public.is_manager(c.org_id) and public.staff_can_contract(c.id)) then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if c.status <> 'terminated' then raise exception 'contract_not_terminated' using errcode='23514'; end if;
 select id into v_id from public.contract_clearances where contract_id=c.id;
 if v_id is not null then return v_id; end if;
 select * into strict p from public.properties where id=c.property_id and org_id=c.org_id;
 select coalesce(jsonb_agg(jsonb_build_object('label',u.label,'type',u.type) order by u.sort_order,u.id),'[]'::jsonb),coalesce(array_agg(u.id),'{}'::uuid[])
 into v_units,v_unit_ids from public.contract_units cu join public.units u on u.id=cu.unit_id where cu.contract_id=c.id and u.org_id=c.org_id;
 select coalesce(jsonb_agg(full_name order by full_name),'[]'::jsonb) into v_owners from public.owners o
 where o.org_id=c.org_id and (o.id=c.owner_id or (c.owner_id is null and exists(select 1 from public.property_owners po where po.property_id=p.id and po.owner_id=o.id)));
 select coalesce(jsonb_agg(full_name order by (id=c.tenant_id) desc,full_name),'[]'::jsonb) into v_tenants from public.tenants t
 where t.org_id=c.org_id and (t.id=c.tenant_id or t.id=any(c.co_tenant_ids));
 select max(received_at) into v_last from public.payments where contract_id=c.id and not voided and notes is distinct from 'تسوية مبلغ التأمين عند الإخلاء';
 insert into public.contract_clearances(org_id,contract_id,property_id,unit_ids,snapshot)
 values(c.org_id,c.id,p.id,v_unit_ids,jsonb_build_object(
  'version',1,'contractNo',c.contract_no,'propertyName',p.name,'address',jsonb_build_object('governorate',p.governorate,'area',p.area,'block',p.block,'street',p.street,'avenue',p.avenue,'house_or_plot',p.house_or_plot,'paci_no',p.paci_no),
  'ownerNames',v_owners,'tenantNames',v_tenants,'units',v_units,'moveOutDate',c.move_out_date,'lastPaymentDate',v_last,'reason',c.termination_reason)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.issue_contract_clearance(uuid) from public,anon;
grant execute on function public.issue_contract_clearance(uuid) to authenticated,service_role;
create function public.freeze_termination_clearance() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform public.issue_contract_clearance(new.id);
 return new;
end $$;
create trigger freeze_termination_clearance after update of status on public.contracts for each row
 when(old.status is distinct from new.status and new.status='terminated') execute function public.freeze_termination_clearance();
