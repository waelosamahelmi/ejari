-- Open-ended concessions retain gross rent and apply only to actual rent charges.
alter table public.contract_discounts alter column to_period drop not null;

create or replace function public.apply_discount_to_charge(p_charge uuid,p_discount uuid) returns void language plpgsql security definer set search_path=public as $$
declare ch public.charges; d public.contract_discounts; v_adjusted bigint; v_surplus bigint; a record; v_release bigint;
begin
 select * into strict ch from public.charges where id=p_charge for update;
 select * into strict d from public.contract_discounts where id=p_discount;
 if ch.contract_id<>d.contract_id or ch.org_id<>d.org_id or ch.kind<>'rent' or ch.voided or ch.period not between d.from_period and coalesce(d.to_period,'9999-12') then return; end if;
 if not exists(select 1 from public.contracts c where c.id=ch.contract_id and ch.period between to_char(c.first_collection_date,'YYYY-MM') and to_char(c.end_date,'YYYY-MM')) then return; end if;
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

create or replace function public.discount_created() returns trigger language plpgsql security definer set search_path=public as $$
declare ch record; v_rent bigint; v_start date; v_end date;
begin
 select monthly_rent_fils,first_collection_date,end_date into strict v_rent,v_start,v_end from public.contracts where id=new.contract_id and org_id=new.org_id for update;
 if new.from_period < to_char(v_start,'YYYY-MM') or new.from_period > to_char(v_end,'YYYY-MM') or (new.to_period is not null and new.to_period > to_char(v_end,'YYYY-MM')) then raise exception 'discount_period_outside_contract'; end if;
 if new.amount_fils>v_rent then raise exception 'discount_exceeds_rent'; end if;
 if exists(select 1 from public.contract_discounts d where d.contract_id=new.contract_id and d.id<>new.id and d.from_period<=coalesce(new.to_period,'9999-12') and coalesce(d.to_period,'9999-12')>=new.from_period) then raise exception 'overlapping_discount'; end if;
 for ch in select id from public.charges where contract_id=new.contract_id and kind='rent' and not voided and period between new.from_period and coalesce(new.to_period,'9999-12') loop
  perform public.apply_discount_to_charge(ch.id,new.id);
 end loop;
 return new;
end $$;

create or replace function public.discount_charge_created() returns trigger language plpgsql security definer set search_path=public as $$
declare d record;
begin
 for d in select id from public.contract_discounts where contract_id=new.contract_id and new.period between from_period and coalesce(to_period,'9999-12') loop
  perform public.apply_discount_to_charge(new.id,d.id);
 end loop;
 return new;
end $$;
