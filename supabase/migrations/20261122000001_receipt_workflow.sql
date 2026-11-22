-- Owner numbering and prepared (uncollected) collection documents are separate from payments.
alter table public.payments add column owner_id uuid references public.owners(id);
alter table public.expense_vouchers add column owner_id uuid references public.owners(id);
alter table public.expense_vouchers drop constraint expense_vouchers_org_id_voucher_no_key;
create unique index voucher_owner_number on public.expense_vouchers(org_id,owner_id,voucher_no) where owner_id is not null;
create unique index payment_owner_number on public.payments(org_id,owner_id,receipt_no) where owner_id is not null;
create table public.owner_document_sequences(org_id uuid not null references public.orgs(id) on delete cascade,owner_id uuid not null references public.owners(id),kind text not null check(kind in ('receipt','voucher')),year int not null,last_value bigint not null default 0,primary key(org_id,owner_id,kind,year));
alter table public.owner_document_sequences enable row level security;
create table public.collection_receipts(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.orgs(id) on delete cascade,owner_id uuid not null references public.owners(id),property_id uuid not null references public.properties(id),contract_id uuid not null references public.contracts(id),period text not null check(period~'^\d{4}-(0[1-9]|1[0-2])$'),document_no text not null,amount_fils bigint not null check(amount_fils>0),snapshot jsonb not null,status text not null default 'prepared' check(status in ('prepared','collected','void')),payment_id uuid unique references public.payments(id),void_reason text,created_at timestamptz not null default now(),created_by uuid references auth.users default auth.uid(),unique(org_id,owner_id,document_no)
);
create unique index collection_receipt_live on public.collection_receipts(contract_id,period) where status<>'void';
alter table public.collection_receipts enable row level security;
create policy collection_receipt_read on public.collection_receipts for select to authenticated using((public.is_staff(org_id) and public.staff_can_property(property_id)) or public.owner_can_see_property(property_id));
create trigger audit_collection_receipts after insert or update on public.collection_receipts for each row execute function public.audit_row();
alter table public.payments add column collection_receipt_id uuid unique references public.collection_receipts(id);

create function public.document_owner(p_contract uuid) returns uuid language sql stable security definer set search_path=public as $$
 select coalesce(c.owner_id,(select po.owner_id from public.property_owners po where po.property_id=c.property_id order by share_pct desc,owner_id limit 1)) from public.contracts c where c.id=p_contract;
$$;
revoke all on function public.document_owner(uuid) from public,anon,authenticated;
create function public.next_owner_document(p_org uuid,p_owner uuid,p_kind text,p_year int) returns text language plpgsql security definer set search_path=public as $$
declare n bigint; prefix text; initial_value bigint:=0;
begin
 if not exists(select 1 from public.owners where id=p_owner and org_id=p_org) then raise exception 'owner_required'; end if;
 select coalesce(settings->'numbering'->>p_kind,case when p_kind='receipt' then 'RC' else 'EX' end) into prefix from public.orgs where id=p_org;
 if prefix !~ '^[A-Z]{1,4}$' then prefix:=case when p_kind='receipt' then 'RC' else 'EX' end;end if;
 if p_kind='receipt' then
  select coalesce(max(substring(coalesce(system_no,receipt_no) from '[0-9]+$')::bigint),0) into initial_value from public.payments where org_id=p_org and public.document_owner(contract_id)=p_owner and coalesce(system_no,receipt_no) ~ ('^[A-Z]{1,4}-'||p_year||'-[0-9]+$');
 else
  select coalesce(max(substring(v.voucher_no from '[0-9]+$')::bigint),0) into initial_value from public.expense_vouchers v where v.org_id=p_org and v.voucher_no ~ ('^[A-Z]{1,4}-'||p_year||'-[0-9]+$') and (v.owner_id=p_owner or (v.owner_id is null and exists(select 1 from public.expense_lines el join public.expense_allocations ea on ea.expense_line_id=el.id join public.property_owners po on po.property_id=ea.property_id where el.voucher_id=v.id and po.owner_id=p_owner)));
 end if;
 insert into public.owner_document_sequences(org_id,owner_id,kind,year,last_value) values(p_org,p_owner,p_kind,p_year,initial_value+1) on conflict(org_id,owner_id,kind,year) do update set last_value=owner_document_sequences.last_value+1 returning last_value into n;
 return prefix||'-'||p_year||'-'||lpad(n::text,greatest(5,length(n::text)),'0');
end $$;
revoke all on function public.next_owner_document(uuid,uuid,text,int) from public,anon,authenticated;
create function public.assign_owner_document() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.collection_receipts;
begin
 -- SQL seeds/imports retain their historical identifiers; all API inserts are numbered.
 if coalesce(auth.role(),'')='' then return new; end if;
 if tg_table_name='payments' then
  if not exists(select 1 from public.contracts where id=new.contract_id and org_id=new.org_id and tenant_id=new.tenant_id) then raise exception 'forbidden' using errcode='42501'; end if;
  new.owner_id:=public.document_owner(new.contract_id);
  if new.owner_id is null then raise exception 'owner_required'; end if;
  if new.collection_receipt_id is not null then
   select * into strict r from public.collection_receipts where id=new.collection_receipt_id for update;
   if r.org_id<>new.org_id or r.contract_id<>new.contract_id or r.owner_id<>new.owner_id or r.amount_fils<>new.amount_fils or r.status<>'prepared' then raise exception 'receipt_changed'; end if;
   new.receipt_no:=r.document_no;
  else new.receipt_no:=public.next_owner_document(new.org_id,new.owner_id,'receipt',extract(year from new.received_at)::int); end if;
  new.system_no:=new.receipt_no;
 else
  if new.owner_id is null then raise exception 'owner_required'; end if;
  if auth.role()<>'service_role' and not exists(select 1 from public.property_owners po where po.owner_id=new.owner_id and public.staff_can_property(po.property_id)) then raise exception 'forbidden' using errcode='42501';end if;
  new.voucher_no:=public.next_owner_document(new.org_id,new.owner_id,'voucher',extract(year from new.voucher_date)::int);
 end if;
 return new;
end $$;
create trigger assign_owner_document before insert on public.payments for each row execute function public.assign_owner_document();
create trigger assign_owner_document before insert on public.expense_vouchers for each row execute function public.assign_owner_document();

create function public.prepare_collection_receipt(p_contract uuid,p_period text) returns uuid language plpgsql security definer set search_path=public as $$
declare c public.contracts; o uuid; v_id uuid; amount bigint; periods jsonb; owner_name text; tenant_name text; property_name text; unit_labels text;
begin
 select * into strict c from public.contracts where id=p_contract for update;
 if not public.has_role(c.org_id,array['admin','accountant','collector']::public.member_role[]) or not public.staff_can_contract(c.id) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'validation'; end if;
 if c.status not in ('active','notice_given') or c.start_date> (to_date(p_period||'-01','YYYY-MM-DD')+interval '1 month -1 day')::date or least(c.end_date,coalesce(c.move_out_date,c.end_date))<to_date(p_period||'-01','YYYY-MM-DD') or not exists(select 1 from public.contract_units cu join public.units u on u.id=cu.unit_id where cu.contract_id=c.id and u.active) then raise exception 'contract_not_live'; end if;
 select id into v_id from public.collection_receipts where contract_id=c.id and period=p_period and status<>'void';
 if v_id is not null then return v_id; end if;
 select coalesce(sum(outstanding_fils),0),jsonb_agg(distinct period order by period) into amount,periods from public.v_charge_balances where contract_id=c.id and period<=p_period and outstanding_fils>0;
 if amount<=0 then raise exception 'nothing_due'; end if;
 o:=public.document_owner(c.id);if o is null then raise exception 'owner_required'; end if;
 select full_name into owner_name from public.owners where id=o;
 select full_name into tenant_name from public.tenants where id=c.tenant_id;
 select name into property_name from public.properties where id=c.property_id;
 select string_agg(coalesce(u.type_label,case u.type when 'apartment' then 'شقة' when 'shop' then 'محل' when 'studio' then 'استوديو' when 'office' then 'مكتب' when 'room' then 'غرفة' when 'basement' then 'سرداب' when 'basement_front_half' then 'نصف السرداب الأمامي' when 'basement_back_half' then 'نصف السرداب الخلفي' when 'roof' then 'السطح' when 'warehouse' then 'مخزن' when 'plot' then 'قسيمة' else 'وحدة' end)||' '||u.label,'، ' order by u.sort_order,u.id) into unit_labels from public.contract_units cu join public.units u on u.id=cu.unit_id where cu.contract_id=c.id;
 insert into public.collection_receipts(org_id,owner_id,property_id,contract_id,period,document_no,amount_fils,snapshot) values(c.org_id,o,c.property_id,c.id,p_period,public.next_owner_document(c.org_id,o,'receipt',extract(year from to_date(p_period||'-01','YYYY-MM-DD'))::int),amount,jsonb_build_object('ownerName',owner_name,'tenantName',tenant_name,'propertyName',property_name,'unitLabels',unit_labels,'periods',periods,'contractNo',c.contract_no)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.prepare_collection_receipt(uuid,text) from public,anon;
grant execute on function public.prepare_collection_receipt(uuid,text) to authenticated;

create function public.collect_prepared_receipt(p_receipt uuid,p_method public.payment_method,p_date date,p_notes text default null,p_reference text default null,p_collected_by uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.collection_receipts; c public.contracts; pid uuid; remaining bigint; collector uuid;
begin
 select * into strict r from public.collection_receipts where id=p_receipt for update;
 if not public.has_role(r.org_id,array['admin','accountant','collector']::public.member_role[]) or not public.staff_can_contract(r.contract_id) then raise exception 'forbidden' using errcode='42501'; end if;
 if r.payment_id is not null then return jsonb_build_object('id',r.payment_id,'systemNo',r.document_no,'duplicate',true,'creditFils',0); end if;
 select * into strict c from public.contracts where id=r.contract_id for update;
 if r.status<>'prepared' or c.status not in ('active','notice_given') then raise exception 'receipt_changed'; end if;
 perform public.assert_period_open(r.org_id,p_date);
 collector:=case when public.is_manager(r.org_id) then coalesce(p_collected_by,auth.uid()) else auth.uid() end;
 if not exists(select 1 from public.org_members where org_id=r.org_id and user_id=collector and active and role in ('admin','accountant','collector')) then raise exception 'forbidden' using errcode='42501';end if;
 select coalesce(sum(outstanding_fils),0) into remaining from public.v_charge_balances where contract_id=c.id and period<=r.period and outstanding_fils>0;
 if remaining<>r.amount_fils or exists(select 1 from public.v_charge_balances where contract_id=c.id and period<=r.period and outstanding_fils>0 and not (r.snapshot->'periods' ? period)) then raise exception 'receipt_changed'; end if;
 insert into public.payments(org_id,owner_id,tenant_id,contract_id,amount_fils,method,received_at,receipt_no,system_no,collected_by,notes,reference,client_id,collection_receipt_id) values(r.org_id,r.owner_id,c.tenant_id,c.id,r.amount_fils,p_method,p_date,r.document_no,r.document_no,collector,p_notes,p_reference,r.id,r.id) returning id into pid;
 insert into public.payment_allocations(org_id,payment_id,charge_id,amount_fils) select r.org_id,pid,charge_id,outstanding_fils from public.v_charge_balances where contract_id=c.id and period<=r.period and outstanding_fils>0;
 update public.collection_receipts set status='collected',payment_id=pid where id=r.id;
 return jsonb_build_object('id',pid,'systemNo',r.document_no,'duplicate',false,'creditFils',0);
end $$;
revoke all on function public.collect_prepared_receipt(uuid,public.payment_method,date,text,text,uuid) from public,anon;
grant execute on function public.collect_prepared_receipt(uuid,public.payment_method,date,text,text,uuid) to authenticated;
create function public.void_collection_receipt(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare r public.collection_receipts;
begin
 select * into strict r from public.collection_receipts where id=p_id for update;
 if not public.staff_can_contract(r.contract_id) or not (public.is_manager(r.org_id) or r.created_by=auth.uid()) then raise exception 'forbidden' using errcode='42501'; end if;
 if r.status<>'prepared' or coalesce(length(btrim(p_reason)),0)=0 then raise exception 'invalid_transition'; end if;
 update public.collection_receipts set status='void',void_reason=p_reason where id=r.id;
end $$;
revoke all on function public.void_collection_receipt(uuid,text) from public,anon;
grant execute on function public.void_collection_receipt(uuid,text) to authenticated;

create table public.document_prints(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.orgs(id) on delete cascade,property_id uuid not null references public.properties(id),owner_id uuid references public.owners(id),kind text not null check(kind in ('payment','collection','voucher')),document_id uuid not null,document_no text not null,job_id uuid not null,created_at timestamptz not null default now(),created_by uuid references auth.users default auth.uid(),unique(kind,document_id,job_id));
alter table public.document_prints enable row level security;
create policy document_print_read on public.document_prints for select to authenticated using((public.is_staff(org_id) and public.staff_can_property(property_id)) or public.owner_can_see_property(property_id));
create index document_print_document on public.document_prints(kind,document_id);
create function public.record_document_print(p_kind text,p_ids uuid[],p_job uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_org uuid; v_property uuid; v_owner uuid; v_no text; v_kind text; v_link uuid;
begin
 if cardinality(p_ids)<1 or cardinality(p_ids)>100 then raise exception 'validation'; end if;
 foreach v_id in array p_ids loop
  v_org:=null;v_property:=null;v_owner:=null;v_link:=null;v_kind:=p_kind;
  if p_kind='collection' then select org_id,property_id,owner_id,document_no into v_org,v_property,v_owner,v_no from public.collection_receipts where id=v_id;
  elsif p_kind='payment' then
   select p.org_id,c.property_id,coalesce(p.owner_id,public.document_owner(p.contract_id)),coalesce(p.receipt_no,p.system_no,p.id::text),p.collection_receipt_id into v_org,v_property,v_owner,v_no,v_link from public.payments p join public.contracts c on c.id=p.contract_id where p.id=v_id;
   if v_link is not null then v_id:=v_link;v_kind:='collection';end if;
  elsif p_kind='voucher' then
   select org_id,owner_id,voucher_no into v_org,v_owner,v_no from public.expense_vouchers where id=v_id;
   select ea.property_id into v_property from public.expense_allocations ea join public.expense_lines el on el.id=ea.expense_line_id where el.voucher_id=v_id and (public.staff_can_property(ea.property_id) or public.owner_can_see_property(ea.property_id)) order by ea.property_id limit 1;
  else raise exception 'validation';end if;
  if v_owner is null and v_property is not null then select owner_id into v_owner from public.property_owners where property_id=v_property order by share_pct desc,owner_id limit 1;end if;
  if v_org is null or not ((public.is_staff(v_org) and public.staff_can_property(v_property)) or public.owner_can_see_property(v_property)) then raise exception 'forbidden' using errcode='42501';end if;
  insert into public.document_prints(org_id,property_id,owner_id,kind,document_id,document_no,job_id) values(v_org,v_property,v_owner,v_kind,v_id,v_no,p_job) on conflict(kind,document_id,job_id) do nothing;
 end loop;
end $$;
revoke all on function public.record_document_print(text,uuid[],uuid) from public,anon;
grant execute on function public.record_document_print(text,uuid[],uuid) to authenticated;
create view public.v_document_print_counts with(security_invoker=true) as select org_id,kind,document_id,count(*)::bigint print_count,max(created_at) last_print_at from public.document_prints group by org_id,kind,document_id;
grant select on public.v_document_print_counts to authenticated;
create function public.keep_document_identity() returns trigger language plpgsql as $$
begin
 new.owner_id:=old.owner_id;
 if tg_table_name='payments' then new.receipt_no:=old.receipt_no;new.system_no:=old.system_no;new.collection_receipt_id:=old.collection_receipt_id;
 else new.voucher_no:=old.voucher_no;end if;
 return new;
end $$;
create trigger keep_document_identity before update on public.payments for each row execute function public.keep_document_identity();
create trigger keep_document_identity before update on public.expense_vouchers for each row execute function public.keep_document_identity();
create function public.void_linked_collection_receipt() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.voided and not old.voided and new.collection_receipt_id is not null then
  update public.collection_receipts set status='void',void_reason=new.void_reason where id=new.collection_receipt_id;
 end if;return new;
end $$;
create trigger void_linked_collection_receipt after update of voided on public.payments for each row execute function public.void_linked_collection_receipt();
