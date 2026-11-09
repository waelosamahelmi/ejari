-- Client workflows: structured parties, joint leases, safe tenant removal and unit restructuring.
alter table public.tenants
  add column party_type text not null default 'individual' check (party_type in ('individual','company')),
  add column licence_no text,
  add column signatory_name text,
  add column signatory_civil_id text check (signatory_civil_id is null or signatory_civil_id ~ '^\d{12}$'),
  add column archived_at timestamptz;
alter table public.contracts add column co_tenant_ids uuid[] not null default '{}', add column initial_discount jsonb;
create index contracts_co_tenants on public.contracts using gin(co_tenant_ids);

create function public.validate_joint_tenants() returns trigger language plpgsql set search_path=public as $$
begin
  perform 1 from public.tenants where id=new.tenant_id or id=any(new.co_tenant_ids) order by id for share;
  if not exists(select 1 from public.tenants where id=new.tenant_id and org_id=new.org_id and archived_at is null) then raise exception 'invalid primary tenant' using errcode='23514'; end if;
  if cardinality(new.co_tenant_ids)>20 or new.tenant_id=any(new.co_tenant_ids)
     or cardinality(new.co_tenant_ids) <> (select count(distinct t) from unnest(new.co_tenant_ids) t)
     or exists(select 1 from unnest(new.co_tenant_ids) x where not exists(select 1 from public.tenants t where t.id=x and t.org_id=new.org_id and t.archived_at is null)) then
    raise exception 'invalid joint tenants' using errcode='23514';
  end if;
  return new;
end $$;
create trigger validate_joint_tenants before insert or update of co_tenant_ids,tenant_id on public.contracts for each row execute function public.validate_joint_tenants();

alter table public.units add column retired_on date;

-- Keep old units for history. Reusing an inactive unit's label is allowed.
alter table public.units drop constraint units_property_id_label_key;
create unique index units_active_label_unique on public.units(property_id,lower(trim(label))) where active;
create table public.unit_restructures (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.orgs on delete cascade,
 property_id uuid not null references public.properties, source_ids uuid[] not null, result_ids uuid[] not null,
 reason text not null, created_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid()
);
alter table public.unit_restructures enable row level security;
create policy restructure_read on public.unit_restructures for select to authenticated using(public.is_staff(org_id));

create function public.restructure_units(p_property uuid,p_sources uuid[],p_units jsonb,p_reason text) returns uuid[]
language plpgsql security invoker set search_path=public as $$
declare v_org uuid; v_count int; v_unit jsonb; v_id uuid; v_ids uuid[]:='{}'; v_sort int;
begin
 select org_id into strict v_org from public.properties where id=p_property;
 if not public.is_manager(v_org) or length(trim(p_reason))=0 then raise exception 'forbidden'; end if;
 if cardinality(p_sources)<1 or jsonb_array_length(p_units)<1 or jsonb_array_length(p_units)>200
    or (cardinality(p_sources)=1 and jsonb_array_length(p_units)=1) then raise exception 'invalid restructure'; end if;
 perform 1 from public.units where id=any(p_sources) order by id for update;
 select count(*) into v_count from public.units where id=any(p_sources) and property_id=p_property and active;
 if v_count<>cardinality(p_sources) then raise exception 'invalid source units'; end if;
 -- Lock referenced contracts too; planned and draft leases must be resolved first.
 perform 1 from public.contracts c join public.contract_units cu on cu.contract_id=c.id where cu.unit_id=any(p_sources) for update of c;
 if exists(select 1 from public.contract_units cu join public.contracts c on c.id=cu.contract_id where cu.unit_id=any(p_sources) and c.status in ('draft','active','notice_given')) then raise exception 'units_have_live_contracts'; end if;
 select coalesce(max(sort_order),0) into v_sort from public.units where property_id=p_property;
 update public.units set active=false,retired_on=(now() at time zone 'Asia/Kuwait')::date where id=any(p_sources);
 for v_unit in select value from jsonb_array_elements(p_units) loop
  v_sort:=v_sort+1;
  if length(trim(v_unit->>'label'))=0 or (v_unit->>'askingRentFils')::bigint<0 then raise exception 'invalid unit'; end if;
  insert into public.units(org_id,property_id,label,type,floor,paci_no,asking_rent_fils,area_m2,sort_order,available_since)
  values(v_org,p_property,trim(v_unit->>'label'),(v_unit->>'type')::public.unit_type,
    (v_unit->>'floor')::int,nullif(v_unit->>'paciNo',''),(v_unit->>'askingRentFils')::bigint,(v_unit->>'areaM2')::numeric,v_sort,(now() at time zone 'Asia/Kuwait')::date) returning id into v_id;
  v_ids:=array_append(v_ids,v_id);
 end loop;
 insert into public.unit_restructures(org_id,property_id,source_ids,result_ids,reason) values(v_org,p_property,p_sources,v_ids,trim(p_reason));
 return v_ids;
end $$;
create policy restructure_insert on public.unit_restructures for insert to authenticated with check(public.is_manager(org_id));
create trigger audit_unit_restructures after insert on public.unit_restructures for each row execute function public.audit_row();
revoke all on function public.restructure_units(uuid,uuid[],jsonb,text) from public,anon;
grant execute on function public.restructure_units(uuid,uuid[],jsonb,text) to authenticated;

-- Temporary concessions are separate from contractual rent, applied to existing and future charges.
create table public.contract_discounts (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.orgs on delete cascade,
 contract_id uuid not null references public.contracts, from_period text not null check(from_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 to_period text not null check(to_period ~ '^\d{4}-(0[1-9]|1[0-2])$'), amount_fils bigint not null check(amount_fils>0),
 reason text not null check(length(trim(reason))>0), created_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(),
 check(to_period>=from_period)
);

alter table public.adjustments add column discount_id uuid references public.contract_discounts;
create unique index adjustments_discount_charge on public.adjustments(discount_id,charge_id) where discount_id is not null;
alter table public.contract_discounts enable row level security;
create policy discount_read on public.contract_discounts for select to authenticated using(public.is_staff(org_id) or public.owner_can_see_contract(contract_id));
create policy discount_insert on public.contract_discounts for insert to authenticated with check(public.is_manager(org_id));
create trigger audit_discounts after insert on public.contract_discounts for each row execute function public.audit_row();

create function public.apply_discount_to_charge(p_charge uuid,p_discount uuid) returns void language plpgsql security definer set search_path=public as $$
declare ch public.charges; d public.contract_discounts; v_adjusted bigint; v_surplus bigint; a record; v_release bigint;
begin
 select * into strict ch from public.charges where id=p_charge for update;
 select * into strict d from public.contract_discounts where id=p_discount;
 if ch.contract_id<>d.contract_id or ch.org_id<>d.org_id or ch.kind<>'rent' or ch.voided or ch.period not between d.from_period and d.to_period then return; end if;
 if exists(select 1 from public.adjustments where charge_id=ch.id and discount_id=d.id) then return; end if;
 select coalesce(sum(amount_fils),0) into v_adjusted from public.adjustments where charge_id=ch.id;
 if v_adjusted+d.amount_fils>ch.amount_fils then raise exception 'discount_exceeds_rent'; end if;
 insert into public.adjustments(org_id,contract_id,charge_id,kind,amount_fils,reason,adjustment_date,approved_by,discount_id)
 values(ch.org_id,ch.contract_id,ch.id,'discount',d.amount_fils,d.reason,ch.due_date,d.created_by,d.id);
 select greatest(0,coalesce(sum(amount_fils),0)-(ch.amount_fils-v_adjusted-d.amount_fils)) into v_surplus from public.payment_allocations where charge_id=ch.id;
 for a in select id,amount_fils from public.payment_allocations where charge_id=ch.id order by created_at desc,id desc for update loop
  exit when v_surplus<=0;
  v_release:=least(v_surplus,a.amount_fils);
  if v_release=a.amount_fils then delete from public.payment_allocations where id=a.id;
  else update public.payment_allocations set amount_fils=amount_fils-v_release where id=a.id; end if;
  v_surplus:=v_surplus-v_release;
 end loop;

end $$;
revoke all on function public.apply_discount_to_charge(uuid,uuid) from public,anon,authenticated;

create function public.discount_created() returns trigger language plpgsql security definer set search_path=public as $$
declare ch record; v_rent bigint; v_start date; v_end date;
begin
 select monthly_rent_fils,first_collection_date,end_date into strict v_rent,v_start,v_end from public.contracts where id=new.contract_id and org_id=new.org_id for update;
 if new.from_period < to_char(v_start,'YYYY-MM') or new.to_period > to_char(v_end,'YYYY-MM') then raise exception 'discount_period_outside_contract'; end if;
 if new.amount_fils>v_rent then raise exception 'discount_exceeds_rent'; end if;
 if exists(select 1 from public.contract_discounts d where d.contract_id=new.contract_id and d.id<>new.id and d.from_period<=new.to_period and d.to_period>=new.from_period) then raise exception 'overlapping_discount'; end if;
 for ch in select id from public.charges where contract_id=new.contract_id and kind='rent' and not voided and period between new.from_period and new.to_period loop
  perform public.apply_discount_to_charge(ch.id,new.id);
 end loop;
 return new;
end $$;
create trigger apply_new_discount after insert on public.contract_discounts for each row execute function public.discount_created();
create function public.discount_charge_created() returns trigger language plpgsql security definer set search_path=public as $$
declare d record;
begin
 for d in select id from public.contract_discounts where contract_id=new.contract_id and new.period between from_period and to_period loop
  perform public.apply_discount_to_charge(new.id,d.id);
 end loop;
 return new;
end $$;
create trigger apply_charge_discounts after insert on public.charges for each row when(new.kind='rent' and not new.voided) execute function public.discount_charge_created();

-- Add optional structured-party lines to the system templates. Existing snapshots remain frozen.
update public.contract_templates set preamble=replace(preamble,
 'حيث إن الطرف الأول يستغل {{property_description}}',
 '{{#tenant_licence_no}}رقم الترخيص: {{tenant_licence_no}}{{/tenant_licence_no}}' || chr(10) ||
 '{{#tenant_signatory_name}}المفوض بالتوقيع: {{tenant_signatory_name}}{{#tenant_signatory_civil_id}}، رقم مدني: {{tenant_signatory_civil_id}}{{/tenant_signatory_civil_id}}{{/tenant_signatory_name}}' || chr(10) ||
 '{{#co_tenants}}المستأجرون الإضافيون: {{co_tenants}}{{/co_tenants}}' || chr(10) ||
 'حيث إن الطرف الأول يستغل {{property_description}}')
where org_id is null and preamble not like '%tenant_licence_no%';

create function public.activate_initial_discount() returns trigger language plpgsql set search_path=public as $$
begin
 if new.initial_discount is not null then
  insert into public.contract_discounts(org_id,contract_id,from_period,to_period,amount_fils,reason)
  values(new.org_id,new.id,new.initial_discount->>'fromPeriod',new.initial_discount->>'toPeriod',(new.initial_discount->>'amountFils')::bigint,new.initial_discount->>'reason');
 end if;
 return new;
end $$;
create trigger initial_discount_activation after update of status on public.contracts for each row
 when(old.status='draft' and new.status='active') execute function public.activate_initial_discount();

create function public.guard_tenant_removal() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' and exists(select 1 from public.contracts c where old.id=any(c.co_tenant_ids)) then raise exception 'tenant_has_history' using errcode='23503'; end if;
 if exists(select 1 from public.contracts c where (c.tenant_id=old.id or old.id=any(c.co_tenant_ids)) and c.status in ('draft','active','notice_given')) then raise exception 'tenant_has_live_contract'; end if;
 return coalesce(new,old);
end $$;
create trigger guard_tenant_archive before update of archived_at on public.tenants for each row when(new.archived_at is not null and old.archived_at is null) execute function public.guard_tenant_removal();
create trigger guard_tenant_delete before delete on public.tenants for each row execute function public.guard_tenant_removal();

create function public.guard_active_unit_link() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.units where id=new.unit_id and active for share;
 if not found then raise exception 'inactive_unit'; end if;
 return new;
end $$;
create trigger guard_active_unit before insert on public.contract_units for each row execute function public.guard_active_unit_link();

alter table public.contracts alter column notice_period_months set default 0;
