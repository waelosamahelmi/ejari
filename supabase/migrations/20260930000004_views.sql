-- Ijari: views (security_invoker so RLS of the caller applies).

create or replace view public.v_charge_balances with (security_invoker = true) as
select
  c.id as charge_id,
  c.org_id,
  c.contract_id,
  c.period,
  c.kind,
  c.due_date,
  c.amount_fils,
  c.waived_value_fils,
  coalesce(a.allocated, 0)::bigint as allocated_fils,
  coalesce(adj.adjusted, 0)::bigint as adjusted_fils,
  greatest(c.amount_fils - coalesce(a.allocated, 0) - coalesce(adj.adjusted, 0), 0)::bigint as outstanding_fils
from public.charges c
left join lateral (
  select sum(pa.amount_fils) as allocated
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id and not p.voided
  where pa.charge_id = c.id
) a on true
left join lateral (
  select sum(x.amount_fils) as adjusted from public.adjustments x where x.charge_id = c.id
) adj on true
where not c.voided;

create or replace view public.v_contract_balances with (security_invoker = true) as
select
  k.id as contract_id,
  k.org_id,
  k.tenant_id,
  k.property_id,
  k.status,
  coalesce(sum(b.outstanding_fils) filter (where b.due_date <= (now() at time zone 'Asia/Kuwait')::date), 0)::bigint as arrears_fils,
  min(b.due_date) filter (where b.outstanding_fils > 0 and b.amount_fils > 0 and b.due_date <= (now() at time zone 'Asia/Kuwait')::date) as oldest_due_date,
  coalesce((select sum(p.amount_fils) from public.payments p where p.contract_id = k.id and not p.voided), 0)::bigint
    - coalesce((select sum(pa.amount_fils) from public.payment_allocations pa join public.payments p on p.id = pa.payment_id and not p.voided where p.contract_id = k.id), 0)::bigint
    as credit_fils,
  (select max(p.received_at) from public.payments p where p.contract_id = k.id and not p.voided) as last_payment_date
from public.contracts k
left join public.v_charge_balances b on b.contract_id = k.id
group by k.id;

create or replace view public.v_unit_status_today with (security_invoker = true) as
with today as (select (now() at time zone 'Asia/Kuwait')::date as d)
select
  u.id as unit_id,
  u.org_id,
  u.property_id,
  cur.contract_id,
  case
    when cur.contract_id is null then
      case when exists (
        select 1 from public.contract_units cu2 join public.contracts c2 on c2.id = cu2.contract_id
        where cu2.unit_id = u.id and c2.status in ('active','notice_given') and c2.start_date > (select d from today)
      ) then 'reserved' else 'vacant' end
    when exists (select 1 from public.legal_cases l where l.contract_id = cur.contract_id and l.status not in ('none','closed')) then 'legal'
    when cur.status = 'notice_given' then 'notice'
    when (select d from today) < cur.first_collection_date then 'in_grace'
    else 'occupied'
  end as status
from public.units u
left join lateral (
  select c.id as contract_id, c.status, c.first_collection_date
  from public.contract_units cu
  join public.contracts c on c.id = cu.contract_id
  where cu.unit_id = u.id
    and c.status in ('active','notice_given')
    and c.start_date <= (select d from today)
    and least(c.end_date, coalesce(c.move_out_date, c.end_date)) >= (select d from today)
  limit 1
) cur on true
where u.active;

create or replace view public.v_property_month_summary with (security_invoker = true) as
select
  c.org_id,
  k.property_id,
  c.period,
  sum(c.amount_fils)::bigint as expected_fils,
  sum(b.allocated_fils)::bigint as allocated_fils,
  sum(b.outstanding_fils)::bigint as outstanding_fils,
  sum(c.waived_value_fils)::bigint as waived_fils
from public.charges c
join public.contracts k on k.id = c.contract_id
join public.v_charge_balances b on b.charge_id = c.id
where not c.voided
group by c.org_id, k.property_id, c.period;
