-- Ijari: helper functions, triggers (updated_at, audit, occupancy sync, period lock), numbering.

-- ---------------------------------------------------------------- membership helpers
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.active
  );
$$;

create or replace function public.has_role(p_org uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.active and m.role = any (p_roles)
  );
$$;

/** Staff = anyone except the owner portal role. */
create or replace function public.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_org, array['admin','accountant','collector','viewer']::public.member_role[]);
$$;

create or replace function public.is_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_org, array['admin','accountant']::public.member_role[]);
$$;

/** Properties visible to the current owner-portal user. */
create or replace function public.owner_property_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select po.property_id
  from public.property_owners po
  join public.owners o on o.id = po.owner_id
  where o.portal_user_id = auth.uid();
$$;

create or replace function public.owner_can_see_property(p_property uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_property in (select public.owner_property_ids());
$$;

create or replace function public.owner_can_see_contract(p_contract uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contracts c
    where c.id = p_contract and c.property_id in (select public.owner_property_ids())
  );
$$;

create or replace function public.current_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.org_members where user_id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
      and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- audit
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_org := old.org_id; v_id := old.id;
  else
    v_org := new.org_id; v_id := new.id;
  end if;
  insert into public.audit_log (org_id, user_id, action, entity_type, entity_id, before, after)
  values (
    v_org, auth.uid(), lower(tg_op), tg_table_name, v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'contracts','charges','payments','payment_allocations','adjustments','expense_vouchers','expense_lines',
    'expense_allocations','deposits','legal_cases','owners','properties','units','tenants','org_members','monthly_closings'
  ] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- numbering
/** Gapless, transaction-safe per-org per-year sequence. Returns the next integer. */
create or replace function public.next_number(p_org uuid, p_key text, p_year int default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_year int := coalesce(p_year, extract(year from (now() at time zone 'Asia/Kuwait'))::int);
  v_value int;
begin
  -- Signed-in users must belong to the org; service-role / SQL callers (no JWT user) are trusted.
  if auth.uid() is not null and not public.is_member(p_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  insert into public.number_sequences (org_id, key, year, last_value)
  values (p_org, p_key, v_year, 1)
  on conflict (org_id, key, year) do update set last_value = public.number_sequences.last_value + 1
  returning last_value into v_value;
  return v_value;
end;
$$;

-- ---------------------------------------------------------------- contract occupancy sync
/** Keeps contract_units.occupancy/is_live in sync so the exclusion constraint prevents overlaps. */
create or replace function public.sync_contract_units()
returns trigger language plpgsql as $$
begin
  update public.contract_units cu
  set occupancy = daterange(new.start_date, least(new.end_date, coalesce(new.move_out_date, new.end_date)), '[]'),
      is_live = new.status in ('active', 'notice_given')
  where cu.contract_id = new.id;
  return new;
end;
$$;

create trigger sync_contract_units after insert or update of start_date, end_date, move_out_date, status on public.contracts
for each row execute function public.sync_contract_units();

create or replace function public.init_contract_unit()
returns trigger language plpgsql as $$
declare c record;
begin
  select start_date, end_date, move_out_date, status into c from public.contracts where id = new.contract_id;
  new.occupancy := daterange(c.start_date, least(c.end_date, coalesce(c.move_out_date, c.end_date)), '[]');
  new.is_live := c.status in ('active', 'notice_given');
  return new;
end;
$$;

create trigger init_contract_unit before insert on public.contract_units
for each row execute function public.init_contract_unit();

-- ---------------------------------------------------------------- period lock
create or replace function public.is_period_closed(p_org uuid, p_period text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.monthly_closings where org_id = p_org and period = p_period);
$$;

create or replace function public.assert_period_open(p_org uuid, p_date date)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_date is not null and public.is_period_closed(p_org, to_char(p_date, 'YYYY-MM')) then
    raise exception 'period % is closed', to_char(p_date, 'YYYY-MM') using errcode = 'P0001', hint = 'period_closed';
  end if;
end;
$$;

create or replace function public.enforce_period_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_date date;
  v_old_date date;
begin
  r := coalesce(new, old);
  case tg_table_name
    when 'payments' then
      v_date := case when tg_op = 'DELETE' then old.received_at else new.received_at end;
      v_old_date := case when tg_op = 'UPDATE' then old.received_at end;
    when 'charges' then
      v_date := to_date((case when tg_op = 'DELETE' then old.period else new.period end) || '-01', 'YYYY-MM-DD');
    when 'adjustments' then
      v_date := case when tg_op = 'DELETE' then old.adjustment_date else new.adjustment_date end;
    when 'expense_vouchers' then
      v_date := case when tg_op = 'DELETE' then old.voucher_date else new.voucher_date end;
      v_old_date := case when tg_op = 'UPDATE' then old.voucher_date end;
    when 'deposits' then
      v_date := case when tg_op = 'DELETE' then old.deposit_date else new.deposit_date end;
      v_old_date := case when tg_op = 'UPDATE' then old.deposit_date end;
    else
      v_date := null;
  end case;
  perform public.assert_period_open(r.org_id, v_date);
  perform public.assert_period_open(r.org_id, v_old_date);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['payments','charges','adjustments','expense_vouchers','deposits'] loop
    execute format('create trigger period_lock_%1$s before insert or update or delete on public.%1$I for each row execute function public.enforce_period_lock()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- org bootstrap
/** Creates an organization for the signed-in user and makes them admin. */
create or replace function public.create_org(p_name text, p_name_en text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  insert into public.orgs (name, name_en) values (p_name, p_name_en) returning id into v_org;
  insert into public.org_members (org_id, user_id, role, display_name, email)
  select v_org, auth.uid(), 'admin', split_part(u.email, '@', 1), u.email from auth.users u where u.id = auth.uid();
  return v_org;
end;
$$;

-- ---------------------------------------------------------------- void payment (atomic)
create or replace function public.void_payment(p_payment uuid, p_reason text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason required' using errcode = '22023';
  end if;
  update public.payments
  set voided = true, void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_payment and not voided;
  if not found then
    raise exception 'payment not found or already voided' using errcode = 'P0002';
  end if;
  delete from public.payment_allocations where payment_id = p_payment;
end;
$$;
