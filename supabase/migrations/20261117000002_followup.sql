-- Separate water responsibility; NULL preserves the legacy joint utilities party.
alter table public.contracts add column water_party text check(water_party in ('owner','tenant'));
alter table public.units add column type_label text check(type_label is null or (type='other' and length(btrim(type_label)) between 1 and 60));
drop index public.units_active_type_label;
create unique index units_active_type_label on public.units(property_id,type,lower(btrim(coalesce(type_label,''))),lower(btrim(label))) where active;
-- A lease cancelled before possession has no occupancy, rather than a reversed range.
create or replace function public.sync_contract_units() returns trigger language plpgsql as $$
begin
 update public.contract_units set occupancy=case when least(new.end_date,coalesce(new.move_out_date,new.end_date))<new.start_date then 'empty'::daterange else daterange(new.start_date,least(new.end_date,coalesce(new.move_out_date,new.end_date)),'[]') end,is_live=new.status in ('active','notice_given') where contract_id=new.id;
 return new;
end $$;
create or replace function public.init_contract_unit() returns trigger language plpgsql as $$
declare c record;
begin
 select start_date,end_date,move_out_date,status into c from public.contracts where id=new.contract_id;
 new.occupancy:=case when least(c.end_date,coalesce(c.move_out_date,c.end_date))<c.start_date then 'empty'::daterange else daterange(c.start_date,least(c.end_date,coalesce(c.move_out_date,c.end_date)),'[]') end;
 new.is_live:=c.status in ('active','notice_given');return new;
end $$;
-- Amend future template rendering; signed snapshots remain frozen.
update public.template_clauses set body='{{#utilities_split}}تأمين الكهرباء واستهلاك الكهرباء من حساب {{utilities_party_label}}، وتأمين الماء واستهلاك الماء من حساب {{water_party_label}}.{{#electricity_fixed_amount}} ويلتزم الطرف الثاني بسداد مبلغ الكهرباء الثابت {{electricity_fixed_amount}} دينار شهريًا.{{/electricity_fixed_amount}}{{/utilities_split}}{{^utilities_split}}' || body || '{{/utilities_split}}' where key='utilities' and body not like '%water_party_label%';
create or replace function public.issue_contract_clearance(p_contract uuid) returns uuid
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
 select coalesce(jsonb_agg(jsonb_build_object('label',u.label,'type',u.type,'typeLabel',u.type_label) order by u.sort_order,u.id),'[]'::jsonb),coalesce(array_agg(u.id),'{}'::uuid[])
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
create or replace function public.restructure_units(p_property uuid,p_sources uuid[],p_units jsonb,p_reason text) returns uuid[]
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
  insert into public.units(org_id,property_id,label,type,type_label,floor,paci_no,asking_rent_fils,area_m2,sort_order,available_since)
  values(v_org,p_property,trim(v_unit->>'label'),(v_unit->>'type')::public.unit_type,case when v_unit->>'type'='other' then nullif(btrim(v_unit->>'typeLabel'),'') end,
    (v_unit->>'floor')::int,nullif(v_unit->>'paciNo',''),(v_unit->>'askingRentFils')::bigint,(v_unit->>'areaM2')::numeric,v_sort,(now() at time zone 'Asia/Kuwait')::date) returning id into v_id;
  v_ids:=array_append(v_ids,v_id);
 end loop;
 insert into public.unit_restructures(org_id,property_id,source_ids,result_ids,reason) values(v_org,p_property,p_sources,v_ids,trim(p_reason));
 return v_ids;
end $$;
